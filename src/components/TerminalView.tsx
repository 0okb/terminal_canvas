import { onMount, onCleanup } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { theme } from "../stores/themeStore";
import { updateTerminalTitle, updateTerminalCwd, updateTerminalStatus } from "../stores/terminalStore";
import type { ClaudeStatusEvent, PtyOutput, PtyExit, TerminalStatus } from "../types";

const PTY_ACTIVITY_TIMEOUT_MS = 3000;

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
  let activityTimer: ReturnType<typeof setTimeout> | undefined;
  let exited = false;

  // Hook correlation
  let hookSessionId: string | null = null;
  let terminalCwd = "";
  // Current status set by hooks (permission/idle). null = no hook has fired.
  let hookStatus: TerminalStatus | null = null;

  function setStatus(status: TerminalStatus) {
    if (!exited) {
      updateTerminalStatus(props.terminalId, status);
    }
  }

  // Called when PTY output is received — means Claude (or shell) is active
  function onPtyActivity() {
    // If hook says "permission", don't override to running
    if (hookStatus === "permission") return;

    setStatus("running");

    // Reset the idle timer — if no output for N seconds, go back to idle
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
      // Only fall back to idle if hooks haven't set a specific status
      if (hookStatus !== "permission") {
        setStatus("idle");
      }
    }, PTY_ACTIVITY_TIMEOUT_MS);
  }

  // Called when a hook event (Stop or permission_prompt) is received
  function onHookEvent(status: TerminalStatus) {
    hookStatus = status;

    if (status === "idle") {
      // Stop hook: Claude finished. Clear activity timer and set idle immediately.
      if (activityTimer) clearTimeout(activityTimer);
      setStatus("idle");
    } else if (status === "permission") {
      // Permission hook: override any running state
      if (activityTimer) clearTimeout(activityTimer);
      setStatus("permission");
    }
  }

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

    terminal.onTitleChange((title) => {
      let dir = title.replace(/^.*?:/, "").trim();
      if (!dir) dir = title;
      if (/^[~\/]/.test(dir) || /^[A-Z]:[\\\/]/i.test(dir)) {
        updateTerminalTitle(props.terminalId, dir);
        updateTerminalCwd(props.terminalId, dir);
        terminalCwd = dir;
      }
    });

    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    });

    terminal.onData((data) => {
      invoke("write_pty", { ptyId: props.ptyId, data });
    });

    // PTY output → mark as running
    unlistenOutput = await listen<PtyOutput>("pty-output", (event) => {
      if (event.payload.pty_id === props.ptyId) {
        terminal.write(event.payload.data);
        onPtyActivity();
      }
    });

    unlistenExit = await listen<PtyExit>("pty-exit", (event) => {
      if (event.payload.pty_id === props.ptyId) {
        exited = true;
        if (activityTimer) clearTimeout(activityTimer);
        terminal.write(`\r\n\x1b[31m[Process exited with code ${event.payload.code}]\x1b[0m\r\n`);
        updateTerminalStatus(props.terminalId, "idle");
      }
    });

    // Hook events: Stop → idle, Notification(permission_prompt) → permission
    unlistenHookStatus = await listen<ClaudeStatusEvent>("claude-status", (event) => {
      if (exited) return;
      const evt = event.payload;

      // Correlate by session_id or cwd
      if (hookSessionId && evt.session_id === hookSessionId) {
        onHookEvent(evt.status as TerminalStatus);
      } else if (!hookSessionId && terminalCwd && cwdMatches(evt.cwd, terminalCwd)) {
        hookSessionId = evt.session_id;
        onHookEvent(evt.status as TerminalStatus);
      }
    });

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
    if (activityTimer) clearTimeout(activityTimer);
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

function cwdMatches(hookCwd: string, termCwd: string): boolean {
  if (!hookCwd || !termCwd) return false;
  const normalize = (p: string) => {
    let norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
    if (norm.startsWith("~")) {
      const homeMatch = hookCwd.replace(/\\/g, "/").match(/^([A-Z]:)?\/(?:Users|home)\/[^/]+/i)
        || termCwd.replace(/\\/g, "/").match(/^([A-Z]:)?\/(?:Users|home)\/[^/]+/i);
      if (homeMatch) {
        norm = norm.replace(/^~/, homeMatch[0]);
      }
    }
    return norm.toLowerCase();
  };
  return normalize(hookCwd) === normalize(termCwd);
}
