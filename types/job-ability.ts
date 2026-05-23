import type { JobAbbreviation } from "@/types/ffixiv-job";

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
  target: "self" | "party" | "single";
  abilityType: "mitigation" | "utility" | "buff" | "interrupt";
  isRoleAction: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
