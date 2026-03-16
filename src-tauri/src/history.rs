use std::fs;
use std::path::PathBuf;

const MAX_ENTRIES: usize = 10;

fn history_path() -> PathBuf {
    crate::platform::config_dir().join("recent_directories.json")
}

pub fn load_history() -> Vec<String> {
    let path = history_path();
    if !path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn add_directory(dir: &str) {
    let mut dirs = load_history();

    // Remove if already exists (will re-add at front)
    dirs.retain(|d| d != dir);

    // Add to front
    dirs.insert(0, dir.to_string());

    // Keep only MAX_ENTRIES
    dirs.truncate(MAX_ENTRIES);

    let path = history_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&dirs) {
        let _ = fs::write(&path, json);
    }
}
