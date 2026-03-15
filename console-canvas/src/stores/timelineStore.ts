import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { ClaudeStatus, TimelineEntry } from "../types";

// Timeline data: terminalId -> entries
const [timelineData, setTimelineData] = createStore<Record<string, TimelineEntry[]>>({});
const [timelineVisible, setTimelineVisible] = createSignal(false);

function toggleTimeline() {
  setTimelineVisible(!timelineVisible());
}

function recordStatusChange(terminalId: string, status: ClaudeStatus) {
  const now = Date.now();

  setTimelineData(
    produce((data) => {
      if (!data[terminalId]) {
        data[terminalId] = [];
      }
      const entries = data[terminalId];

      // Close the previous entry
      if (entries.length > 0) {
        const last = entries[entries.length - 1];
        if (last.endTime === null) {
          last.endTime = now;
        }
      }

      // Add new entry
      entries.push({
        status,
        startTime: now,
        endTime: null,
      });

      // Keep only last 30 minutes of data
      const cutoff = now - 30 * 60 * 1000;
      const firstValid = entries.findIndex(
        (e) => (e.endTime ?? now) > cutoff
      );
      if (firstValid > 0) {
        entries.splice(0, firstValid);
      }
    })
  );
}

export {
  timelineData,
  timelineVisible,
  toggleTimeline,
  recordStatusChange,
};
