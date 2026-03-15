import { createSignal, For, Show, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { addTerminal, terminals, totalCost } from "../stores/terminalStore";
import { zoom, resetView } from "../stores/canvasStore";
import { timelineVisible, toggleTimeline } from "../stores/timelineStore";

export default function Toolbar() {
  const [showRecent, setShowRecent] = createSignal(false);
  const [recentDirs, setRecentDirs] = createSignal<string[]>([]);

  async function handleNewTerminal() {
    try {
      const offset = terminals.length * 30;
      const ptyId = await invoke<number>("create_pty", {
        cols: 80,
        rows: 24,
      });
      addTerminal(ptyId, 50 + offset, 50 + offset);
    } catch (e) {
      console.error("Failed to create terminal:", e);
    }
  }

  async function handleOpenRecent() {
    if (showRecent()) {
      setShowRecent(false);
      return;
    }
    try {
      const dirs = await invoke<string[]>("get_recent_directories");
      setRecentDirs(dirs);
      setShowRecent(true);
    } catch (e) {
      console.error("Failed to load recent directories:", e);
    }
  }

  async function handleSelectDir(dir: string) {
    setShowRecent(false);
    try {
      const offset = terminals.length * 30;
      const ptyId = await invoke<number>("create_pty", {
        cwd: dir,
        cols: 80,
        rows: 24,
      });
      addTerminal(ptyId, 50 + offset, 50 + offset);
      invoke("add_recent_directory", { dir });
    } catch (e) {
      console.error("Failed to create terminal:", e);
    }
  }

  // Close dropdown when clicking outside
  function handleGlobalClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".recent-dropdown-wrapper")) {
      setShowRecent(false);
    }
  }

  document.addEventListener("click", handleGlobalClick);
  onCleanup(() => document.removeEventListener("click", handleGlobalClick));

  function shortenPath(p: string): string {
    const home = "/Users/";
    if (p.startsWith(home)) {
      const rest = p.slice(home.length);
      const slashIdx = rest.indexOf("/");
      if (slashIdx !== -1) {
        return "~" + rest.slice(slashIdx);
      }
      return "~";
    }
    return p;
  }

  return (
    <div class="toolbar">
      <button class="toolbar-btn" onClick={handleNewTerminal}>
        + New Terminal
      </button>

      <div class="recent-dropdown-wrapper">
        <button class="toolbar-btn" onClick={handleOpenRecent}>
          Recent
        </button>
        <Show when={showRecent()}>
          <div class="recent-dropdown">
            <Show
              when={recentDirs().length > 0}
              fallback={<div class="recent-item empty">No recent directories</div>}
            >
              <For each={recentDirs()}>
                {(dir) => (
                  <button class="recent-item" onClick={() => handleSelectDir(dir)}>
                    {shortenPath(dir)}
                  </button>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>

      <span class="toolbar-separator" />

      <button
        class="toolbar-btn"
        classList={{ "toolbar-btn-active": timelineVisible() }}
        onClick={toggleTimeline}
      >
        Timeline
      </button>

      <div class="toolbar-spacer" />

      <Show when={totalCost() > 0}>
        <span class="toolbar-cost">Total: ${totalCost().toFixed(4)}</span>
      </Show>

      <span class="toolbar-zoom">{Math.round(zoom() * 100)}%</span>
      <button class="toolbar-btn" onClick={resetView}>
        Reset View
      </button>
    </div>
  );
}
