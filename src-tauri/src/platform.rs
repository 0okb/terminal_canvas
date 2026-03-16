use std::path::PathBuf;

/// Get the user's home directory.
pub fn home_dir() -> PathBuf {
    #[cfg(unix)]
    {
        std::env::var("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/tmp"))
    }
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOMEPATH").map(|p| format!("C:{}", p)))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("C:\\"))
    }
}

/// Get the platform-specific application config directory.
/// macOS:   ~/Library/Application Support/terminal-canvas/
/// Windows: %APPDATA%\terminal-canvas\
/// Linux:   ~/.config/terminal-canvas/
pub fn config_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        home_dir()
            .join("Library")
            .join("Application Support")
            .join("terminal-canvas")
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home_dir().join("AppData").join("Roaming"))
            .join("terminal-canvas")
    }
    #[cfg(target_os = "linux")]
    {
        home_dir().join(".config").join("terminal-canvas")
    }
}

/// Get the platform-specific temporary status directory.
/// Unix:    /tmp/terminal-canvas/
/// Windows: %TEMP%\terminal-canvas\
pub fn status_dir() -> PathBuf {
    #[cfg(unix)]
    {
        PathBuf::from("/tmp/terminal-canvas")
    }
    #[cfg(windows)]
    {
        std::env::var("TEMP")
            .map(PathBuf::from)
            .unwrap_or_else(|_| home_dir().join("AppData").join("Local").join("Temp"))
            .join("terminal-canvas")
    }
}

/// Get the platform-specific hooks installation directory.
/// Unix:    ~/.terminal-canvas/hooks/
/// Windows: %APPDATA%\terminal-canvas\hooks\
pub fn hooks_dir() -> PathBuf {
    #[cfg(unix)]
    {
        home_dir().join(".terminal-canvas").join("hooks")
    }
    #[cfg(windows)]
    {
        config_dir().join("hooks")
    }
}

/// Get the default shell for the platform.
pub fn default_shell() -> String {
    #[cfg(unix)]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    }
    #[cfg(windows)]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    }
}

/// Get the Claude Code settings.json path.
pub fn claude_settings_path() -> PathBuf {
    #[cfg(unix)]
    {
        home_dir().join(".claude").join("settings.json")
    }
    #[cfg(windows)]
    {
        home_dir().join(".claude").join("settings.json")
    }
}

/// Expand ~ in a path to the home directory.
pub fn expand_tilde(path: &str) -> String {
    if path.starts_with('~') {
        let home = home_dir().to_string_lossy().to_string();
        path.replacen('~', &home, 1)
    } else {
        path.to_string()
    }
}
