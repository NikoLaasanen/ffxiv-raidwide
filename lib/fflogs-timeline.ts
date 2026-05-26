import { fflogsGraphQL } from "@/lib/fflogs-client";
import { isAutoAttack } from "@/lib/is-auto-attack";
import type {
  FFLogsEventsResponse,
  FFLogsRawEvent,
  FFLogsActor,
  FFLogsAbility,
} from "@/types/fflogs";
import type { TimelineRow, MechanicType, PlayerMistakeState } from "@/types/timeline";
import type { DamageType } from "@/types/common";
import type { JobAbbreviation } from "@/types/ffixiv-job";

export const FIGHT_META_QUERY = `
  query FightMeta($code: String!, $fightID: Int!) {
    reportData {
      report(code: $code) {
        fights(fightIDs: [$fightID]) { id name encounterID startTime endTime kill friendlyPlayers }
        masterData {
          actors { id name type subType }
          abilities { gameID name type }
        }
      }
    }
  }
`;

export const ALL_FIGHTS_QUERY = `
  query AllFights($code: String!) {
    reportData {
      report(code: $code) {
        fights { id name encounterID startTime endTime kill friendlyPlayers }
        masterData {
          actors { id name type subType }
          abilities { gameID name type }
        }
      }
    }
  }
`;

const EVENTS_QUERY = `
  query Events($code: String!, $fightID: Int!, $startTime: Float!, $dataType: EventDataType!) {
    reportData {
      report(code: $code) {
        events(fightIDs: [$fightID], startTime: $startTime, dataType: $dataType) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

export const SKIPPED_ABILITIES = new Set([
  "Combined DoTs",
  "Sustained Damage",
  "Explosion",
  "Unmitigated Explosion",
]);

export const TANK_JOBS = new Set<JobAbbreviation>(["PLD", "WAR", "DRK", "GNB"]);
export const ENRAGE_DAMAGE_THRESHOLD = 1_000_000;

export type InternalRow = Omit<TimelineRow, "playerMistakes"> & {
  playerMistakes: Record<string, PlayerMistakeState>;
  _targetIds: number[];
};

export async function fetchAllEvents(
  code: string,
  fightID: number,
  dataType: string
): Promise<FFLogsRawEvent[]> {
  const events: FFLogsRawEvent[] = [];
  let startTime = 0;

  while (true) {
    const data = await fflogsGraphQL<FFLogsEventsResponse>(EVENTS_QUERY, {
      code,
      fightID,
      startTime,
      dataType,
    });
    const page = data.reportData.report.events;
    const rawData = typeof page.data === "string" ? JSON.parse(page.data) : page.data;
    events.push(...(rawData as FFLogsRawEvent[]));
    if (page.nextPageTimestamp === null || page.nextPageTimestamp === undefined) break;
    startTime = page.nextPageTimestamp;
  }

  return events;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function mapDamageType(_fflogsType: number): DamageType {
  return "magical";
}

export function classifyMechanic(
  targetIds: number[],
  rawDamage: number | undefined,
  playerJobById: Map<number, JobAbbreviation>,
  tankbusterThreshold: number
): MechanicType {
  const hitCount = targetIds.length;
  if (hitCount === 0 || rawDamage === undefined) return "unknown";
  if (hitCount > 2) return "party";
  const allAreTanks = targetIds.every((id) => {
    const job = playerJobById.get(id);
    return job !== undefined && TANK_JOBS.has(job);
  });
  if (allAreTanks && rawDamage >= tankbusterThreshold) return "tankbuster";
  if (hitCount === 1) return "single";
  return "unknown";
}

export function groupBossHits(
  rawDamageTaken: FFLogsRawEvent[],
  bossActorIds: Set<number>,
  abilityByGameId: Map<number, FFLogsAbility>,
  fightStartTime: number
): FFLogsRawEvent[][] {
  const bossHits = rawDamageTaken
    .map((e) => ({ ...e, timestamp: e.timestamp - fightStartTime }))
    .filter((e) => {
      if (!bossActorIds.has(e.sourceID) || e.hitType === 2) return false;
      const name = abilityByGameId.get(e.abilityGameID)?.name;
      return !name || !SKIPPED_ABILITIES.has(name);
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const groups: FFLogsRawEvent[][] = [];
  let current: FFLogsRawEvent[] = [];
  let groupStart = -1;
  let groupAbilityId = -1;

  for (const event of bossHits) {
    const newAbility = event.abilityGameID !== groupAbilityId;
    const newWindow = event.timestamp - groupStart > 500;

    if (newAbility || newWindow) {
      if (current.length > 0) groups.push(current);
      current = [event];
      groupStart = event.timestamp;
      groupAbilityId = event.abilityGameID;
    } else {
      current.push(event);
    }
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

export function buildBaseTimeline(
  groups: FFLogsRawEvent[][],
  abilityByGameId: Map<number, FFLogsAbility>,
  actorById: Map<number, FFLogsActor>
): InternalRow[] {
  const rawRows: InternalRow[] = groups.map((group) => {
    const first = group[0];
    const abilityInfo = abilityByGameId.get(first.abilityGameID);
    const bossAbilityName = abilityInfo?.name ?? `Unknown (${first.abilityGameID})`;
    const allDamages = group
      .map((e) => e.unmitigatedAmount ?? e.amount ?? 0)
      .filter((d) => d > 0);
    const rawDamage = allDamages.length > 0 ? median(allDamages) : 0;

    return {
      timestamp: first.timestamp,
      bossAbility: bossAbilityName,
      sourceName: actorById.get(first.sourceID)?.name,
      damageEvent:
        rawDamage > 0
          ? { rawDamage, allDamages, type: abilityInfo ? mapDamageType(abilityInfo.type) : "magical" }
          : undefined,
      playerMistakes: {} as Record<string, PlayerMistakeState>,
      hidden: isAutoAttack(bossAbilityName),
      _targetIds: group.map((e) => e.targetID),
    };
  });

  // Merge rows with same ability name within 1000ms
  const timeline: InternalRow[] = [];
  for (const row of rawRows.sort((a, b) => a.timestamp - b.timestamp)) {
    let mergeTarget: InternalRow | null = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      const r = timeline[i];
      if (row.timestamp - r.timestamp > 1000) break;
      if (r.bossAbility === row.bossAbility) { mergeTarget = r; break; }
    }

    if (mergeTarget) {
      if (row.damageEvent && mergeTarget.damageEvent) {
        mergeTarget.damageEvent.allDamages.push(...row.damageEvent.allDamages);
        mergeTarget.damageEvent.rawDamage = median(mergeTarget.damageEvent.allDamages);
      } else if (row.damageEvent) {
        mergeTarget.damageEvent = { ...row.damageEvent, allDamages: [...row.damageEvent.allDamages] };
      }
      mergeTarget._targetIds.push(...row._targetIds);
    } else {
      timeline.push({
        ...row,
        damageEvent: row.damageEvent
          ? { ...row.damageEvent, allDamages: [...row.damageEvent.allDamages] }
          : undefined,
        _targetIds: [...row._targetIds],
      });
    }
  }

  return timeline;
}

export function computeTankbusterThreshold(timeline: InternalRow[]): number {
  const visibleDamages = timeline
    .filter((r) => !r.hidden && r.damageEvent?.rawDamage)
    .map((r) => r.damageEvent!.rawDamage);
  const avg =
    visibleDamages.length > 0
      ? visibleDamages.reduce((a, b) => a + b, 0) / visibleDamages.length
      : 0;
  return avg * 2;
}
