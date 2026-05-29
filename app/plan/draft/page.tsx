"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/store/plan-store";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Timeline } from "@/components/timeline/Timeline";
import { formatTimestamp } from "@/lib/format-timestamp";
import { savePlan } from "@/lib/plan-service";
import { getVisibleRows } from "@/lib/timeline-utils";
import type { MitigationAssignment } from "@/types/timeline";
import type { PhaseDivider } from "@/types/player";

const TYPE_BADGE: Record<string, string> = {
  Ultimate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Savage: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Criterion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function PlanDraftPage() {
  const router = useRouter();
  const draftPlan = usePlanStore((s) => s.draftPlan);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setDraftPlan = usePlanStore((s) => s.setDraftPlan);

  const [saving, setSaving] = useState(false);
  // Local-only edits; nothing is persisted until "Save copy" is clicked.
  const [currentAssignments, setCurrentAssignments] = useState<MitigationAssignment[]>(draftPlan?.assignments ?? []);
  const handleAssignmentsChange = useCallback((a: MitigationAssignment[]) => setCurrentAssignments(a), []);
  const [currentPhases, setCurrentPhases] = useState<PhaseDivider[]>(draftPlan?.phases ?? []);
  const handlePhasesChange = useCallback((p: PhaseDivider[]) => setCurrentPhases(p), []);
  const hasSaved = useRef(false);

  useEffect(() => {
    if (hasHydrated && !draftPlan && !hasSaved.current) {
      router.replace("/");
    }
  }, [hasHydrated, draftPlan, router]);

  if (!hasHydrated || !draftPlan) return null;

  const visibleRows = getVisibleRows(draftPlan.timeline);
  const lastTs = draftPlan.timeline.at(-1)?.timestamp ?? 0;
  const duration = formatTimestamp(lastTs);

  async function handleSave() {
    if (!draftPlan) return;
    setSaving(true);
    try {
      const plan = {
        ...draftPlan,
        phases: currentPhases,
        assignments: currentAssignments,
        updatedAt: Date.now(),
      };
      await savePlan(plan);
      setPlan(plan);
      hasSaved.current = true;
      setDraftPlan(null);
      router.push(`/plan/${plan.editLinkId}`);
    } catch (err) {
      console.error("Failed to save plan:", err);
      setSaving(false);
    }
  }

  function handleDiscard() {
    setDraftPlan(null);
    router.back();
  }

  return (
    <main className="p-8">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              Unsaved copy
            </span>
            {draftPlan.encounterType && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[draftPlan.encounterType] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {draftPlan.encounterType}
              </span>
            )}
            {draftPlan.encounterTier && <span>{draftPlan.encounterTier}</span>}
          </div>
          {draftPlan.raidplanLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={draftPlan.raidplanLink} target="_blank" rel="noopener noreferrer" aria-label="View on FFLogs" className="gap-1.5">
                <ExternalLink size={16} />
                <span className="hidden md:inline">View on FFLogs</span>
              </a>
            </Button>
          )}
        </div>
        <h1 className="text-2xl font-bold">{draftPlan.title}</h1>
      </div>

      <Timeline
        timeline={draftPlan.timeline}
        players={draftPlan.players}
        phases={currentPhases}
        initialAssignments={draftPlan.assignments ?? []}
        onAssignmentsChange={handleAssignmentsChange}
        onPhasesChange={handlePhasesChange}
        title={draftPlan.title}
        encounterId={draftPlan.encounterId}
        headerLeft={
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {draftPlan.players.length} players · {visibleRows.length} timeline events · {duration}
          </p>
        }
      />

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
          {saving ? "Saving…" : "Save copy"}
        </Button>
        <Button variant="outline" onClick={handleDiscard} disabled={saving} className="cursor-pointer">
          Discard
        </Button>
      </div>
    </main>
  );
}
