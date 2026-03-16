mod commands;
mod history;
mod hooks;
pub mod platform;
mod pty_manager;
mod theme;
mod workspace;

use pty_manager::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::create_pty,
            commands::write_pty,
            commands::resize_pty,
            commands::close_pty,
            commands::get_theme,
            commands::get_recent_directories,
            commands::add_recent_directory,
            commands::save_workspace,
            commands::load_workspace,
        ])
        .setup(|app| {
            let _ = hooks::setup_hooks();
            hooks::start_status_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
