import { onMount, onCleanup } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { theme } from "../stores/themeStore";
import { updateTerminalTitle, updateTerminalCwd, updateTerminalStatus, updateTerminalCost } from "../stores/terminalStore";
import { detectStatus } from "../statusDetector";
import type { ClaudeStatus, ClaudeStatusEvent, PtyOutput, PtyExit } from "../types";

interface TerminalViewProps {
  ptyId: number;
  terminalId: string;
  onResize?: (cols: number, rows: number) => void;
}

export default function TerminalView(props: TerminalViewProps) {
  let containerRef!: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let resizeObserver: ResizeObserver;
  let unlistenOutput: (() => void) | undefined;
  let unlistenExit: (() => void) | undefined;
  let unlistenHookStatus: (() => void) | undefined;
  let statusInterval: ReturnType<typeof setInterval> | undefined;
  let exited = false;

  // Track hook-based status: if hooks have reported recently, they take priority
  let lastHookTimestamp = 0;
  let hookSessionId: string | null = null;
  // cwd reported by the shell title, used to correlate hook events
  let terminalCwd = "";

  onMount(async () => {
    const t = theme().terminal;

    terminal = new Terminal({
      fontSize: 14,
      fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
      theme: {
        background: t.background,
        foreground: t.foreground,
        cursor: t.cursor,
        cursorAccent: t.cursor_accent,
        selectionBackground: t.selection_background,
        selectionForeground: t.selection_foreground,
        black: t.black,
        red: t.red,
        green: t.green,
        yellow: t.yellow,
        blue: t.blue,
        magenta: t.magenta,
        cyan: t.cyan,
        white: t.white,
        brightBlack: t.bright_black,
        brightRed: t.bright_red,
        brightGreen: t.bright_green,
        brightYellow: t.bright_yellow,
        brightBlue: t.bright_blue,
        brightMagenta: t.bright_magenta,
        brightCyan: t.bright_cyan,
        brightWhite: t.bright_white,
      },
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef);

    // Update pane title when shell reports title (OSC sequence)
    // Only accept titles that look like directory paths (from shell prompt).
    terminal.onTitleChange((title) => {
      let dir = title.replace(/^.*?:/, "").trim();
      if (!dir) dir = title;
      if (/^[~\/]/.test(dir)) {
        updateTerminalTitle(props.terminalId, dir);
        updateTerminalCwd(props.terminalId, dir);
        terminalCwd = dir;
      }
    });

    // Delay fit to ensure the container has dimensions
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    });

    // Send user input to PTY
    terminal.onData((data) => {
      invoke("write_pty", { ptyId: props.ptyId, data });
    });

    // Listen for PTY output
    unlistenOutput = await listen<PtyOutput>("pty-output", (event) => {
      if (event.payload.pty_id === props.ptyId) {
        terminal.write(event.payload.data);
      }
    });

    // Listen for PTY exit
    unlistenExit = await listen<PtyExit>("pty-exit", (event) => {
      if (event.payload.pty_id === props.ptyId) {
        exited = true;
        terminal.write(`\r\n\x1b[31m[Process exited with code ${event.payload.code}]\x1b[0m\r\n`);
        updateTerminalStatus(props.terminalId, "completed");
      }
    });

    // Listen for hook-based Claude Code status events
    unlistenHookStatus = await listen<ClaudeStatusEvent>("claude-status", (event) => {
      if (exited) return;
      const evt = event.payload;

      // Correlate by session_id (if already matched) or by cwd
      if (hookSessionId && evt.session_id === hookSessionId) {
        lastHookTimestamp = Date.now();
        updateTerminalStatus(props.terminalId, evt.status as ClaudeStatus, evt.tool_name || undefined);
        if (evt.cost > 0) updateTerminalCost(props.terminalId, evt.cost);
      } else if (!hookSessionId && terminalCwd && cwdMatches(evt.cwd, terminalCwd)) {
        hookSessionId = evt.session_id;
        lastHookTimestamp = Date.now();
        updateTerminalStatus(props.terminalId, evt.status as ClaudeStatus, evt.tool_name || undefined);
        if (evt.cost > 0) updateTerminalCost(props.terminalId, evt.cost);
      }
    });

    // Fallback: poll rendered screen content for status detection
    // Only used when hooks haven't reported recently (>3s)
    statusInterval = setInterval(() => {
      if (exited) return;
      const hookRecent = Date.now() - lastHookTimestamp < 3000;
      if (hookRecent) return; // hooks are active, skip scraping

      const status = detectStatus(terminal);
      updateTerminalStatus(props.terminalId, status);
    }, 500);

    // Resize PTY when container resizes
    resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          invoke("resize_pty", {
            ptyId: props.ptyId,
            cols: dims.cols,
            rows: dims.rows,
          });
          props.onResize?.(dims.cols, dims.rows);
        }
      } catch (_) {}
    });
    resizeObserver.observe(containerRef);
  });

  onCleanup(() => {
    if (statusInterval) clearInterval(statusInterval);
    unlistenOutput?.();
    unlistenExit?.();
    unlistenHookStatus?.();
    resizeObserver?.disconnect();
    terminal?.dispose();
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    />
  );
}

/**
 * Check if a hook's cwd matches the terminal's cwd.
 * Handles ~ expansion and trailing slash differences.
 */
function cwdMatches(hookCwd: string, termCwd: string): boolean {
  if (!hookCwd || !termCwd) return false;
  const home = "/Users/" + (hookCwd.split("/")[2] || "");
  const normalize = (p: string) =>
    p.replace(/^~/, home).replace(/\/+$/, "");
  return normalize(hookCwd) === normalize(termCwd);
}
