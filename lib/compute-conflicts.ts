import type { RowMitigation, RedundantMit } from "@/lib/compute-mitigation";
import type { TimelineRow } from "@/types/timeline";

/** One timeline row carrying its wasted-mitigation overlaps, for the summary panel. */
export interface ConflictRow {
  timestamp: number;
  bossAbility: string;
  redundancies: RedundantMit[];
}

/**
 * Maps each wasted assignment's cell key (`${playerId}|${abilityId}|${assignmentTimestamp}`)
 * to the redundancy that discarded it, for flagging + tooltipping the conflicting cell.
 * `rowMits[i]` must correspond to `visibleRows[i]`.
 */
export function wastedAssignmentMap(rowMits: RowMitigation[]): Map<string, RedundantMit> {
  const map = new Map<string, RedundantMit>();
  for (const rm of rowMits) {
    for (const r of rm.redundancies) {
      map.set(`${r.wasted.playerId}|${r.wasted.abilityId}|${r.wasted.assignmentTimestamp}`, r);
    }
  }
  return map;
}

/** Summary rows for every damage event that has at least one wasted overlap. */
export function conflictRows(
  rowMits: RowMitigation[],
  visibleRows: TimelineRow[]
): ConflictRow[] {
  const rows: ConflictRow[] = [];
  for (let i = 0; i < rowMits.length; i++) {
    const redundancies = rowMits[i].redundancies;
    if (redundancies.length === 0) continue;
    const row = visibleRows[i];
    rows.push({ timestamp: row.timestamp, bossAbility: row.bossAbility, redundancies });
  }
  return rows;
}
