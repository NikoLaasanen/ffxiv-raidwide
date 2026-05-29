import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { Player, PhaseDivider } from "@/types/player";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import { ALL_JOBS } from "@/lib/jobs";

export type AbilityEntry = { job: JobAbbreviation; abilityId: string };

export type DisplayItem =
  | { kind: "phase"; phase: PhaseDivider; endTimestamp: number }
  | { kind: "row"; row: TimelineRow; abilityEntries: AbilityEntry[] };

export interface BuildMyTimelineArgs {
  players: Player[];
  timeline: TimelineRow[];
  phases: PhaseDivider[];
  assignments: MitigationAssignment[];
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
  selectedJobs: JobAbbreviation[];
  /** When provided, only rows whose containing phase timestamp is in this set are kept.
   *  Rows before the first phase divider are always kept. */
  includePhaseTimestamps?: Set<number> | null;
  /** When true, collapsed phases are expanded (their rows are shown). */
  expandAll?: boolean;
}

export interface MyTimelineData {
  sortedSelectedJobs: JobAbbreviation[];
  selectedPlayers: Player[];
  playerAbilities: JobAbilityRecord[];
  abilityById: Map<string, JobAbilityRecord>;
  myAssignments: MitigationAssignment[];
  myRows: TimelineRow[];
  displayItems: DisplayItem[];
}

/** Shared grouping logic for the "My plan" view and its shareable export. */
export function buildMyTimelineData({
  players,
  timeline,
  phases,
  assignments,
  abilitiesByJob,
  selectedJobs,
  includePhaseTimestamps = null,
  expandAll = false,
}: BuildMyTimelineArgs): MyTimelineData {
  const sortedSelectedJobs = [...selectedJobs].sort(
    (a, b) => ALL_JOBS.indexOf(a) - ALL_JOBS.indexOf(b)
  );

  const selectedPlayers = players.filter((p) => sortedSelectedJobs.includes(p.job));

  // Merged ability list, deduped by id, in role order.
  const seen = new Set<string>();
  const playerAbilities: JobAbilityRecord[] = [];
  for (const job of sortedSelectedJobs) {
    for (const ab of abilitiesByJob[job] ?? []) {
      if (!seen.has(ab.id)) {
        seen.add(ab.id);
        playerAbilities.push(ab);
      }
    }
  }
  const abilityById = new Map(playerAbilities.map((a) => [a.id, a]));

  const myAssignments = assignments.filter((a) =>
    selectedPlayers.some((p) => p.id === a.playerId)
  );

  const playerIdToJob = new Map(selectedPlayers.map((p) => [p.id, p.job]));

  const assignmentsByTimestamp = new Map<number, AbilityEntry[]>();
  for (const a of myAssignments) {
    const job = playerIdToJob.get(a.playerId);
    if (!job) continue;
    const list = assignmentsByTimestamp.get(a.timestamp) ?? [];
    list.push({ job, abilityId: a.abilityId });
    assignmentsByTimestamp.set(a.timestamp, list);
  }
  for (const [ts, entries] of assignmentsByTimestamp) {
    assignmentsByTimestamp.set(
      ts,
      entries.sort((a, b) => ALL_JOBS.indexOf(a.job) - ALL_JOBS.indexOf(b.job))
    );
  }

  const myRows = timeline.filter(
    (row) => !row.hidden && assignmentsByTimestamp.has(row.timestamp)
  );

  const sortedPhases = [...phases].sort((a, b) => a.timestamp - b.timestamp);
  const phaseEndTs = sortedPhases.map((ph, i) => {
    const next = sortedPhases[i + 1];
    return next ? next.timestamp : (timeline[timeline.length - 1]?.timestamp ?? ph.timestamp);
  });

  const displayItems: DisplayItem[] = [];
  let lastPhaseIdx = -1;

  for (const row of myRows) {
    let currentPhaseIdx = -1;
    for (let i = 0; i < sortedPhases.length; i++) {
      if (sortedPhases[i].timestamp <= row.timestamp) currentPhaseIdx = i;
      else break;
    }
    const phase = currentPhaseIdx >= 0 ? sortedPhases[currentPhaseIdx] : null;

    // Export phase filter: drop rows whose phase isn't selected.
    if (includePhaseTimestamps && phase && !includePhaseTimestamps.has(phase.timestamp)) {
      continue;
    }

    if (currentPhaseIdx !== lastPhaseIdx && phase) {
      displayItems.push({
        kind: "phase",
        phase,
        endTimestamp: phaseEndTs[currentPhaseIdx],
      });
      lastPhaseIdx = currentPhaseIdx;
    }

    if (!expandAll && phase?.collapsed) continue;

    const abilityEntries = (assignmentsByTimestamp.get(row.timestamp) ?? []).filter(
      ({ abilityId }) => abilityById.has(abilityId)
    );
    if (abilityEntries.length === 0) continue;
    displayItems.push({ kind: "row", row, abilityEntries });
  }

  return {
    sortedSelectedJobs,
    selectedPlayers,
    playerAbilities,
    abilityById,
    myAssignments,
    myRows,
    displayItems,
  };
}
