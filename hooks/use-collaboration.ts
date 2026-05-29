"use client";

/**
 * Composes the collaboration channels for a plan edit view:
 * - Firestore onSnapshot for durable edit sync (`onRemotePlan`)
 * - RTDB presence for live cursors (`peers`, `updateCursor`)
 *
 * The page owns the editing UI state; this hook owns the transport. It diffs
 * outgoing assignment changes so only the delta is written, and tracks the
 * last-synced assignments so remote echoes don't loop back out.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getCollabIdentity } from "@/lib/collab/identity";
import { joinPresence, subscribePresence, type Peer } from "@/lib/collab/presence";
import {
  createFieldWriter,
  diffAssignments,
  pushAssignmentChanges,
  subscribePlan,
} from "@/lib/collab/plan-sync";
import type { Plan } from "@/types/plan";
import type { MitigationAssignment, TimelineRow } from "@/types/timeline";
import type { PhaseDivider, Player } from "@/types/player";
import type { JobAbbreviation } from "@/types/ffixiv-job";

interface UseCollaborationArgs {
  editLinkId: string;
  /** Disable everything (e.g. before hydration). */
  enabled: boolean;
  /** Called on every remote plan snapshot. */
  onRemotePlan: (plan: Plan | null) => void;
}

export interface CollaborationApi {
  peers: Peer[];
  identity: { sessionId: string; name: string; color: string };
  saving: boolean;
  updateCursor: (hoverTimestamp: number | null, hoverJob: JobAbbreviation | null) => void;
  emitAssignments: (next: MitigationAssignment[]) => void;
  emitPhases: (phases: PhaseDivider[]) => void;
  emitPlayers: (players: Player[]) => void;
  emitTimeline: (timeline: TimelineRow[]) => void;
}

export function useCollaboration({ editLinkId, enabled, onRemotePlan }: UseCollaborationArgs): CollaborationApi {
  const identity = useMemo(() => getCollabIdentity(), []);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [pendingWrites, setPendingWrites] = useState(0);

  // Latest callback without re-subscribing.
  const onRemotePlanRef = useRef(onRemotePlan);
  useLayoutEffect(() => { onRemotePlanRef.current = onRemotePlan; });

  // Last assignments we know the server has, used for diffing + echo suppression.
  const lastAssignmentsRef = useRef<MitigationAssignment[]>([]);

  const presenceRef = useRef<ReturnType<typeof joinPresence> | null>(null);
  const fieldWriterRef = useRef<ReturnType<typeof createFieldWriter> | null>(null);

  // Firestore edit-sync subscription.
  useEffect(() => {
    if (!enabled) return;
    const unsub = subscribePlan(
      editLinkId,
      (plan) => {
        if (plan) lastAssignmentsRef.current = plan.assignments ?? [];
        onRemotePlanRef.current(plan);
      },
      (err) => console.error("Plan sync error:", err),
    );
    return unsub;
  }, [editLinkId, enabled]);

  // RTDB presence: join + subscribe to peers.
  useEffect(() => {
    if (!enabled) return;
    presenceRef.current = joinPresence(editLinkId, identity);
    const unsub = subscribePresence(editLinkId, identity.sessionId, setPeers);
    return () => {
      unsub();
      presenceRef.current?.leave();
      presenceRef.current = null;
    };
  }, [editLinkId, enabled, identity]);

  // Field writer lifecycle (phases/players/timeline).
  useEffect(() => {
    if (!enabled) return;
    fieldWriterRef.current = createFieldWriter(editLinkId);
    return () => {
      fieldWriterRef.current?.flush();
      fieldWriterRef.current = null;
    };
  }, [editLinkId, enabled]);

  const updateCursor = useCallback((hoverTimestamp: number | null, hoverJob: JobAbbreviation | null) => {
    presenceRef.current?.updateCursor({ hoverTimestamp, hoverJob });
  }, []);

  const emitAssignments = useCallback((next: MitigationAssignment[]) => {
    const { added, removed } = diffAssignments(lastAssignmentsRef.current, next);
    if (added.length === 0 && removed.length === 0) return;
    lastAssignmentsRef.current = next;
    setPendingWrites((n) => n + 1);
    pushAssignmentChanges(editLinkId, added, removed)
      .catch((err) => console.error("Assignment sync error:", err))
      .finally(() => setPendingWrites((n) => n - 1));
  }, [editLinkId]);

  const emitPhases = useCallback((phases: PhaseDivider[]) => fieldWriterRef.current?.phases(phases), []);
  const emitPlayers = useCallback((players: Player[]) => fieldWriterRef.current?.players(players), []);
  const emitTimeline = useCallback((timeline: TimelineRow[]) => fieldWriterRef.current?.timeline(timeline), []);

  return {
    peers,
    identity,
    saving: pendingWrites > 0,
    updateCursor,
    emitAssignments,
    emitPhases,
    emitPlayers,
    emitTimeline,
  };
}
