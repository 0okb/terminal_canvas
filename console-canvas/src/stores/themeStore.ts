import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import type { Theme } from "../types";

const defaultTheme: Theme = {
  terminal: {
    background: "#000000",
    foreground: "#bbbbbb",
    cursor: "#bbbbbb",
    cursor_accent: "#ffffff",
    selection_background: "#b4d5ff",
    selection_foreground: "#000000",
    black: "#000000",
    red: "#bb0000",
    green: "#00bb00",
    yellow: "#bbbb00",
    blue: "#0000bb",
    magenta: "#bb00bb",
    cyan: "#00bbbb",
    white: "#bbbbbb",
    bright_black: "#555555",
    bright_red: "#ff5555",
    bright_green: "#55ff55",
    bright_yellow: "#ffff55",
    bright_blue: "#5555ff",
    bright_magenta: "#ff55ff",
    bright_cyan: "#55ffff",
    bright_white: "#ffffff",
  },
  ui: {
    app_background: "#1a1a1a",
    toolbar_background: "#111111",
    toolbar_border: "#333333",
    toolbar_button_background: "#2a2a2a",
    toolbar_button_background_hover: "#3a3a3a",
    toolbar_button_text: "#d4d4d4",
    toolbar_button_border: "#444444",
    toolbar_zoom_text: "#888888",
    canvas_dot: "#2a2a2a",
    pane_background: "#000000",
    pane_border: "#333333",
    pane_border_active: "#aaaaaa",
    pane_shadow_active: "rgba(255, 255, 255, 0.06)",
    titlebar_background: "#141414",
    titlebar_text: "#888888",
    close_button_text: "#888888",
    close_button_hover: "#ffffff",
    resize_handle: "#444444",
    statusbar_background: "#0a0a0a",
    statusbar_text: "#888888",
  },
  status: {
    idle: "#555555",
    thinking: "#f0c674",
    tool_running: "#81a2be",
    permission: "#cc6666",
    error: "#a54242",
    completed: "#8c9440",
  },
};

const [theme, setTheme] = createSignal<Theme>(defaultTheme);
const [themeLoaded, setThemeLoaded] = createSignal(false);

async function loadTheme() {
  try {
    const t = await invoke<Theme>("get_theme");
    setTheme(t);
  } catch (e) {
    console.error("Failed to load theme:", e);
  }
  setThemeLoaded(true);
}

function applyUiTheme(ui: Theme["ui"]) {
  const root = document.documentElement;
  root.style.setProperty("--app-background", ui.app_background);
  root.style.setProperty("--toolbar-background", ui.toolbar_background);
  root.style.setProperty("--toolbar-border", ui.toolbar_border);
  root.style.setProperty("--toolbar-btn-bg", ui.toolbar_button_background);
  root.style.setProperty("--toolbar-btn-bg-hover", ui.toolbar_button_background_hover);
  root.style.setProperty("--toolbar-btn-text", ui.toolbar_button_text);
  root.style.setProperty("--toolbar-btn-border", ui.toolbar_button_border);
  root.style.setProperty("--toolbar-zoom-text", ui.toolbar_zoom_text);
  root.style.setProperty("--canvas-dot", ui.canvas_dot);
  root.style.setProperty("--pane-bg", ui.pane_background);
  root.style.setProperty("--pane-border", ui.pane_border);
  root.style.setProperty("--pane-border-active", ui.pane_border_active);
  root.style.setProperty("--pane-shadow-active", ui.pane_shadow_active);
  root.style.setProperty("--titlebar-bg", ui.titlebar_background);
  root.style.setProperty("--titlebar-text", ui.titlebar_text);
  root.style.setProperty("--close-btn-text", ui.close_button_text);
  root.style.setProperty("--close-btn-hover", ui.close_button_hover);
  root.style.setProperty("--resize-handle", ui.resize_handle);
  root.style.setProperty("--statusbar-bg", ui.statusbar_background);
  root.style.setProperty("--statusbar-text", ui.statusbar_text);
}

export { theme, themeLoaded, loadTheme, applyUiTheme };
