import { createSignal } from "solid-js";

const [panX, setPanX] = createSignal(0);
const [panY, setPanY] = createSignal(0);
const [zoom, setZoom] = createSignal(1);

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;

function applyZoom(delta: number, centerX: number, centerY: number) {
  const oldZoom = zoom();
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom + delta));
  if (newZoom === oldZoom) return;

  // Zoom towards the cursor position
  const scale = newZoom / oldZoom;
  setPanX(centerX - (centerX - panX()) * scale);
  setPanY(centerY - (centerY - panY()) * scale);
  setZoom(newZoom);
}

function resetView() {
  setPanX(0);
  setPanY(0);
  setZoom(1);
}

export { panX, setPanX, panY, setPanY, zoom, setZoom, applyZoom, resetView };
