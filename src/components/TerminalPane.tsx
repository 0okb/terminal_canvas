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
import { theme } from "../stores/themeStore";
import { STATUS_LABELS } from "../statusDetector";
import type { TerminalPaneData } from "../types";

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

  const statusColor = () => {
    const colors = theme().status;
    return colors[props.data.status] ?? colors.idle;
  };

  const statusLabel = () => {
    const base = STATUS_LABELS[props.data.status] ?? "Unknown";
    if (props.data.status === "tool_running" && props.data.statusDetail) {
      return `${base}: ${props.data.statusDetail}`;
    }
    return base;
  };

  const isAnimated = () =>
    props.data.status === "thinking" ||
    props.data.status === "tool_running" ||
    props.data.status === "permission";

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
      classList={{ active: isActive(), "status-pulse": isAnimated() }}
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
      {/* Title bar */}
      <div class="terminal-titlebar" onMouseDown={handleTitleMouseDown}>
        <span class="terminal-title">{props.data.title}</span>
        <button class="terminal-close" onClick={handleClose}>
          x
        </button>
      </div>

      {/* Terminal content */}
      <div class="terminal-content">
        <TerminalView ptyId={props.data.ptyId} terminalId={props.data.id} />
      </div>

      {/* Status bar */}
      <div class="terminal-statusbar" style={{ "border-top-color": statusColor() }}>
        <span class="status-indicator" style={{ background: statusColor() }} />
        <span class="status-label">{statusLabel()}</span>
        {props.data.cost > 0 && (
          <span class="status-cost">${props.data.cost.toFixed(4)}</span>
        )}
      </div>

      {/* Resize handle */}
      <div class="terminal-resize-handle" onMouseDown={handleResizeMouseDown} />
    </div>
  );
}
