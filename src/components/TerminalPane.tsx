import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import TerminalView from "./TerminalView";
import {
  activeTerminalId,
  setActiveTerminalId,
  updateTerminalPosition,
  updateTerminalSize,
  removeTerminal,
} from "../stores/terminalStore";
import { zoom } from "../stores/canvasStore";
import type { TerminalPaneData } from "../types";

const STATUS_COLORS: Record<string, string> = {
  idle: "#555555",
  running: "#f0c674",
  permission: "#cc6666",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  running: "Running",
  permission: "Awaiting Permission",
};

interface TerminalPaneProps {
  data: TerminalPaneData;
}

export default function TerminalPane(props: TerminalPaneProps) {
  const [, setIsDragging] = createSignal(false);
  const [, setIsResizing] = createSignal(false);
  let dragStartX = 0;
  let dragStartY = 0;
  let initialX = 0;
  let initialY = 0;
  let initialW = 0;
  let initialH = 0;

  const isActive = () => activeTerminalId() === props.data.id;
  const statusColor = () => STATUS_COLORS[props.data.status] ?? STATUS_COLORS.idle;
  const statusLabel = () => STATUS_LABELS[props.data.status] ?? "Idle";

  function handleTitleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveTerminalId(props.data.id);
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialX = props.data.x;
    initialY = props.data.y;

    const onMove = (ev: MouseEvent) => {
      const z = zoom();
      const dx = (ev.clientX - dragStartX) / z;
      const dy = (ev.clientY - dragStartY) / z;
      updateTerminalPosition(props.data.id, initialX + dx, initialY + dy);
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleResizeMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialW = props.data.width;
    initialH = props.data.height;

    const onMove = (ev: MouseEvent) => {
      const z = zoom();
      const dw = (ev.clientX - dragStartX) / z;
      const dh = (ev.clientY - dragStartY) / z;
      updateTerminalSize(props.data.id, initialW + dw, initialH + dh);
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleClose() {
    invoke("close_pty", { ptyId: props.data.ptyId });
    removeTerminal(props.data.id);
  }

  function handlePaneClick(_e: MouseEvent) {
    setActiveTerminalId(props.data.id);
  }

  return (
    <div
      class="terminal-pane"
      classList={{
        active: isActive(),
        "status-running": props.data.status === "running",
        "status-permission": props.data.status === "permission",
      }}
      style={{
        position: "absolute",
        left: `${props.data.x}px`,
        top: `${props.data.y}px`,
        width: `${props.data.width}px`,
        height: `${props.data.height}px`,
        "border-color": statusColor(),
      }}
      onMouseDown={handlePaneClick}
    >
      <div class="terminal-titlebar" onMouseDown={handleTitleMouseDown}>
        <span class="terminal-title">{props.data.title}</span>
        <div class="terminal-titlebar-right">
          <span class="terminal-status-badge" style={{ background: statusColor() }}>
            {statusLabel()}
          </span>
          <button class="terminal-close" onClick={handleClose}>
            x
          </button>
        </div>
      </div>

      <div class="terminal-content">
        <TerminalView ptyId={props.data.ptyId} terminalId={props.data.id} />
      </div>

      <div class="terminal-resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
