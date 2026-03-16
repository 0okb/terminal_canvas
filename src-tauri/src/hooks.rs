use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use crate::platform;

const POLL_INTERVAL_MS: u64 = 300;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct ClaudeStatusEvent {
    pub session_id: String,
    pub status: String,
    pub cwd: String,
    pub timestamp: u64,
}

/// Install the hook script and configure Claude Code settings.
/// Only registers Stop and Notification(permission_prompt) hooks.
pub fn setup_hooks() -> Result<String, String> {
    let hook_dir = platform::hooks_dir();
    fs::create_dir_all(&hook_dir)
        .map_err(|e| format!("Failed to create hook dir: {}", e))?;

    #[cfg(unix)]
    let (hook_script_name, script_content) = (
        "status-hook.sh",
        include_str!("../resources/status-hook.sh"),
    );
    #[cfg(windows)]
    let (hook_script_name, script_content) = (
        "status-hook.ps1",
        include_str!("../resources/status-hook.ps1"),
    );

    let hook_script_path = hook_dir.join(hook_script_name);
    fs::write(&hook_script_path, script_content)
        .map_err(|e| format!("Failed to write hook script: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook_script_path, fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("Failed to set permissions: {}", e))?;
    }

    #[cfg(unix)]
    let hook_command = hook_script_path.to_string_lossy().to_string();
    #[cfg(windows)]
    let hook_command = format!(
        "powershell.exe -ExecutionPolicy Bypass -File \"{}\"",
        hook_script_path.to_string_lossy()
    );

    let claude_settings_path = platform::claude_settings_path();

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

    let hook_entry = |timeout: u32| -> serde_json::Value {
        serde_json::json!({
            "type": "command",
            "command": hook_command,
            "timeout": timeout
        })
    };

    let hooks = settings
        .as_object_mut()
        .unwrap()
        .entry("hooks")
        .or_insert_with(|| serde_json::json!({}));

    let hooks_obj = hooks.as_object_mut().unwrap();

    let add_hook = |event_hooks: &mut serde_json::Value, matcher: &str, timeout: u32| {
        let arr = event_hooks.as_array_mut().unwrap();
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

    // Only 2 hook events: Stop and Notification(permission_prompt)
    for (event_name, matcher) in [
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

    let status_dir = platform::status_dir();
    fs::create_dir_all(&status_dir)
        .map_err(|e| format!("Failed to create status dir: {}", e))?;

    Ok(format!(
        "Hooks installed. Script: {}. Settings: {}",
        hook_script_path.display(),
        claude_settings_path.display()
    ))
}

/// Start a background thread that polls the status directory for changes.
pub fn start_status_watcher(app_handle: AppHandle) {
    let last_seen: Arc<Mutex<HashMap<String, u64>>> = Arc::new(Mutex::new(HashMap::new()));

    thread::spawn(move || {
        let status_dir = platform::status_dir();
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
                        continue;
                    }

                    let content = match fs::read_to_string(&path) {
                        Ok(c) => c,
                        Err(_) => continue,
                    };

                    let event: ClaudeStatusEvent = match serde_json::from_str(&content) {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    let mut seen = last_seen.lock().unwrap();
                    let last_ts = seen.get(&session_id).copied().unwrap_or(0);
                    if event.timestamp > last_ts {
                        seen.insert(session_id.clone(), event.timestamp);

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
