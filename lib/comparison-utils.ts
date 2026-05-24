import type { Player } from "@/types/player";
import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { PlayerCastEvent } from "@/types/fflogs";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { Plan } from "@/types/plan";

export function parsePlanUrl(url: string): { kind: "view" | "edit"; id: string } | null {
  const viewMatch = /\/plan\/view\/([^/?#]+)/.exec(url);
  if (viewMatch) return { kind: "view", id: viewMatch[1] };
  const editMatch = /\/plan\/([^/?#]+)/.exec(url);
  if (editMatch) return { kind: "edit", id: editMatch[1] };
  return null;
}

export function castsToPlanAssignments({
  casts,
  fflogsPlayers,
  originalPlayers,
  originalTimeline,
  abilitiesByJob,
}: {
  casts: PlayerCastEvent[];
  fflogsPlayers: Player[];
  originalPlayers: Player[];
  originalTimeline: TimelineRow[];
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
}): MitigationAssignment[] {
  const jobToOriginal = new Map<JobAbbreviation, Player>(
    originalPlayers.map((p) => [p.job, p])
  );
  const fflogsIdToJob = new Map<string, JobAbbreviation>(
    fflogsPlayers.map((p) => [p.id, p.job])
  );

  const visibleRows = originalTimeline.filter((r) => !r.hidden);
  const seen = new Set<string>();
  const result: MitigationAssignment[] = [];

  for (const cast of casts) {
    const job = fflogsIdToJob.get(cast.playerId);
    if (!job) continue;

    const originalPlayer = jobToOriginal.get(job);
    if (!originalPlayer) continue;

    const record = (abilitiesByJob[job] ?? []).find((r) => r.xivapiId === cast.abilityGameId);
    if (!record) continue;

    const windowStart = cast.timestamp < 0 ? 0 : cast.timestamp - 2000;
    const windowEnd = cast.timestamp + (record.duration > 0 ? record.duration * 1000 : 5000);
    let nearestTs: number | null = null;
    let nearestDiff = Infinity;
    for (const row of visibleRows) {
      if (row.timestamp < windowStart || row.timestamp > windowEnd) continue;
      const diff = Math.abs(row.timestamp - cast.timestamp);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestTs = row.timestamp;
      }
    }
    if (nearestTs === null) continue;

    const key = `${originalPlayer.id}|${record.id}|${nearestTs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ playerId: originalPlayer.id, abilityId: record.id, timestamp: nearestTs });
  }

  return result;
}

export function translatePlanAssignments({
  comparisonPlan,
  originalPlayers,
}: {
  comparisonPlan: Plan;
  originalPlayers: Player[];
}): MitigationAssignment[] {
  const jobToOriginal = new Map<JobAbbreviation, Player>(
    originalPlayers.map((p) => [p.job, p])
  );
  const compPlayerById = new Map<string, Player>(
    comparisonPlan.players.map((p) => [p.id, p])
  );

  const seen = new Set<string>();
  const result: MitigationAssignment[] = [];

  for (const assignment of comparisonPlan.assignments ?? []) {
    const compPlayer = compPlayerById.get(assignment.playerId);
    if (!compPlayer) continue;

    const originalPlayer = jobToOriginal.get(compPlayer.job);
    if (!originalPlayer) continue;

    const key = `${originalPlayer.id}|${assignment.abilityId}|${assignment.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ playerId: originalPlayer.id, abilityId: assignment.abilityId, timestamp: assignment.timestamp });
  }

  return result;
}
