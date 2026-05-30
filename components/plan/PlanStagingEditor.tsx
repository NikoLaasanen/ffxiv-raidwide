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
import type { Plan } from "@/types/plan";
import type { MitigationAssignment } from "@/types/timeline";
import type { PlayerCastEvent } from "@/types/fflogs";
import type { PhaseDivider } from "@/types/player";

const TYPE_BADGE: Record<string, string> = {
  Ultimate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Savage: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Criterion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

interface PlanStagingEditorProps {
  /** Resolved draft plan to edit; null while none is staged. */
  plan: Plan | null;
  /** Whether the store has hydrated (controls the redirect guard). */
  hasHydrated: boolean;
  /** Badge shown next to the encounter info, e.g. "Unsaved plan" / "Unsaved copy". */
  badgeLabel: string;
  /** Optional FFLogs actual-cast overlay (import flow only). */
  casts?: PlayerCastEvent[];
  /** Clear the originating store source (pendingImport or draftPlan). */
  onConsumeSource: () => void;
}

/**
 * Local-only staging editor for an unsaved plan. Edits live in component state
 * and are never persisted until "Save plan" is clicked — letting the user try a
 * change without committing it to the database. Shared by the import and copy
 * flows (`/plan/new`).
 */
export function PlanStagingEditor({ plan, hasHydrated, badgeLabel, casts, onConsumeSource }: PlanStagingEditorProps) {
  const router = useRouter();
  const setPlan = usePlanStore((s) => s.setPlan);

  const [saving, setSaving] = useState(false);
  const [currentAssignments, setCurrentAssignments] = useState<MitigationAssignment[]>([]);
  const handleAssignmentsChange = useCallback((a: MitigationAssignment[]) => setCurrentAssignments(a), []);
  const [currentPhases, setCurrentPhases] = useState<PhaseDivider[]>([]);
  const handlePhasesChange = useCallback((p: PhaseDivider[]) => setCurrentPhases(p), []);
  // Set when we navigate away intentionally (save/discard) so consuming the
  // source doesn't trip the "nothing staged" redirect below.
  const leaving = useRef(false);

  // Seed local edit state from the draft during render (keyed on the stable
  // draft id) so the values are in place before Timeline mounts. A post-mount
  // effect would leave Timeline mounting with empty phases first, which doesn't
  // reliably propagate into its internal state. Keying on the id (not the array
  // reference) keeps this from looping.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (plan && seededId !== plan.id) {
    setSeededId(plan.id);
    setCurrentPhases(plan.phases ?? []);
    setCurrentAssignments(plan.assignments ?? []);
  }

  // Nothing staged (e.g. direct navigation or after consuming) → go home.
  useEffect(() => {
    if (hasHydrated && !plan && !leaving.current) {
      router.replace("/");
    }
  }, [hasHydrated, plan, router]);

  if (!hasHydrated || !plan) return null;

  const visibleRows = getVisibleRows(plan.timeline);
  const lastTs = plan.timeline.at(-1)?.timestamp ?? 0;
  const duration = formatTimestamp(lastTs);

  async function handleSave() {
    if (!plan) return;
    setSaving(true);
    try {
      const finalPlan = {
        ...plan,
        phases: currentPhases,
        assignments: currentAssignments,
        updatedAt: Date.now(),
      };
      await savePlan(finalPlan);
      setPlan(finalPlan);
      leaving.current = true;
      onConsumeSource();
      router.push(`/plan/${finalPlan.editLinkId}`);
    } catch (err) {
      console.error("Failed to save plan:", err);
      setSaving(false);
    }
  }

  function handleDiscard() {
    leaving.current = true;
    onConsumeSource();
    router.back();
  }

  return (
    <main className="p-8">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {badgeLabel}
            </span>
            {plan.encounterType && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[plan.encounterType] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {plan.encounterType}
              </span>
            )}
            {plan.encounterTier && <span>{plan.encounterTier}</span>}
          </div>
          {plan.raidplanLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={plan.raidplanLink} target="_blank" rel="noopener noreferrer" aria-label="View on FFLogs" className="gap-1.5">
                <ExternalLink size={16} />
                <span className="hidden md:inline">View on FFLogs</span>
              </a>
            </Button>
          )}
        </div>
        <h1 className="text-2xl font-bold">{plan.title}</h1>
      </div>

      <Timeline
        timeline={plan.timeline}
        players={plan.players}
        casts={casts}
        phases={currentPhases}
        initialAssignments={plan.assignments ?? []}
        onAssignmentsChange={handleAssignmentsChange}
        onPhasesChange={handlePhasesChange}
        title={plan.title}
        encounterTier={plan.encounterTier}
        headerLeft={
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {plan.players.length} players · {visibleRows.length} timeline events · {duration}
          </p>
        }
      />

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
          {saving ? "Saving…" : "Save plan"}
        </Button>
        <Button variant="outline" onClick={handleDiscard} disabled={saving} className="cursor-pointer">
          Discard
        </Button>
      </div>
    </main>
  );
}
