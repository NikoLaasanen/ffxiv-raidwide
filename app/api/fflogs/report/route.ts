import { fflogsGraphQL } from "@/lib/fflogs-client";
import type {
  FFLogsMetaResponse,
  FFLogsEventsResponse,
  FFLogsRawEvent,
  FFLogsActor,
  FFLogsAbility,
  FFLogsFight,
  PlayerCastEvent,
} from "@/types/fflogs";
import type { Player } from "@/types/player";
import type { TimelineRow, PlayerMistakeState, MechanicType } from "@/types/timeline";
import type { DamageType } from "@/types/common";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import { FFLOGS_JOB_MAP } from "@/lib/jobs";

const FIGHT_META_QUERY = `
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

async function fetchAllEvents(
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function mapDamageType(fflogsType: number): DamageType {
  if (fflogsType & 64) return "magical";
  if (fflogsType & 1024) return "unique";
  return "magical";
}

const TANK_JOBS = new Set<JobAbbreviation>(["PLD", "WAR", "DRK", "GNB"]);
const ENRAGE_DAMAGE_THRESHOLD = 1_000_000;

type InternalRow = TimelineRow & { _targetIds: number[] };

function classifyMechanic(
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

function findClosestRow(timeline: InternalRow[], timestamp: number, windowMs: number): InternalRow | null {
  let bestNonHidden: InternalRow | null = null;
  let minNonHidden = Infinity;
  let bestAny: InternalRow | null = null;
  let minAny = Infinity;

  for (const row of timeline) {
    const diff = Math.abs(row.timestamp - timestamp);
    if (diff > windowMs) continue;
    if (diff < minAny) { minAny = diff; bestAny = row; }
    if (!row.hidden && diff < minNonHidden) { minNonHidden = diff; bestNonHidden = row; }
  }

  return bestNonHidden ?? bestAny;
}

function normalizeTimeline(
  rawDamageTaken: FFLogsRawEvent[],
  rawDeaths: FFLogsRawEvent[],
  rawDebuffs: FFLogsRawEvent[],
  bossActorIds: Set<number>,
  abilityByGameId: Map<number, FFLogsAbility>,
  players: Player[],
  fightStartTime: number,
  actorById: Map<number, FFLogsActor>,
  playerJobById: Map<number, JobAbbreviation>,
  rawCasts: FFLogsRawEvent[]
): TimelineRow[] {
  const normalize = (e: FFLogsRawEvent): FFLogsRawEvent => ({
    ...e,
    timestamp: e.timestamp - fightStartTime,
  });
  const damageTaken = rawDamageTaken.map(normalize);
  const deaths = rawDeaths.map(normalize);
  const debuffs = rawDebuffs.map(normalize);

  const SKIPPED_ABILITIES = new Set(["Combined DoTs", "Sustained Damage", "Explosion", "Unmitigated Explosion"]);

  const bossHits = damageTaken
    .filter((e) => {
      if (!bossActorIds.has(e.sourceID) || e.hitType === 2) return false;
      const name = abilityByGameId.get(e.abilityGameID)?.name;
      return !name || !SKIPPED_ABILITIES.has(name);
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const groups: FFLogsRawEvent[][] = [];
  let currentGroup: FFLogsRawEvent[] = [];
  let groupStart = -1;
  let groupAbilityId = -1;

  for (const event of bossHits) {
    const newAbility = event.abilityGameID !== groupAbilityId;
    const newWindow = event.timestamp - groupStart > 500;

    if (newAbility || newWindow) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [event];
      groupStart = event.timestamp;
      groupAbilityId = event.abilityGameID;
    } else {
      currentGroup.push(event);
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const playerMistakesBase = (): Record<string, PlayerMistakeState> =>
    Object.fromEntries(
      players.map((p) => [p.id, { dead: false, damageDown: false, weakness: false, brinkOfDeath: false, deadGray: false }])
    );

  const rawTimeline: InternalRow[] = groups.map((group) => {
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
      playerMistakes: playerMistakesBase(),
      hidden: bossAbilityName === "Attack",
      _targetIds: group.map((e) => e.targetID),
    };
  });

  const sortedRaw = rawTimeline.sort((a, b) => a.timestamp - b.timestamp);
  const timeline: InternalRow[] = [];
  for (const row of sortedRaw) {
    let mergeTarget: InternalRow | null = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      const r = timeline[i];
      if (row.timestamp - r.timestamp > 1000) break;
      if (r.bossAbility === row.bossAbility) {
        mergeTarget = r;
        break;
      }
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

  // Compute fight-relative tank buster threshold (2× average damage across non-hidden rows)
  const visibleDamages = timeline
    .filter((r) => !r.hidden && r.damageEvent?.rawDamage)
    .map((r) => r.damageEvent!.rawDamage);
  const avgDamage =
    visibleDamages.length > 0
      ? visibleDamages.reduce((a, b) => a + b, 0) / visibleDamages.length
      : 0;
  const tankbusterThreshold = avgDamage * 2;

  for (const row of timeline) {
    row.mechanicType = classifyMechanic(row._targetIds, row.damageEvent?.rawDamage, playerJobById, tankbusterThreshold);
  }
  const lastRow = [...timeline].reverse().find((r) => !r.hidden);
  if (lastRow && (lastRow.damageEvent?.rawDamage ?? 0) > ENRAGE_DAMAGE_THRESHOLD) {
    lastRow.mechanicType = "enrage";
  }

  const playerIdSet = new Set(players.map((p) => p.id));

  const playerCastMap = new Map<string, number[]>();
  for (const event of rawCasts) {
    if (event.type !== "cast") continue;
    const playerId = String(event.sourceID);
    if (!playerIdSet.has(playerId)) continue;
    const ts = event.timestamp - fightStartTime;
    const arr = playerCastMap.get(playerId) ?? [];
    arr.push(ts);
    playerCastMap.set(playerId, arr);
  }
  for (const arr of playerCastMap.values()) arr.sort((a, b) => a - b);

  for (const event of deaths) {
    if (event.type !== "death") continue;
    const playerId = String(event.targetID);
    if (!playerIdSet.has(playerId)) continue;
    const row = findClosestRow(timeline, event.timestamp, 5000);
    if (row) {
      row.playerMistakes[playerId].dead = true;
      row.playerMistakes[playerId].deathTimestamp = event.timestamp;
    }
  }

  const DURATION_TRACKED = new Set(["Weakness", "Brink of Death", "Damage Down"]);
  const DEBUFF_DEFAULTS: Record<string, number> = { "Weakness": 100, "Brink of Death": 100, "Damage Down": 600 };

  type PendingDebuff = { applyTimestamp: number; playerId: string; abilityName: string };
  const pending = new Map<string, PendingDebuff>();
  type FinalizedDebuff = { playerId: string; abilityName: string; applyTimestamp: number; duration: number };
  const finalized: FinalizedDebuff[] = [];

  const sortedDebuffs = [...debuffs].sort((a, b) => a.timestamp - b.timestamp);

  for (const event of sortedDebuffs) {
    const playerId = String(event.targetID);
    if (!playerIdSet.has(playerId)) continue;
    const ability = abilityByGameId.get(event.abilityGameID);
    if (!ability || !DURATION_TRACKED.has(ability.name)) continue;

    const key = `${event.targetID}|${event.abilityGameID}`;

    if (event.type === "applydebuff") {
      pending.set(key, { applyTimestamp: event.timestamp, playerId, abilityName: ability.name });
    } else if (event.type === "removedebuff") {
      const p = pending.get(key);
      if (p) {
        finalized.push({ playerId: p.playerId, abilityName: p.abilityName, applyTimestamp: p.applyTimestamp, duration: (event.timestamp - p.applyTimestamp) / 1000 });
        pending.delete(key);
      }
    }
  }

  for (const [, p] of pending) {
    finalized.push({ playerId: p.playerId, abilityName: p.abilityName, applyTimestamp: p.applyTimestamp, duration: DEBUFF_DEFAULTS[p.abilityName] ?? 60 });
  }

  for (const d of finalized) {
    const applyRow = findClosestRow(timeline, d.applyTimestamp, 3000);
    if (!applyRow) continue;
    const applyMs = applyRow.playerMistakes[d.playerId];
    if (!applyMs) continue;

    const activeUntil = d.applyTimestamp + d.duration * 1000;

    if (d.abilityName === "Damage Down") {
      applyMs.damageDown = true; applyMs.damageDownDuration = d.duration; applyMs.damageDownTimestamp = d.applyTimestamp;
      for (const row of timeline) {
        if (row === applyRow) continue;
        if (row.timestamp > applyRow.timestamp && row.timestamp <= activeUntil) {
          const ms = row.playerMistakes[d.playerId];
          if (ms) ms.damageDown = true;
        }
      }
    } else if (d.abilityName === "Weakness") {
      applyMs.weakness = true; applyMs.weaknessDuration = d.duration; applyMs.weaknessTimestamp = d.applyTimestamp;
      for (const row of timeline) {
        if (row === applyRow) continue;
        if (row.timestamp > applyRow.timestamp && row.timestamp <= activeUntil) {
          const ms = row.playerMistakes[d.playerId];
          if (ms) ms.weakness = true;
        }
      }
    } else if (d.abilityName === "Brink of Death") {
      applyMs.brinkOfDeath = true; applyMs.brinkOfDeathDuration = d.duration; applyMs.brinkOfDeathTimestamp = d.applyTimestamp;
      for (const row of timeline) {
        if (row === applyRow) continue;
        if (row.timestamp > applyRow.timestamp && row.timestamp <= activeUntil) {
          const ms = row.playerMistakes[d.playerId];
          if (ms) ms.brinkOfDeath = true;
        }
      }
    }
  }

  for (const player of players) {
    let inDeadPeriod = false;
    let nextActionTs = Infinity;
    for (const row of timeline) {
      const ms = row.playerMistakes[player.id];
      if (!ms) continue;
      if (ms.dead) {
        ms.deadGray = true;
        if (ms.weakness || ms.brinkOfDeath) {
          inDeadPeriod = false;
          nextActionTs = Infinity;
        } else {
          inDeadPeriod = true;
          const deathTs = ms.deathTimestamp ?? row.timestamp;
          const casts = playerCastMap.get(player.id) ?? [];
          const next = casts.find((t) => t > deathTs);
          nextActionTs = next ?? Infinity;
        }
      } else if (inDeadPeriod) {
        if (ms.weakness || ms.brinkOfDeath || row.timestamp >= nextActionTs) {
          inDeadPeriod = false;
          nextActionTs = Infinity;
        } else {
          ms.deadGray = true;
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return timeline.map(({ _targetIds, ...rest }) => rest);
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { reportCode?: unknown; fightId?: unknown };
  const { reportCode, fightId } = body;

  if (typeof reportCode !== "string" || !reportCode) {
    return Response.json({ error: "reportCode must be a non-empty string" }, { status: 400 });
  }
  if (!Number.isInteger(fightId) || (fightId as number) < 1) {
    return Response.json({ error: "fightId must be a positive integer" }, { status: 400 });
  }

  try {
    const meta = await fflogsGraphQL<FFLogsMetaResponse>(FIGHT_META_QUERY, {
      code: reportCode,
      fightID: fightId,
    });

    const report = meta.reportData.report;
    const fight: FFLogsFight | undefined = report.fights[0];

    if (!fight) {
      return Response.json({ error: "Fight not found in report" }, { status: 404 });
    }

    const actors: FFLogsActor[] = report.masterData.actors;
    const abilities: FFLogsAbility[] = report.masterData.abilities;

    const abilityByGameId = new Map(abilities.map((a) => [a.gameID, a]));
    const actorById = new Map(actors.map((a) => [a.id, a]));
    const bossActorIds = new Set(
      actors.filter((a) => a.type === "NPC" && a.name !== "Environment").map((a) => a.id)
    );
    const friendlyPlayerIds = new Set(fight.friendlyPlayers);
    const playerActors = actors.filter(
      (a) => a.type === "Player" && a.subType !== "LimitBreak" && friendlyPlayerIds.has(a.id)
    );

    const players: Player[] = playerActors.map((a) => ({
      id: String(a.id),
      job: (FFLOGS_JOB_MAP[a.subType] ?? a.subType) as JobAbbreviation,
      abilities: [],
      mistakeColumnsEnabled: true,
    }));

    const playerJobById = new Map(
      playerActors.map((a) => [a.id, (FFLOGS_JOB_MAP[a.subType] ?? a.subType) as JobAbbreviation])
    );

    const playerActorIdSet = new Set(playerActors.map((a) => a.id));

    const [damageTaken, deaths, debuffs, rawCasts] = await Promise.all([
      fetchAllEvents(reportCode, fightId as number, "DamageTaken"),
      fetchAllEvents(reportCode, fightId as number, "Deaths"),
      fetchAllEvents(reportCode, fightId as number, "Debuffs"),
      fetchAllEvents(reportCode, fightId as number, "Casts"),
    ]);

    const timeline = normalizeTimeline(
      damageTaken,
      deaths,
      debuffs,
      bossActorIds,
      abilityByGameId,
      players,
      fight.startTime,
      actorById,
      playerJobById,
      rawCasts
    );

    const casts: PlayerCastEvent[] = rawCasts
      .filter((e) => e.type === "cast" && playerActorIdSet.has(e.sourceID))
      .map((e) => ({
        playerId: String(e.sourceID),
        abilityGameId: e.abilityGameID,
        abilityName: abilityByGameId.get(e.abilityGameID)?.name ?? `Unknown (${e.abilityGameID})`,
        timestamp: e.timestamp - fight.startTime,
      }));

    return Response.json({ fight, players, timeline, casts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
