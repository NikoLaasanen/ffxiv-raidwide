"use client";

/**
 * Operation-based undo/redo history for player ability (mitigation) assignments
 * in the full timeline editor.
 *
 * Each local toggle records an inverse-able operation rather than a full snapshot,
 * so undo/redo only ever touches the single cell that was toggled. Applied against
 * the *current* assignments, this never clobbers a collaborator's concurrent edit
 * and fits the commutative arrayUnion/arrayRemove sync model. The hook owns only
 * the stacks; the caller applies the returned op (it owns `setAssignments`).
 *
 * Stacks live in refs for synchronous access inside the (event-handler) callbacks;
 * `canUndo`/`canRedo` mirror their lengths as state so the buttons re-render.
 */
import { useCallback, useRef, useState } from "react";
import type { MitigationAssignment } from "@/types/timeline";

export type AssignmentOp = { kind: "add" | "remove"; assignment: MitigationAssignment };

const MAX_HISTORY = 50;

export function useAssignmentHistory() {
  const pastRef = useRef<AssignmentOp[]>([]);
  const futureRef = useRef<AssignmentOp[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sync = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  const record = useCallback((op: AssignmentOp) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), op];
    futureRef.current = [];
    sync();
  }, [sync]);

  const undo = useCallback((): AssignmentOp | null => {
    const past = pastRef.current;
    if (past.length === 0) return null;
    const op = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [op, ...futureRef.current];
    sync();
    return op;
  }, [sync]);

  const redo = useCallback((): AssignmentOp | null => {
    const future = futureRef.current;
    if (future.length === 0) return null;
    const op = future[0];
    futureRef.current = future.slice(1);
    pastRef.current = [...pastRef.current, op];
    sync();
    return op;
  }, [sync]);

  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    sync();
  }, [sync]);

  return { record, undo, redo, reset, canUndo, canRedo };
}
