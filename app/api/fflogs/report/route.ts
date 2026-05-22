import { fflogsGraphQL } from "@/lib/fflogs-client";
import type {
  FFLogsMetaResponse,
  FFLogsEventsResponse,
  FFLogsRawEvent,
  FFLogsActor,
  FFLogsAbility,
  FFLogsFight,
} from "@/types/fflogs";
import type { Player } from "@/types/player";
import type { TimelineRow, PlayerMistakeState } from "@/types/timeline";
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

function mapDamageType(fflogsType: number): DamageType {
  if (fflogsType & 64) return "magical";
  if (fflogsType & 1024) return "darkness";
  return "physical";
}

function findClosestRow(timeline: TimelineRow[], timestamp: number, windowMs: number): TimelineRow | null {
  let closest: TimelineRow | null = null;
  let minDiff = Infinity;

  for (const row of timeline) {
    const diff = Math.abs(row.timestamp - timestamp);
    if (diff < minDiff && diff <= windowMs) {
      minDiff = diff;
      closest = row;
    }
  }

  return closest;
}

function normalizeTimeline(
  rawDamageTaken: FFLogsRawEvent[],
  rawDeaths: FFLogsRawEvent[],
  rawDebuffs: FFLogsRawEvent[],
  bossActorIds: Set<number>,
  abilityByGameId: Map<number, FFLogsAbility>,
  players: Player[],
  fightStartTime: number
): TimelineRow[] {
  const normalize = (e: FFLogsRawEvent): FFLogsRawEvent => ({
    ...e,
    timestamp: e.timestamp - fightStartTime,
  });
  const damageTaken = rawDamageTaken.map(normalize);
  const deaths = rawDeaths.map(normalize);
  const debuffs = rawDebuffs.map(normalize);

  const bossHits = damageTaken
    .filter((e) => bossActorIds.has(e.sourceID) && e.hitType !== 2)
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
      players.map((p) => [p.id, { dead: false, damageDown: false, vulnerabilityStacks: 0 }])
    );

  const timeline: TimelineRow[] = groups.map((group) => {
    const first = group[0];
    const abilityInfo = abilityByGameId.get(first.abilityGameID);
    const bossAbilityName = abilityInfo?.name ?? `Unknown (${first.abilityGameID})`;
    const representative = group.find((e) => (e.unmitigatedAmount ?? e.amount ?? 0) > 0) ?? first;
    const rawDamage = representative.unmitigatedAmount ?? representative.amount ?? 0;

    return {
      timestamp: first.timestamp,
      bossAbility: bossAbilityName,
      damageEvent:
        rawDamage > 0
          ? {
              rawDamage,
              type: abilityInfo ? mapDamageType(abilityInfo.type) : "magical",
            }
          : undefined,
      playerMistakes: playerMistakesBase(),
      hidden: bossAbilityName === "Attack",
    };
  });

  const playerIdSet = new Set(players.map((p) => p.id));

  for (const event of deaths) {
    if (event.type !== "death") continue;
    const playerId = String(event.targetID);
    if (!playerIdSet.has(playerId)) continue;
    const row = findClosestRow(timeline, event.timestamp, 5000);
    if (row) row.playerMistakes[playerId].dead = true;
  }

  for (const event of debuffs) {
    if (event.type !== "applydebuff") continue;
    const playerId = String(event.targetID);
    if (!playerIdSet.has(playerId)) continue;
    const ability = abilityByGameId.get(event.abilityGameID);
    if (!ability) continue;
    const row = findClosestRow(timeline, event.timestamp, 3000);
    if (!row) continue;

    if (ability.name === "Damage Down") {
      row.playerMistakes[playerId].damageDown = true;
    } else if (/vulnerability/i.test(ability.name)) {
      row.playerMistakes[playerId].vulnerabilityStacks += 1;
    }
  }

  return timeline;
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

    const [damageTaken, deaths, debuffs] = await Promise.all([
      fetchAllEvents(reportCode, fightId as number, "DamageTaken"),
      fetchAllEvents(reportCode, fightId as number, "Deaths"),
      fetchAllEvents(reportCode, fightId as number, "Debuffs"),
    ]);

    const timeline = normalizeTimeline(
      damageTaken,
      deaths,
      debuffs,
      bossActorIds,
      abilityByGameId,
      players,
      fight.startTime
    );

    return Response.json({ fight, players, timeline });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
