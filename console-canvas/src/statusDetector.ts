import type { Terminal } from "@xterm/xterm";
import type { ClaudeStatus } from "./types";

interface StatusPattern {
  status: ClaudeStatus;
  patterns: RegExp[];
}

// Patterns are checked in priority order (first match wins).
// These match against the RENDERED screen content of xterm.js,
// not raw PTY output, so they see exactly what the user sees.
const STATUS_PATTERNS: StatusPattern[] = [
  {
    // Highest priority: anything waiting for user confirmation
    status: "permission",
    patterns: [
      /Allow/,
      /Deny/,
      /allow this/i,
      /Do you want to/i,
      /overwrite/i,
      /replace\?/i,
      /Press .* to allow/i,
      /\(y\/n\)/i,
      /\(Y\/n\)/i,
      /\(yes\/no\)/i,
      /Yes\s*\/\s*No/i,
      /\[Y\/n\]/i,
      /\[yes\/no\]/i,
      /confirm/i,
      /Are you sure/i,
    ],
  },
  {
    status: "error",
    patterns: [
      /\bError\b/,
      /\bERROR\b/,
      /\berror:/,
      /\bFailed\b/,
      /\bfailed\b/,
      /\bPanic\b/,
      /error occurred/i,
      /command failed/i,
    ],
  },
  {
    // Spinner characters indicate Claude is actively working
    // (could be thinking or running tools — both are "not idle")
    status: "thinking",
    patterns: [
      /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/,
      /[⣾⣽⣻⢿⡿⣟⣯⣷]/,
      /[◐◓◑◒]/,
      /[⠁⠂⠄⡀⢀⠠⠐⠈]/,
      /Thinking/i,
      /◇/,
      /[━]/,
    ],
  },
];

/**
 * Read the visible screen content from xterm.js buffer.
 * This reads what is actually rendered on screen, which is
 * far more reliable than parsing raw PTY escape sequences.
 */
function readScreenContent(terminal: Terminal): string {
  const buf = terminal.buffer.active;
  const lines: string[] = [];
  const rowCount = terminal.rows;

  for (let i = 0; i < rowCount; i++) {
    const line = buf.getLine(buf.baseY + i);
    if (line) {
      lines.push(line.translateToString(true));
    }
  }

  return lines.join("\n");
}

/**
 * Detect Claude Code status from the current terminal screen.
 * Called periodically every 500ms.
 * This is the fallback detector — hooks provide more precise status.
 */
export function detectStatus(terminal: Terminal): ClaudeStatus {
  const screen = readScreenContent(terminal);

  for (const { status, patterns } of STATUS_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(screen)) {
        return status;
      }
    }
  }

  return "idle";
}

export const STATUS_LABELS: Record<ClaudeStatus, string> = {
  idle: "Idle",
  thinking: "Thinking...",
  tool_running: "Running Tool",
  permission: "Awaiting Permission",
  error: "Error",
  completed: "Completed",
};
