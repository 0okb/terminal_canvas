import { For, createSignal } from "solid-js";
import TerminalPane from "./TerminalPane";
import { terminals } from "../stores/terminalStore";
import {
  panX,
  setPanX,
  panY,
  setPanY,
  zoom,
  applyZoom,
} from "../stores/canvasStore";

export default function Canvas() {
  let canvasRef!: HTMLDivElement;
  const [isPanning, setIsPanning] = createSignal(false);
  let panStartX = 0;
  let panStartY = 0;
  let panInitX = 0;
  let panInitY = 0;

  function handleMouseDown(e: MouseEvent) {
    // Middle button or Space+Left button for panning
    if (e.button === 1 || (e.button === 0 && e.target === canvasRef)) {
      if (e.button === 1 || e.target === canvasRef) {
        e.preventDefault();
        setIsPanning(true);
        panStartX = e.clientX;
        panStartY = e.clientY;
        panInitX = panX();
        panInitY = panY();
      }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (isPanning()) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      setPanX(panInitX + dx);
      setPanY(panInitY + dy);
    }
  }

  function handleMouseUp() {
    setIsPanning(false);
  }

  function handleWheel(e: WheelEvent) {
    const target = e.target as HTMLElement;
    const insidePane = target.closest(".terminal-pane");

    if (e.ctrlKey || e.metaKey) {
      // Zoom always works, even over terminal panes
      e.preventDefault();
      const delta = -e.deltaY * 0.005;
      applyZoom(delta, e.clientX, e.clientY);
    } else if (!insidePane) {
      // Pan only on canvas background
      e.preventDefault();
      setPanX(panX() - e.deltaX);
      setPanY(panY() - e.deltaY);
    }
  }

  return (
    <div
      ref={canvasRef}
      class="canvas"
      classList={{ panning: isPanning() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        class="canvas-content"
        style={{
          transform: `translate(${panX()}px, ${panY()}px) scale(${zoom()})`,
          "transform-origin": "0 0",
        }}
      >
        <For each={terminals}>
          {(terminal) => <TerminalPane data={terminal} />}
        </For>
      </div>
    </div>
  );
}
