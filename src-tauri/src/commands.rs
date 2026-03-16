use crate::history;
use crate::pty_manager::PtyManager;
use crate::theme::{self, Theme};
use crate::workspace::{self, WorkspaceData};
use tauri::State;

#[tauri::command]
pub fn create_pty(
    app_handle: tauri::AppHandle,
    pty_manager: State<'_, PtyManager>,
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    pty_manager.create_pty(&app_handle, shell, cwd, cols, rows)
}

#[tauri::command]
pub fn write_pty(
    pty_manager: State<'_, PtyManager>,
    pty_id: u32,
    data: String,
) -> Result<(), String> {
    pty_manager.write_pty(pty_id, &data)
}

#[tauri::command]
pub fn resize_pty(
    pty_manager: State<'_, PtyManager>,
    pty_id: u32,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    pty_manager.resize_pty(pty_id, cols, rows)
}

#[tauri::command]
pub fn close_pty(
    pty_manager: State<'_, PtyManager>,
    pty_id: u32,
) -> Result<(), String> {
    pty_manager.close_pty(pty_id)
}

#[tauri::command]
pub fn get_theme() -> Theme {
    theme::load_theme()
}

#[tauri::command]
pub fn get_recent_directories() -> Vec<String> {
    history::load_history()
}

#[tauri::command]
pub fn add_recent_directory(dir: String) {
    history::add_directory(&dir);
}

#[tauri::command]
pub fn save_workspace(data: WorkspaceData) -> Result<(), String> {
    workspace::save(&data)
}

#[tauri::command]
pub fn load_workspace() -> Option<WorkspaceData> {
    workspace::load()
}
