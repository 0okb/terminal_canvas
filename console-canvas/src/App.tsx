import { onMount, onCleanup, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import Canvas from "./components/Canvas";
import Toolbar from "./components/Toolbar";
import TimelinePanel from "./components/TimelinePanel";
import { theme, themeLoaded, loadTheme, applyUiTheme } from "./stores/themeStore";
import { terminals, addTerminal } from "./stores/terminalStore";
import { panX, panY, zoom, setPanX, setPanY, setZoom } from "./stores/canvasStore";
import { timelineVisible } from "./stores/timelineStore";
import type { WorkspaceData } from "./types";
import "./App.css";

function App() {
  let autoSaveInterval: ReturnType<typeof setInterval>;

  onMount(async () => {
    await loadTheme();
    applyUiTheme(theme().ui);

    // Auto-restore workspace
    try {
      const data = await invoke<WorkspaceData | null>("load_workspace");
      if (data && data.terminals.length > 0) {
        setPanX(data.canvas.pan_x);
        setPanY(data.canvas.pan_y);
        setZoom(data.canvas.zoom);

        for (const entry of data.terminals) {
          const ptyId = await invoke<number>("create_pty", {
            cwd: entry.cwd || undefined,
            cols: 80,
            rows: 24,
          });
          addTerminal(ptyId, entry.x, entry.y, {
            width: entry.width,
            height: entry.height,
          });
        }
      }
    } catch (e) {
      console.error("Failed to restore workspace:", e);
    }

    // Auto-save workspace every 30 seconds
    autoSaveInterval = setInterval(() => {
      if (terminals.length === 0) return;
      const data: WorkspaceData = {
        canvas: { pan_x: panX(), pan_y: panY(), zoom: zoom() },
        terminals: terminals.map((t) => ({
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
          cwd: t.cwd || "",
        })),
      };
      invoke("save_workspace", { data }).catch(() => {});
    }, 30000);

    // Save on window close
    window.addEventListener("beforeunload", saveWorkspaceSync);
  });

  onCleanup(() => {
    clearInterval(autoSaveInterval);
    window.removeEventListener("beforeunload", saveWorkspaceSync);
  });

  function saveWorkspaceSync() {
    if (terminals.length === 0) return;
    const data: WorkspaceData = {
      canvas: { pan_x: panX(), pan_y: panY(), zoom: zoom() },
      terminals: terminals.map((t) => ({
        x: t.x,
        y: t.y,
        width: t.width,
        height: t.height,
        cwd: t.cwd || "",
      })),
    };
    invoke("save_workspace", { data }).catch(() => {});
  }

  return (
    <Show when={themeLoaded()}>
      <div class="app">
        <Toolbar />
        <Canvas />
        <Show when={timelineVisible()}>
          <TimelinePanel />
        </Show>
      </div>
    </Show>
  );
}

export default App;
