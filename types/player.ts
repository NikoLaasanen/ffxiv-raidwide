import type { DamageType } from "@/types/common";
import type { JobAbbreviation } from "@/types/ffixiv-job";

export interface Ability {
  id: string;
  name: string;
  cooldown: number;
  duration: number;
  mitigationPercent: number;
  type: DamageType | "all";
  target: "self" | "party" | "tank";
  enabled: boolean;
}

export interface Player {
  id: string;
  job: JobAbbreviation;
  abilities: Ability[];
  mistakeColumnsEnabled: boolean;
}

export interface PhaseDivider {
  timestamp: number;
  name: string;
  collapsed: boolean;
}
