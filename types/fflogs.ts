import type { Player, PhaseDivider } from "@/types/player";
import type { TimelineRow } from "@/types/timeline";
import type { EncounterType } from "@/types/encounter";

export interface FFLogsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface FFLogsActor {
  id: number;
  name: string;
  type: string;
  subType: string;
}

export interface FFLogsAbility {
  gameID: number;
  name: string;
  type: number;
}

export interface FFLogsFight {
  id: number;
  name: string;
  encounterID: number;
  startTime: number;
  endTime: number;
  kill: boolean | null;
  friendlyPlayers: number[];
}

export interface FFLogsRawEvent {
  timestamp: number;
  type: string;
  sourceID: number;
  targetID: number;
  abilityGameID: number;
  sourceInstance?: number;
  amount?: number;
  unmitigatedAmount?: number;
  absorbed?: number;
  hitType?: number;
  duration?: number;
}

export interface FFLogsMetaResponse {
  reportData: {
    report: {
      fights: FFLogsFight[];
      masterData: {
        actors: FFLogsActor[];
        abilities: FFLogsAbility[];
      };
    };
  };
}

export interface FFLogsEventsResponse {
  reportData: {
    report: {
      events: {
        data: FFLogsRawEvent[] | string;
        nextPageTimestamp: number | null;
      };
    };
  };
}

export interface PlayerCastEvent {
  playerId: string;
  abilityGameId: number;
  abilityName: string;
  timestamp: number;
}

export interface FflogsImportResult {
  reportCode: string;
  fight: FFLogsFight;
  players: Player[];
  timeline: TimelineRow[];
  casts: PlayerCastEvent[];
  encounterId: string | null;
  encounterType: EncounterType | null;
  encounterTier: string | null;
  phases: PhaseDivider[];
}
