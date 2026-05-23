import type { DamageType } from "@/types/common";

export interface DamageEvent {
  rawDamage: number;
  allDamages: number[];
  type: DamageType;
  overriddenType?: boolean;
}

export interface PlayerMistakeState {
  dead: boolean;
  deathTimestamp?: number;
  damageDown: boolean;
  damageDownDuration?: number;
  damageDownTimestamp?: number;
  weakness: boolean;
  weaknessDuration?: number;
  weaknessTimestamp?: number;
  brinkOfDeath: boolean;
  brinkOfDeathDuration?: number;
  brinkOfDeathTimestamp?: number;
  deadGray?: boolean;
}

export type MechanicType = "enrage" | "tankbuster" | "party" | "single" | "unknown";

export interface TimelineRow {
  timestamp: number;
  bossAbility: string;
  damageEvent?: DamageEvent;
  playerMistakes: Record<string, PlayerMistakeState>;
  hidden: boolean;
  sourceName?: string;
  mechanicType?: MechanicType;
}

export interface MitigationAssignment {
  playerId: string;
  abilityId: string;
  timestamp: number;
}
