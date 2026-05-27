import type { JobAbbreviation } from "@/types/ffixiv-job";

export type AbilityTarget = "self" | "party" | "single";
export type AbilityType = "mitigation" | "utility" | "buff" | "interrupt" | "cleanse";

export interface XivApiAction {
  xivapiId: number;
  name: string;
  iconPath: string;
  cooldown: number;
  duration: number;
  isRoleAction: boolean;
  classJobCategory: Record<string, number | boolean>;
}

export interface JobAbilityRecord {
  id: string;
  xivapiId: number;
  jobs: JobAbbreviation[];
  name: string;
  iconPath: string;
  cooldown: number;
  duration: number;
  mitigationPhysical: number;
  mitigationMagical: number;
  target: AbilityTarget;
  abilityType: AbilityType;
  isRoleAction: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
