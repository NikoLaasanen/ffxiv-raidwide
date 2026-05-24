"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/store/plan-store";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/timeline/Timeline";
import { formatTimestamp } from "@/lib/format-timestamp";
import { savePlan } from "@/lib/plan-service";
import type { MitigationAssignment } from "@/types/timeline";

export default function NewPlanPage() {
  const router = useRouter();
  const pendingImport = usePlanStore((s) => s.pendingImport);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setPendingImport = usePlanStore((s) => s.setPendingImport);
  const [saving, setSaving] = useState(false);
  const [currentAssignments, setCurrentAssignments] = useState<MitigationAssignment[]>([]);
  const handleAssignmentsChange = useCallback((a: MitigationAssignment[]) => setCurrentAssignments(a), []);
  const hasSaved = useRef(false);

  useEffect(() => {
    if (hasHydrated && pendingImport === null && !hasSaved.current) {
      router.replace("/");
    }
  }, [hasHydrated, pendingImport, router]);

  if (!hasHydrated || !pendingImport) return null;

  const { reportCode, fight, players, timeline } = pendingImport;
  const visibleRows = timeline.filter((row) => !row.hidden);
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
        encounterId: null,
        raidplanLink: fflogsUrl,
        timeline,
        players,
        phases: [],
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
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{fight.name}</h1>
          <a
            href={fflogsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
          >
            View on FFLogs ↗
          </a>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {players.length} players · {visibleRows.length} timeline events · {duration}
        </p>
      </div>

      <Timeline timeline={timeline} players={players} casts={pendingImport.casts} onAssignmentsChange={handleAssignmentsChange} />

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
