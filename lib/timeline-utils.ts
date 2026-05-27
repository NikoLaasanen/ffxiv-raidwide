import type { TimelineRow } from "@/types/timeline";

export const getVisibleRows = (timeline: TimelineRow[]) => timeline.filter((r) => !r.hidden);
