use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Clone, Serialize, Deserialize)]
pub struct TerminalColors {
    pub background: String,
    pub foreground: String,
    pub cursor: String,
    pub cursor_accent: String,
    pub selection_background: String,
    pub selection_foreground: String,
    pub black: String,
    pub red: String,
    pub green: String,
    pub yellow: String,
    pub blue: String,
    pub magenta: String,
    pub cyan: String,
    pub white: String,
    pub bright_black: String,
    pub bright_red: String,
    pub bright_green: String,
    pub bright_yellow: String,
    pub bright_blue: String,
    pub bright_magenta: String,
    pub bright_cyan: String,
    pub bright_white: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct UiColors {
    pub app_background: String,
    pub toolbar_background: String,
    pub toolbar_border: String,
    pub toolbar_button_background: String,
    pub toolbar_button_background_hover: String,
    pub toolbar_button_text: String,
    pub toolbar_button_border: String,
    pub toolbar_zoom_text: String,
    pub canvas_dot: String,
    pub pane_background: String,
    pub pane_border: String,
    pub pane_border_active: String,
    pub pane_shadow_active: String,
    pub titlebar_background: String,
    pub titlebar_text: String,
    pub close_button_text: String,
    pub close_button_hover: String,
    pub resize_handle: String,
    pub statusbar_background: String,
    pub statusbar_text: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct StatusColors {
    pub idle: String,
    pub thinking: String,
    pub tool_running: String,
    pub permission: String,
    pub error: String,
    pub completed: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct Theme {
    pub terminal: TerminalColors,
    pub ui: UiColors,
    pub status: StatusColors,
}

impl Default for Theme {
    fn default() -> Self {
        Self {
            terminal: TerminalColors {
                background: "#000000".into(),
                foreground: "#bbbbbb".into(),
                cursor: "#bbbbbb".into(),
                cursor_accent: "#ffffff".into(),
                selection_background: "#b4d5ff".into(),
                selection_foreground: "#000000".into(),
                black: "#000000".into(),
                red: "#bb0000".into(),
                green: "#00bb00".into(),
                yellow: "#bbbb00".into(),
                blue: "#0000bb".into(),
                magenta: "#bb00bb".into(),
                cyan: "#00bbbb".into(),
                white: "#bbbbbb".into(),
                bright_black: "#555555".into(),
                bright_red: "#ff5555".into(),
                bright_green: "#55ff55".into(),
                bright_yellow: "#ffff55".into(),
                bright_blue: "#5555ff".into(),
                bright_magenta: "#ff55ff".into(),
                bright_cyan: "#55ffff".into(),
                bright_white: "#ffffff".into(),
            },
            ui: UiColors {
                app_background: "#1a1a1a".into(),
                toolbar_background: "#111111".into(),
                toolbar_border: "#333333".into(),
                toolbar_button_background: "#2a2a2a".into(),
                toolbar_button_background_hover: "#3a3a3a".into(),
                toolbar_button_text: "#d4d4d4".into(),
                toolbar_button_border: "#444444".into(),
                toolbar_zoom_text: "#888888".into(),
                canvas_dot: "#2a2a2a".into(),
                pane_background: "#000000".into(),
                pane_border: "#333333".into(),
                pane_border_active: "#aaaaaa".into(),
                pane_shadow_active: "rgba(255, 255, 255, 0.06)".into(),
                titlebar_background: "#141414".into(),
                titlebar_text: "#888888".into(),
                close_button_text: "#888888".into(),
                close_button_hover: "#ffffff".into(),
                resize_handle: "#444444".into(),
                statusbar_background: "#0a0a0a".into(),
                statusbar_text: "#888888".into(),
            },
            status: StatusColors {
                idle: "#555555".into(),
                thinking: "#f0c674".into(),
                tool_running: "#81a2be".into(),
                permission: "#cc6666".into(),
                error: "#a54242".into(),
                completed: "#8c9440".into(),
            },
        }
    }
}

fn theme_path() -> PathBuf {
    let config_dir = dirs_config_dir().join("terminal-canvas");
    config_dir.join("theme.json")
}

fn dirs_config_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        PathBuf::from(home).join("Library").join("Application Support")
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("C:\\"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        PathBuf::from(home).join(".config")
    }
}

pub fn load_theme() -> Theme {
    let path = theme_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<Theme>(&content) {
                Ok(theme) => return theme,
                Err(e) => eprintln!("Failed to parse theme.json: {}. Using defaults.", e),
            },
            Err(e) => eprintln!("Failed to read theme.json: {}. Using defaults.", e),
        }
    } else {
        // Create default theme file so user can edit it
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let default_theme = Theme::default();
        if let Ok(json) = serde_json::to_string_pretty(&default_theme) {
            let _ = fs::write(&path, json);
            eprintln!("Created default theme at: {}", path.display());
        }
    }
    Theme::default()
}
