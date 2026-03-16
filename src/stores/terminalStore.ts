import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { TerminalPaneData, TerminalStatus } from "../types";

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
        status: "idle" as TerminalStatus,
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

function updateTerminalStatus(id: string, status: TerminalStatus) {
  setTerminals(
    (t) => t.id === id,
    produce((t) => {
      t.status = status;
    })
  );
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
  removeTerminal,
  clearAllTerminals,
};
