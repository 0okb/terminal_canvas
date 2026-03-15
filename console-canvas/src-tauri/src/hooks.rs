use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const STATUS_DIR: &str = "/tmp/terminal-canvas";
const POLL_INTERVAL_MS: u64 = 300;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ClaudeStatusEvent {
    pub session_id: String,
    pub status: String,
    pub tool_name: String,
    pub cwd: String,
    pub timestamp: u64,
    #[serde(default)]
    pub cost: f64,
}

/// Install the hook script and configure Claude Code settings.
pub fn setup_hooks() -> Result<String, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;

    // 1. Install hook script
    let hook_dir = PathBuf::from(&home).join(".terminal-canvas").join("hooks");
    fs::create_dir_all(&hook_dir)
        .map_err(|e| format!("Failed to create hook dir: {}", e))?;

    let hook_script_path = hook_dir.join("status-hook.sh");
    let script_content = include_str!("../resources/status-hook.sh");
    fs::write(&hook_script_path, script_content)
        .map_err(|e| format!("Failed to write hook script: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook_script_path, fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    // 2. Update Claude Code user settings
    let claude_settings_path = PathBuf::from(&home).join(".claude").join("settings.json");

    let mut settings: serde_json::Value = if claude_settings_path.exists() {
        let content = fs::read_to_string(&claude_settings_path)
            .map_err(|e| format!("Failed to read claude settings: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse claude settings: {}", e))?
    } else {
        fs::create_dir_all(claude_settings_path.parent().unwrap())
            .map_err(|e| format!("Failed to create .claude dir: {}", e))?;
        serde_json::json!({})
    };

    let hook_command = hook_script_path.to_string_lossy().to_string();

    let hook_entry = |timeout: u32| -> serde_json::Value {
        serde_json::json!({
            "type": "command",
            "command": hook_command,
            "timeout": timeout
        })
    };

    // Build hooks config - merge with existing, don't overwrite
    let hooks = settings
        .as_object_mut()
        .unwrap()
        .entry("hooks")
        .or_insert_with(|| serde_json::json!({}));

    let hooks_obj = hooks.as_object_mut().unwrap();

    // Helper: add our hook to an event, avoiding duplicates
    let add_hook = |event_hooks: &mut serde_json::Value, matcher: &str, timeout: u32| {
        let arr = event_hooks.as_array_mut().unwrap();
        // Check if our hook already exists
        let already_exists = arr.iter().any(|entry| {
            entry["hooks"]
                .as_array()
                .map(|h| {
                    h.iter()
                        .any(|hk| hk["command"].as_str() == Some(&hook_command))
                })
                .unwrap_or(false)
        });
        if !already_exists {
            arr.push(serde_json::json!({
                "matcher": matcher,
                "hooks": [hook_entry(timeout)]
            }));
        }
    };

    for (event_name, matcher) in [
        ("PreToolUse", ""),
        ("PostToolUse", ""),
        ("Stop", ""),
        ("Notification", "permission_prompt"),
    ] {
        let event_hooks = hooks_obj
            .entry(event_name)
            .or_insert_with(|| serde_json::json!([]));
        add_hook(event_hooks, matcher, 5);
    }

    let json_output = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;
    fs::write(&claude_settings_path, &json_output)
        .map_err(|e| format!("Failed to write claude settings: {}", e))?;

    // 3. Create status directory
    fs::create_dir_all(STATUS_DIR)
        .map_err(|e| format!("Failed to create status dir: {}", e))?;

    Ok(format!(
        "Hooks installed. Script: {}. Settings: {}",
        hook_script_path.display(),
        claude_settings_path.display()
    ))
}

/// Start a background thread that polls /tmp/terminal-canvas/ for status changes
/// and emits events to the frontend.
pub fn start_status_watcher(app_handle: AppHandle) {
    let last_seen: Arc<Mutex<HashMap<String, u64>>> = Arc::new(Mutex::new(HashMap::new()));

    thread::spawn(move || {
        let status_dir = PathBuf::from(STATUS_DIR);
        loop {
            thread::sleep(Duration::from_millis(POLL_INTERVAL_MS));

            if !status_dir.exists() {
                continue;
            }

            let entries = match fs::read_dir(&status_dir) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "json").unwrap_or(false) {
                    let session_id = path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    if session_id.starts_with('.') {
                        continue; // skip temp files
                    }

                    let content = match fs::read_to_string(&path) {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let event: ClaudeStatusEvent = match serde_json::from_str(&content) {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    // Only emit if timestamp is newer
                    let mut seen = last_seen.lock().unwrap();
                    let last_ts = seen.get(&session_id).copied().unwrap_or(0);
                    if event.timestamp > last_ts {
                        seen.insert(session_id.clone(), event.timestamp);

                        // Auto-add cwd to recent directories history
                        if !event.cwd.is_empty() {
                            crate::history::add_directory(&event.cwd);
                        }

                        let evt = ClaudeStatusEvent {
                            session_id,
                            ..event
                        };
                        let _ = app_handle.emit("claude-status", &evt);
                    }
                }
            }

            // Clean up old status files (older than 1 hour)
            if let Ok(entries) = fs::read_dir(&status_dir) {
                let cutoff = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs()
                    - 3600;
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(evt) = serde_json::from_str::<ClaudeStatusEvent>(&content) {
                            if evt.timestamp < cutoff {
                                let _ = fs::remove_file(&path);
                            }
                        }
                    }
                }
            }
        }
    });
}
