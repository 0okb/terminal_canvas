use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufReader, Write};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

static NEXT_PTY_ID: AtomicU32 = AtomicU32::new(1);

#[derive(Clone, Serialize, Deserialize)]
pub struct PtyOutput {
    pub pty_id: u32,
    pub data: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PtyExit {
    pub pty_id: u32,
    pub code: i32,
}

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<u32, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_pty(
        &self,
        app_handle: &AppHandle,
        shell: Option<String>,
        cwd: Option<String>,
        cols: u16,
        rows: u16,
    ) -> Result<u32, String> {
        let pty_system = native_pty_system();

        let pty_size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(pty_size)
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let shell_path = shell.unwrap_or_else(|| {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
        });

        let mut cmd = CommandBuilder::new(&shell_path);
        cmd.arg("-l"); // login shell
        if let Some(ref dir) = cwd {
            let expanded = if dir.starts_with('~') {
                let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
                dir.replacen('~', &home, 1)
            } else {
                dir.clone()
            };
            if !expanded.is_empty() {
                cmd.cwd(&expanded);
            }
        }

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        let pty_id = NEXT_PTY_ID.fetch_add(1, Ordering::SeqCst);

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get writer: {}", e))?;

        // Read PTY output in a background thread
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get reader: {}", e))?;

        let app_handle_clone = app_handle.clone();
        let pty_id_for_reader = pty_id;

        thread::spawn(move || {
            let mut buf_reader = BufReader::with_capacity(4096, reader);
            let mut buf = vec![0u8; 4096];
            loop {
                match std::io::Read::read(&mut buf_reader, &mut buf) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_handle_clone.emit(
                            "pty-output",
                            PtyOutput {
                                pty_id: pty_id_for_reader,
                                data,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });

        // Monitor child process exit in background
        let app_handle_exit = app_handle.clone();
        let pty_id_for_exit = pty_id;

        thread::spawn(move || {
            let status = child.wait();
            let code = match status {
                Ok(exit) => {
                    if exit.success() {
                        0
                    } else {
                        1
                    }
                }
                Err(_) => -1,
            };
            let _ = app_handle_exit.emit(
                "pty-exit",
                PtyExit {
                    pty_id: pty_id_for_exit,
                    code,
                },
            );
        });

        let session = PtySession {
            master: pair.master,
            writer,
        };

        self.sessions.lock().unwrap().insert(pty_id, session);

        Ok(pty_id)
    }

    pub fn write_pty(&self, pty_id: u32, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get_mut(&pty_id)
            .ok_or_else(|| format!("PTY {} not found", pty_id))?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    }

    pub fn resize_pty(&self, pty_id: u32, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions
            .get(&pty_id)
            .ok_or_else(|| format!("PTY {} not found", pty_id))?;
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    }

    pub fn close_pty(&self, pty_id: u32) -> Result<(), String> {
        self.sessions
            .lock()
            .unwrap()
            .remove(&pty_id)
            .ok_or_else(|| format!("PTY {} not found", pty_id))?;
        Ok(())
    }
}
