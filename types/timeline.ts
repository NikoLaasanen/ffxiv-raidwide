import type { DamageType } from "@/types/common";

export interface DamageEvent {
  rawDamage: number;
  type: DamageType;
  overriddenType?: boolean;
}

export interface PlayerMistakeState {
  dead: boolean;
  damageDown: boolean;
  vulnerabilityStacks: number;
}

export interface TimelineRow {
  timestamp: number;
  bossAbility: string;
  damageEvent?: DamageEvent;
  playerMistakes: Record<string, PlayerMistakeState>;
  hidden: boolean;
}

export interface MitigationAssignment {
  playerId: string;
  abilityId: string;
  timestamp: number;
}
