export type TerminalStatus = "idle" | "running" | "permission";

export interface TerminalPaneData {
  id: string;
  ptyId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  cwd: string;
  status: TerminalStatus;
}

export interface PtyOutput {
  pty_id: number;
  data: string;
}

export interface PtyExit {
  pty_id: number;
  code: number;
}

export interface ClaudeStatusEvent {
  session_id: string;
  status: string;
  cwd: string;
  timestamp: number;
}

export interface WorkspaceTerminal {
  x: number;
  y: number;
  width: number;
  height: number;
  cwd: string;
}

export interface WorkspaceCanvas {
  pan_x: number;
  pan_y: number;
  zoom: number;
}

export interface WorkspaceData {
  canvas: WorkspaceCanvas;
  terminals: WorkspaceTerminal[];
}

export interface TerminalColors {
  background: string;
  foreground: string;
  cursor: string;
  cursor_accent: string;
  selection_background: string;
  selection_foreground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  bright_black: string;
  bright_red: string;
  bright_green: string;
  bright_yellow: string;
  bright_blue: string;
  bright_magenta: string;
  bright_cyan: string;
  bright_white: string;
}

export interface UiColors {
  app_background: string;
  toolbar_background: string;
  toolbar_border: string;
  toolbar_button_background: string;
  toolbar_button_background_hover: string;
  toolbar_button_text: string;
  toolbar_button_border: string;
  toolbar_zoom_text: string;
  canvas_dot: string;
  pane_background: string;
  pane_border: string;
  pane_border_active: string;
  pane_shadow_active: string;
  titlebar_background: string;
  titlebar_text: string;
  close_button_text: string;
  close_button_hover: string;
  resize_handle: string;
}

export interface Theme {
  terminal: TerminalColors;
  ui: UiColors;
}
