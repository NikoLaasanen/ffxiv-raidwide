"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/store/plan-store";
import { getPlan, updatePlan } from "@/lib/plan-service";
import { Timeline } from "@/components/timeline/Timeline";
import { Button } from "@/components/ui/button";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { Plan } from "@/types/plan";
import type { MitigationAssignment } from "@/types/timeline";
import type { PhaseDivider, Player } from "@/types/player";

export default function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const storePlan = usePlanStore((s) => s.plan);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);
  const setPlan = usePlanStore((s) => s.setPlan);
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentAssignments, setCurrentAssignments] = useState<MitigationAssignment[]>([]);
  const handleAssignmentsChange = useCallback((a: MitigationAssignment[]) => setCurrentAssignments(a), []);
  const [currentPhases, setCurrentPhases] = useState<PhaseDivider[]>([]);
  const handlePhasesChange = useCallback((p: PhaseDivider[]) => setCurrentPhases(p), []);
  const [currentPlayers, setCurrentPlayers] = useState<Player[]>([]);
  const handlePlayersChange = useCallback((p: Player[]) => setCurrentPlayers(p), []);

  // Load plan from Firebase if the store doesn't already have it
  useEffect(() => {
    if (!hasHydrated) return;
    if (storePlan?.editLinkId === id) return;

    setLoading(true);
    setNotFound(false);
    getPlan(id)
      .then((plan) => {
        if (!plan) {
          setNotFound(true);
        } else {
          setPlan(plan);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [hasHydrated, id, storePlan?.editLinkId, setPlan]);

  async function handleSave() {
    if (!storePlan) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated: Plan = { ...storePlan, updatedAt: Date.now(), assignments: currentAssignments, phases: currentPhases, players: currentPlayers };
      await updatePlan(updated);
      setPlan(updated);
      setSaved(true);
    } catch (err) {
      console.error("Failed to save plan:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!hasHydrated || loading) {
    return (
      <main className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-zinc-800" />
          <div className="h-4 w-40 rounded bg-zinc-800" />
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Plan not found</h1>
        <p className="mt-2 text-sm text-zinc-500">
          The edit link may be invalid or the plan was deleted.
        </p>
      </main>
    );
  }

  if (!storePlan) return null;

  const visibleRows = storePlan.timeline.filter((row) => !row.hidden);
  const lastTs = storePlan.timeline.at(-1)?.timestamp ?? 0;
  const duration = formatTimestamp(lastTs);

  return (
    <main className="p-8">
      <Timeline
        timeline={storePlan.timeline}
        players={storePlan.players}
        phases={storePlan.phases}
        initialAssignments={storePlan.assignments ?? []}
        onAssignmentsChange={handleAssignmentsChange}
        onPhasesChange={handlePhasesChange}
        onPlayersChange={handlePlayersChange}
        viewLinkId={storePlan.viewLinkId}
        title={storePlan.title}
        encounterId={storePlan.encounterId}
        raidplanLink={storePlan.raidplanLink ?? undefined}
        headerLeft={
          <div>
            <h1 className="text-2xl font-bold">{storePlan.title}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {storePlan.players.length} players · {visibleRows.length} timeline events · {duration}
            </p>
          </div>
        }
      />

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Plan"}
        </Button>
        <Button variant="outline" onClick={() => router.push(`/plan/view/${storePlan.viewLinkId}`)}>
          View
        </Button>
        {saved && (
          <span className="text-sm text-green-500">Saved</span>
        )}
      </div>
    </main>
  );
}
