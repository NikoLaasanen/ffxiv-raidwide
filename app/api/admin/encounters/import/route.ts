import { fflogsGraphQL } from "@/lib/fflogs-client";
import {
  FIGHT_META_QUERY,
  ALL_FIGHTS_QUERY,
  fetchAllEvents,
  groupBossHits,
  buildBaseTimeline,
  classifyMechanic,
  computeTankbusterThreshold,
  ENRAGE_DAMAGE_THRESHOLD,
} from "@/lib/fflogs-timeline";
import { FFLOGS_JOB_MAP } from "@/lib/jobs";
import type { FFLogsMetaResponse, FFLogsFight } from "@/types/fflogs";
import type { JobAbbreviation } from "@/types/ffixiv-job";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { reportCode?: unknown; fightId?: unknown };
  const { reportCode, fightId } = body;

  if (typeof reportCode !== "string" || !reportCode) {
    return Response.json({ error: "reportCode must be a non-empty string" }, { status: 400 });
  }
  if (!Number.isInteger(fightId) || ((fightId as number) < 1 && fightId !== -1)) {
    return Response.json({ error: "fightId must be a positive integer or -1" }, { status: 400 });
  }

  try {
    let resolvedFightId = fightId as number;
    let meta: FFLogsMetaResponse;

    if (resolvedFightId === -1) {
      const allMeta = await fflogsGraphQL<FFLogsMetaResponse>(ALL_FIGHTS_QUERY, { code: reportCode });
      const fights = allMeta.reportData.report.fights;
      if (!fights.length) return Response.json({ error: "No fights found in report" }, { status: 404 });
      resolvedFightId = fights[fights.length - 1].id;
      meta = { ...allMeta, reportData: { report: { ...allMeta.reportData.report, fights: [fights[fights.length - 1]] } } };
    } else {
      meta = await fflogsGraphQL<FFLogsMetaResponse>(FIGHT_META_QUERY, { code: reportCode, fightID: resolvedFightId });
    }

    const report = meta.reportData.report;
    const fight: FFLogsFight | undefined = report.fights[0];
    if (!fight) return Response.json({ error: "Fight not found in report" }, { status: 404 });

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
    const playerJobById = new Map(
      playerActors.map((a) => [a.id, (FFLOGS_JOB_MAP[a.subType] ?? a.subType) as JobAbbreviation])
    );

    const damageTaken = await fetchAllEvents(reportCode, resolvedFightId, "DamageTaken");
    const groups = groupBossHits(damageTaken, bossActorIds, abilityByGameId, fight.startTime);
    const baseTimeline = buildBaseTimeline(groups, abilityByGameId, actorById);
    const tankbusterThreshold = computeTankbusterThreshold(baseTimeline);

    for (const row of baseTimeline) {
      row.mechanicType = classifyMechanic(row._targetIds, row.damageEvent?.rawDamage, playerJobById, tankbusterThreshold);
    }
    const lastRow = [...baseTimeline].reverse().find((r) => !r.hidden);
    if (lastRow && (lastRow.damageEvent?.rawDamage ?? 0) > ENRAGE_DAMAGE_THRESHOLD) {
      lastRow.mechanicType = "enrage";
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const timeline = baseTimeline.map(({ _targetIds, damageEvent, ...rest }) => ({
      ...rest,
      playerMistakes: {},
      damageEvent: damageEvent ? { rawDamage: 0, allDamages: [], type: damageEvent.type } : undefined,
    }));

    return Response.json({ timeline, fightName: fight.name });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
