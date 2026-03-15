import { For, createSignal, onMount, onCleanup, Show } from "solid-js";
import { terminals } from "../stores/terminalStore";
import { timelineData } from "../stores/timelineStore";
import { theme } from "../stores/themeStore";
import type { ClaudeStatus, TimelineEntry } from "../types";

const TIMELINE_DURATION_MS = 30 * 60 * 1000; // 30 minutes


export default function TimelinePanel() {
  const [now, setNow] = createSignal(Date.now());
  let interval: ReturnType<typeof setInterval>;

  onMount(() => {
    interval = setInterval(() => setNow(Date.now()), 1000);
  });
  onCleanup(() => clearInterval(interval));

  const timeStart = () => now() - TIMELINE_DURATION_MS;

  function toPercent(time: number): number {
    return ((time - timeStart()) / TIMELINE_DURATION_MS) * 100;
  }

  function statusColor(status: ClaudeStatus): string {
    const colors = theme().status;
    return colors[status] ?? colors.idle;
  }

  function formatTimeAgo(ms: number): string {
    const mins = Math.round(ms / 60000);
    if (mins === 0) return "now";
    return `${mins}m ago`;
  }

  // Generate time axis marks every 5 minutes
  function timeMarks(): { label: string; percent: number }[] {
    const marks: { label: string; percent: number }[] = [];
    for (let i = 0; i <= 6; i++) {
      const agoMs = i * 5 * 60 * 1000;
      const time = now() - agoMs;
      const pct = toPercent(time);
      if (pct >= 0) {
        marks.push({ label: formatTimeAgo(agoMs), percent: pct });
      }
    }
    return marks;
  }

  return (
    <div class="timeline-panel">
      <div class="timeline-header">
        <span class="timeline-title">Timeline (30min)</span>
      </div>
      <div class="timeline-body">
        <div class="timeline-tracks">
          <For each={terminals}>
            {(terminal) => {
              const entries = () => timelineData[terminal.id] ?? [];
              return (
                <div class="timeline-row">
                  <div class="timeline-label" title={terminal.title}>
                    {terminal.title || terminal.id}
                  </div>
                  <div class="timeline-track">
                    <For each={entries()}>
                      {(entry: TimelineEntry) => {
                        const start = () => Math.max(0, toPercent(entry.startTime));
                        const end = () => toPercent(entry.endTime ?? now());
                        const width = () => Math.max(0.2, end() - start());
                        return (
                          <Show when={end() > 0 && start() < 100}>
                            <div
                              class="timeline-segment"
                              style={{
                                left: `${start()}%`,
                                width: `${width()}%`,
                                background: statusColor(entry.status),
                              }}
                              title={entry.status}
                            />
                          </Show>
                        );
                      }}
                    </For>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
        <div class="timeline-axis">
          <For each={timeMarks()}>
            {(mark) => (
              <span class="timeline-mark" style={{ left: `${mark.percent}%` }}>
                {mark.label}
              </span>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
