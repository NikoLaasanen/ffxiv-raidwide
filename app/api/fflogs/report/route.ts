import type {
  FFLogsMetaResponse,
  FFLogsRawEvent,
  FFLogsActor,
  FFLogsAbility,
  FFLogsFight,
  PlayerCastEvent,
} from "@/types/fflogs";
import type { Player, PhaseDivider } from "@/types/player";
import type { TimelineRow, PlayerMistakeState } from "@/types/timeline";
import type { DamageType } from "@/types/common";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import { fflogsGraphQL } from "@/lib/fflogs-client";
import { FFLOGS_JOB_MAP } from "@/lib/jobs";
import { adminDb } from "@/lib/firebase-admin";
import { apiError } from "@/lib/api-error";
import { COLLECTIONS } from "@/lib/db-collections";
import {
  FIGHT_META_QUERY,
  ALL_FIGHTS_QUERY,
  fetchAllEvents,
  groupBossHits,
  buildBaseTimeline,
  classifyMechanic,
  computeTankbusterThreshold,
  ENRAGE_DAMAGE_THRESHOLD,
  InternalRow,
} from "@/lib/fflogs-timeline";

function findClosestRow(
  timeline: InternalRow[],
  timestamp: number,
  windowMs: number
): InternalRow | null {
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
  const groups = groupBossHits(rawDamageTaken, bossActorIds, abilityByGameId, fightStartTime);
  const baseTimeline = buildBaseTimeline(groups, abilityByGameId, actorById);

  const playerMistakesBase = (): Record<string, PlayerMistakeState> =>
    Object.fromEntries(
      players.map((p) => [p.id, { dead: false, damageDown: false, weakness: false, brinkOfDeath: false, deadGray: false }])
    );

  const timeline: InternalRow[] = baseTimeline.map((r) => ({ ...r, playerMistakes: playerMistakesBase() }));

  const tankbusterThreshold = computeTankbusterThreshold(baseTimeline);

  for (const row of timeline) {
    row.mechanicType = classifyMechanic(row._targetIds, row.damageEvent?.rawDamage, playerJobById, tankbusterThreshold);
  }
  const lastRow = [...timeline].reverse().find((r) => !r.hidden);
  if (lastRow && (lastRow.damageEvent?.rawDamage ?? 0) > ENRAGE_DAMAGE_THRESHOLD) {
    lastRow.mechanicType = "enrage";
  }

  const playerIdSet = new Set(players.map((p) => p.id));
  const normalize = (e: FFLogsRawEvent): FFLogsRawEvent => ({ ...e, timestamp: e.timestamp - fightStartTime });
  const deaths = rawDeaths.map(normalize);
  const debuffs = rawDebuffs.map(normalize);

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

   
  return timeline.map(({ _targetIds, ...rest }) => rest);
}

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { reportCode?: unknown; fightId?: unknown };
  const { reportCode, fightId } = body;

  if (typeof reportCode !== "string" || !reportCode) {
    return Response.json({ error: "reportCode must be a non-empty string" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9]{8,32}$/.test(reportCode)) {
    return Response.json({ error: "Invalid reportCode format" }, { status: 400 });
  }
  if (!Number.isInteger(fightId) || ((fightId as number) < 1 && fightId !== -1)) {
    return Response.json({ error: "fightId must be a positive integer" }, { status: 400 });
  }

  try {
    let resolvedFightId = fightId as number;
    let meta: FFLogsMetaResponse;

    if (resolvedFightId === -1) {
      const allMeta = await fflogsGraphQL<FFLogsMetaResponse>(ALL_FIGHTS_QUERY, { code: reportCode });
      const fights = allMeta.reportData.report.fights;
      if (!fights.length) {
        return Response.json({ error: "No fights found in report" }, { status: 404 });
      }
      resolvedFightId = fights[fights.length - 1].id;
      meta = {
        ...allMeta,
        reportData: {
          report: {
            ...allMeta.reportData.report,
            fights: [fights[fights.length - 1]],
          },
        },
      };
    } else {
      meta = await fflogsGraphQL<FFLogsMetaResponse>(FIGHT_META_QUERY, {
        code: reportCode,
        fightID: resolvedFightId,
      });
    }

    const report = meta.reportData.report;
    const fight: FFLogsFight | undefined = report.fights[0];

    if (!fight) {
      return Response.json({ error: "Fight not found in report" }, { status: 404 });
    }

    const actors = report.masterData.actors;
    const abilities = report.masterData.abilities;

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
      fetchAllEvents(reportCode, resolvedFightId, "DamageTaken"),
      fetchAllEvents(reportCode, resolvedFightId, "Deaths"),
      fetchAllEvents(reportCode, resolvedFightId, "Debuffs"),
      fetchAllEvents(reportCode, resolvedFightId, "Casts"),
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

    let encounterId: string | null = null;
    let encounterType: string | null = null;
    let encounterTier: string | null = null;
    let phases: PhaseDivider[] = [];

    const fightNameLower = fight.name.toLowerCase();
    const encounterSnap = await adminDb.collection(COLLECTIONS.ENCOUNTERS).get();
    const matchedDoc = encounterSnap.docs.find(
      (d) => (d.data().name as string).toLowerCase() === fightNameLower
    );

    if (matchedDoc) {
      const enc = matchedDoc.data();
      encounterId = matchedDoc.id;
      encounterType = (enc.type as string) ?? null;
      encounterTier = (enc.tier as string) ?? null;
      phases = (enc.phases ?? []) as PhaseDivider[];

      const encounterRows = (enc.timeline ?? []) as TimelineRow[];
      type AbilityMeta = { mechanicType?: TimelineRow["mechanicType"]; cleanse: boolean; interrupt: boolean; damageType?: DamageType };
      const metaByAbility = new Map<string, AbilityMeta>();
      for (const row of encounterRows) {
        const key = row.bossAbility.toLowerCase();
        if (!metaByAbility.has(key)) {
          metaByAbility.set(key, {
            mechanicType: row.mechanicType,
            cleanse: row.cleanse ?? false,
            interrupt: row.interrupt ?? false,
            damageType: row.damageEvent?.type,
          });
        }
      }

      for (const row of timeline) {
        const meta = metaByAbility.get(row.bossAbility.toLowerCase());
        if (!meta) continue;
        if (meta.mechanicType) row.mechanicType = meta.mechanicType;
        row.cleanse = meta.cleanse;
        row.interrupt = meta.interrupt;
        if (meta.damageType && row.damageEvent) row.damageEvent = { ...row.damageEvent, type: meta.damageType };
      }
    }

    return Response.json({ reportCode, fight, players, timeline, casts, encounterId, encounterType, encounterTier, phases });
  } catch (err) {
    return apiError(err);
  }
}
