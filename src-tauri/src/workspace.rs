use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Clone, Serialize, Deserialize)]
pub struct WorkspaceTerminal {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub cwd: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct WorkspaceCanvas {
    pub pan_x: f64,
    pub pan_y: f64,
    pub zoom: f64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct WorkspaceData {
    pub canvas: WorkspaceCanvas,
    pub terminals: Vec<WorkspaceTerminal>,
}

fn workspace_path() -> PathBuf {
    crate::platform::config_dir().join("workspace.json")
}

pub fn save(data: &WorkspaceData) -> Result<(), String> {
    let path = workspace_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn load() -> Option<WorkspaceData> {
    let path = workspace_path();
    if !path.exists() {
        return None;
    }
    let content = fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}
