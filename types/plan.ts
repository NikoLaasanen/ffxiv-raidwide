import type { DamageType } from "@/types/common";
import type { Player, PhaseDivider } from "@/types/player";
import type { TimelineRow } from "@/types/timeline";

export type { DamageType };

export interface PlanSettings {
  hideAutoAttacks: boolean;
  showMitigationCalculations: boolean;
  defaultDamageType: DamageType;
}

export interface VersionEvent {
  timestamp: number;
  description: string;
  snapshot?: Plan;
}

export interface Plan {
  id: string;
  title: string;
  encounterId: string | null;
  raidplanLink: string | null;
  timeline: TimelineRow[];
  players: Player[];
  phases: PhaseDivider[];
  settings: PlanSettings;
  versionHistory: VersionEvent[];
  createdAt: number;
  updatedAt: number;
  editLinkId: string;
  viewLinkId: string;
}
