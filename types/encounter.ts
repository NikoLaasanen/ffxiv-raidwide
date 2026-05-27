import type { TimelineRow } from "@/types/timeline";
import type { PhaseDivider } from "@/types/player";

export type EncounterType = "Ultimate" | "Savage" | "Criterion" | "Other";

export interface EncounterDoc {
  id: string;
  name: string;
  type: EncounterType;
  tier: string;
  patch: string;
  timeline: TimelineRow[];
  phases: PhaseDivider[];
  createdAt: number;
  updatedAt: number;
}
