"use client";

import { useMemo } from "react";
import { usePlanStore } from "@/store/plan-store";
import { PlanStagingEditor } from "@/components/plan/PlanStagingEditor";
import { buildPlanFromImport } from "@/lib/create-plan-from-encounter";

export default function NewPlanPage() {
  const pendingImport = usePlanStore((s) => s.pendingImport);
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const draftIsCopy = usePlanStore((s) => s.draftIsCopy);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);
  const setPendingImport = usePlanStore((s) => s.setPendingImport);
  const setDraftPlan = usePlanStore((s) => s.setDraftPlan);

  // A staged copy takes priority; otherwise normalize a fresh FFLogs import.
  // Memoized so the generated link IDs stay stable across re-renders.
  const plan = useMemo(
    () => draftPlan ?? (pendingImport ? buildPlanFromImport(pendingImport) : null),
    [draftPlan, pendingImport],
  );

  const isCopy = draftPlan !== null && draftIsCopy;

  return (
    <PlanStagingEditor
      plan={plan}
      hasHydrated={hasHydrated}
      badgeLabel={isCopy ? "Unsaved copy" : "Unsaved plan"}
      casts={isCopy ? undefined : pendingImport?.casts}
      onConsumeSource={() => (draftPlan ? setDraftPlan(null) : setPendingImport(null))}
    />
  );
}
