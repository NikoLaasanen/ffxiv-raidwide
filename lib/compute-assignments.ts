import type { PlayerCastEvent } from "@/types/fflogs";
import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { Player } from "@/types/player";

const PRE_CAST_GRACE_MS = 2000;
const ZERO_DURATION_FALLBACK_MS = 5000;

export function computeAssignments(
  casts: PlayerCastEvent[],
  players: Player[],
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>,
  timeline: TimelineRow[]
): MitigationAssignment[] {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const assignments: MitigationAssignment[] = [];

  for (const cast of casts) {
    const player = playerById.get(cast.playerId);
    if (!player) continue;

    const abilities = abilitiesByJob[player.job] ?? [];
    const ability = abilities.find(
      (a) => a.name.toLowerCase() === cast.abilityName.toLowerCase()
    );
    if (!ability) continue;

    const windowStart = cast.timestamp < 0 ? 0 : cast.timestamp - PRE_CAST_GRACE_MS;
    const effectiveCastTs = Math.max(cast.timestamp, 0);
    const windowEnd =
      effectiveCastTs +
      (ability.duration > 0 ? ability.duration * 1000 : ZERO_DURATION_FALLBACK_MS);

    let bestRow: TimelineRow | null = null;
    let bestDist = Infinity;
    for (const row of timeline) {
      if (row.hidden) continue;
      if (row.timestamp < windowStart || row.timestamp > windowEnd) continue;
      const dist = Math.abs(row.timestamp - cast.timestamp);
      if (dist < bestDist) {
        bestDist = dist;
        bestRow = row;
      }
    }

    if (bestRow) {
      assignments.push({
        playerId: cast.playerId,
        abilityId: ability.id,
        timestamp: bestRow.timestamp,
      });
    }
  }

  return assignments;
}
