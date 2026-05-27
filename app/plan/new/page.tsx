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

export default function NewPlanPage() {
  const router = useRouter();
  const pendingImport = usePlanStore((s) => s.pendingImport);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setPendingImport = usePlanStore((s) => s.setPendingImport);
  const [saving, setSaving] = useState(false);
  const [currentAssignments, setCurrentAssignments] = useState<MitigationAssignment[]>([]);
  const handleAssignmentsChange = useCallback((a: MitigationAssignment[]) => setCurrentAssignments(a), []);
  const [currentPhases, setCurrentPhases] = useState<PhaseDivider[]>([]);
  const handlePhasesChange = useCallback((p: PhaseDivider[]) => setCurrentPhases(p), []);
  const hasSaved = useRef(false);
  const phasesInitialized = useRef(false);

  useEffect(() => {
    if (hasHydrated && pendingImport === null && !hasSaved.current) {
      router.replace("/");
    }
  }, [hasHydrated, pendingImport, router]);

  useEffect(() => {
    if (pendingImport && !phasesInitialized.current) {
      phasesInitialized.current = true;
      setCurrentPhases(pendingImport.phases ?? []);
    }
  }, [pendingImport]);

  if (!hasHydrated || !pendingImport) return null;

  const { reportCode, fight, players, timeline, encounterId, encounterType, encounterTier } = pendingImport;
  const visibleRows = getVisibleRows(timeline);
  const duration = formatTimestamp(fight.endTime - fight.startTime);
  const fflogsUrl = `https://www.fflogs.com/reports/${reportCode}#fight=${fight.id}`;

  async function handleSave() {
    setSaving(true);
    try {
      const editLinkId = crypto.randomUUID();
      const viewLinkId = crypto.randomUUID();
      const now = Date.now();
      const plan = {
        id: editLinkId,
        editLinkId,
        viewLinkId,
        title: fight.name,
        encounterId: encounterId ?? null,
        encounterType: encounterType ?? null,
        encounterTier: encounterTier ?? null,
        raidplanLink: fflogsUrl,
        timeline,
        players,
        phases: currentPhases,
        assignments: currentAssignments,
        createdAt: now,
        updatedAt: now,
      };
      await savePlan(plan);
      setPlan(plan);
      hasSaved.current = true;
      setPendingImport(null);
      router.push(`/plan/${editLinkId}`);
    } catch (err) {
      console.error("Failed to save plan:", err);
      setSaving(false);
    }
  }

  return (
    <main className="p-8">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {encounterType && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[encounterType] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {encounterType}
              </span>
            )}
            {encounterTier && <span>{encounterTier}</span>}
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={fflogsUrl} target="_blank" rel="noopener noreferrer" aria-label="View on FFLogs" className="gap-1.5">
              <ExternalLink size={16} />
              <span className="hidden md:inline">View on FFLogs</span>
            </a>
          </Button>
        </div>
        <h1 className="text-2xl font-bold">{fight.name}</h1>
      </div>

      <Timeline
        timeline={timeline}
        players={players}
        casts={pendingImport.casts}
        phases={currentPhases}
        onAssignmentsChange={handleAssignmentsChange}
        onPhasesChange={handlePhasesChange}
        headerLeft={
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {players.length} players · {visibleRows.length} timeline events · {duration}
          </p>
        }
      />

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Plan"}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={saving}>
          Back
        </Button>
      </div>
    </main>
  );
}
