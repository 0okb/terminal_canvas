import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { ClaudeStatus, TerminalPaneData } from "../types";
import { recordStatusChange } from "./timelineStore";

let nextId = 1;

const [terminals, setTerminals] = createStore<TerminalPaneData[]>([]);
const [activeTerminalId, setActiveTerminalId] = createSignal<string | null>(null);

function addTerminal(ptyId: number, x: number, y: number, opts?: { width?: number; height?: number }): string {
  const id = `terminal-${nextId++}`;
  setTerminals(
    produce((ts) => {
      ts.push({
        id,
        ptyId,
        x,
        y,
        width: opts?.width ?? 600,
        height: opts?.height ?? 400,
        title: `Terminal ${ptyId}`,
        cwd: "",
        status: "idle" as ClaudeStatus,
        statusDetail: "",
        cost: 0,
      });
    })
  );
  setActiveTerminalId(id);
  return id;
}

function updateTerminalPosition(id: string, x: number, y: number) {
  setTerminals(
    (t) => t.id === id,
    produce((t) => {
      t.x = x;
      t.y = y;
    })
  );
}

function updateTerminalSize(id: string, width: number, height: number) {
  setTerminals(
    (t) => t.id === id,
    produce((t) => {
      t.width = Math.max(300, width);
      t.height = Math.max(200, height);
    })
  );
}

function updateTerminalTitle(id: string, title: string) {
  setTerminals(
    (t) => t.id === id,
    produce((t) => {
      t.title = title;
    })
  );
}

function updateTerminalCwd(id: string, cwd: string) {
  setTerminals(
    (t) => t.id === id,
    produce((t) => {
      t.cwd = cwd;
    })
  );
}

function updateTerminalStatus(id: string, status: ClaudeStatus, detail?: string) {
  // Find current status to check if changed
  const terminal = terminals.find((t) => t.id === id);
  if (terminal && terminal.status !== status) {
    recordStatusChange(id, status);
  }

  setTerminals(
    (t) => t.id === id,
    produce((t) => {
      t.status = status;
      t.statusDetail = detail ?? "";
    })
  );
}

function updateTerminalCost(id: string, cost: number) {
  setTerminals(
    (t) => t.id === id,
    produce((t) => {
      t.cost = cost;
    })
  );
}

function totalCost(): number {
  return terminals.reduce((sum, t) => sum + t.cost, 0);
}

function removeTerminal(id: string) {
  setTerminals((ts) => ts.filter((t) => t.id !== id));
  if (activeTerminalId() === id) {
    setActiveTerminalId(null);
  }
}

function clearAllTerminals() {
  setTerminals([]);
  setActiveTerminalId(null);
}

export {
  terminals,
  activeTerminalId,
  setActiveTerminalId,
  addTerminal,
  updateTerminalPosition,
  updateTerminalSize,
  updateTerminalTitle,
  updateTerminalCwd,
  updateTerminalStatus,
  updateTerminalCost,
  totalCost,
  removeTerminal,
  clearAllTerminals,
};
