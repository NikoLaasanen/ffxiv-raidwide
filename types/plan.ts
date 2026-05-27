import type { DamageType } from "@/types/common";
import type { Player, PhaseDivider } from "@/types/player";
import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { EncounterType } from "@/types/encounter";

export type { DamageType };

export interface PlanSettings {
  hideAutoAttacks: boolean;
  showMitigationCalculations: boolean;
  defaultDamageType: DamageType;
}

export interface Plan {
  id: string;
  title: string;
  encounterId: string | null;
  encounterType: EncounterType | null;
  encounterTier: string | null;
  raidplanLink: string | null;
  timeline: TimelineRow[];
  players: Player[];
  phases: PhaseDivider[];
  assignments?: MitigationAssignment[];
  createdAt: number;
  updatedAt: number;
  editLinkId: string;
  viewLinkId: string;
}
