/**
 * Durable, real-time edit sync for plan edit views over Firestore.
 *
 * - Receive: `subscribePlan` streams the plan doc via onSnapshot.
 * - Send assignments: granular arrayUnion/arrayRemove so concurrent editors
 *   toggling *different* cells converge without clobbering each other.
 * - Send phases/players/timeline: debounced field-level writes (last-write-wins,
 *   fine given their low edit frequency).
 *
 * Writes are client-direct for low latency (the existing /api/plans route stays
 * for the import/first-save path). The editLinkId is the doc id + write secret,
 * matching the app's current trust model.
 */
import {
  arrayRemove,
  arrayUnion,
  doc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS } from "@/lib/db-collections";
import type { Plan } from "@/types/plan";
import type { MitigationAssignment, TimelineRow } from "@/types/timeline";
import type { PhaseDivider, Player } from "@/types/player";

function planRef(editLinkId: string) {
  return doc(db, COLLECTIONS.PLANS, editLinkId);
}

/** Stream the plan document. Returns an unsubscribe. */
export function subscribePlan(
  editLinkId: string,
  cb: (plan: Plan | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    planRef(editLinkId),
    (snap) => cb(snap.exists() ? (snap.data() as Plan) : null),
    (err) => onError?.(err),
  );
}

/** Add/remove individual assignments. Commutative — safe under concurrency. */
export async function pushAssignmentChanges(
  editLinkId: string,
  added: MitigationAssignment[],
  removed: MitigationAssignment[],
): Promise<void> {
  if (added.length === 0 && removed.length === 0) return;
  // arrayUnion + arrayRemove can't target the same field in one update, so when
  // both are present we write twice.
  if (removed.length) {
    await updateDoc(planRef(editLinkId), { assignments: arrayRemove(...removed), updatedAt: Date.now() });
  }
  if (added.length) {
    await updateDoc(planRef(editLinkId), { assignments: arrayUnion(...added), updatedAt: Date.now() });
  }
}

/** Debounced last-write-wins field writers for lower-frequency edits. */
export function createFieldWriter(editLinkId: string, debounceMs = 800) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function write(field: "phases" | "players" | "timeline", value: PhaseDivider[] | Player[] | TimelineRow[]) {
    const existing = timers.get(field);
    if (existing) clearTimeout(existing);
    timers.set(
      field,
      setTimeout(() => {
        timers.delete(field);
        void updateDoc(planRef(editLinkId), { [field]: value, updatedAt: Date.now() });
      }, debounceMs),
    );
  }

  return {
    phases: (p: PhaseDivider[]) => write("phases", p),
    players: (p: Player[]) => write("players", p),
    timeline: (t: TimelineRow[]) => write("timeline", t),
    flush: () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}

/** Diff two assignment arrays into added/removed sets (identity = player|ability|ts). */
export function diffAssignments(
  prev: MitigationAssignment[],
  next: MitigationAssignment[],
): { added: MitigationAssignment[]; removed: MitigationAssignment[] } {
  const key = (a: MitigationAssignment) => `${a.playerId}|${a.abilityId}|${a.timestamp}`;
  const prevMap = new Map(prev.map((a) => [key(a), a]));
  const nextMap = new Map(next.map((a) => [key(a), a]));
  const added = next.filter((a) => !prevMap.has(key(a)));
  const removed = prev.filter((a) => !nextMap.has(key(a)));
  return { added, removed };
}
