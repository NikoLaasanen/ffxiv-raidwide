"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/store/plan-store";
import { Timeline } from "@/components/timeline/Timeline";
import { getVisibleRows } from "@/lib/timeline-utils";
import { Button } from "@/components/ui/button";
import { ExternalLink, Check, RefreshCw } from "lucide-react";
import { formatTimestamp } from "@/lib/format-timestamp";
import { useCollaboration } from "@/hooks/use-collaboration";
import { PresenceStack, SelfBadge } from "@/components/timeline/PresenceAvatars";
import { upsertMyPlan } from "@/lib/my-plans-storage";
import type { Plan } from "@/types/plan";
import type { MitigationAssignment } from "@/types/timeline";
import type { PhaseDivider, Player } from "@/types/player";

const TYPE_BADGE: Record<string, string> = {
  Ultimate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Savage: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Criterion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

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

  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // Assignments the server is known to hold, pushed down into Timeline so remote
  // edits appear live.
  const [syncedAssignments, setSyncedAssignments] = useState<MitigationAssignment[]>([]);

  // Receive remote plan snapshots (initial load + live collaborator edits).
  const onRemotePlan = useCallback((plan: Plan | null) => {
    setLoaded(true);
    if (!plan) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setPlan(plan);
    setSyncedAssignments(plan.assignments ?? []);
    upsertMyPlan({
      id: plan.id,
      title: plan.title,
      editLinkId: plan.editLinkId,
      viewLinkId: plan.viewLinkId,
      encounterId: plan.encounterId,
      encounterType: plan.encounterType,
      updatedAt: plan.updatedAt,
      savedAt: Date.now(),
    });
  }, [setPlan]);

  const { peers, identity, saving, updateCursor, emitAssignments, emitPhases, emitPlayers } = useCollaboration({
    editLinkId: id,
    enabled: hasHydrated,
    onRemotePlan,
  });

  const handleAssignmentsChange = useCallback((a: MitigationAssignment[]) => emitAssignments(a), [emitAssignments]);
  const handlePhasesChange = useCallback((p: PhaseDivider[]) => emitPhases(p), [emitPhases]);
  const handlePlayersChange = useCallback((p: Player[]) => emitPlayers(p), [emitPlayers]);

  if (!hasHydrated || !loaded) {
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

  const visibleRows = getVisibleRows(storePlan.timeline);
  const lastTs = storePlan.timeline.at(-1)?.timestamp ?? 0;
  const duration = formatTimestamp(lastTs);

  return (
    <main className="p-8">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {storePlan.encounterType && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[storePlan.encounterType] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {storePlan.encounterType}
              </span>
            )}
            {storePlan.encounterTier && <span>{storePlan.encounterTier}</span>}
          </div>
          {storePlan.raidplanLink && (
            <Button variant="outline" size="sm" asChild>
              <a href={storePlan.raidplanLink} target="_blank" rel="noopener noreferrer" aria-label="View on FFLogs" className="gap-1.5">
                <ExternalLink size={16} />
                <span className="hidden md:inline">View on FFLogs</span>
              </a>
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{storePlan.title}</h1>
          <div className="flex items-center gap-2">
            {peers.length > 0 && <SelfBadge identity={identity} />}
            <PresenceStack peers={peers} />
          </div>
        </div>
      </div>
      <Timeline
        timeline={storePlan.timeline}
        players={storePlan.players}
        phases={storePlan.phases}
        initialAssignments={storePlan.assignments ?? []}
        syncedAssignments={syncedAssignments}
        onAssignmentsChange={handleAssignmentsChange}
        onPhasesChange={handlePhasesChange}
        onPlayersChange={handlePlayersChange}
        viewLinkId={storePlan.viewLinkId}
        title={storePlan.title}
        encounterId={storePlan.encounterId}
        peers={peers}
        onHover={updateCursor}
        headerLeft={
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {storePlan.players.length} players · {visibleRows.length} timeline events · {duration}
          </p>
        }
      />

      <div className="mt-6 flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          {saving ? (
            <><RefreshCw size={14} className="animate-spin" /> Saving…</>
          ) : (
            <><Check size={14} className="text-green-500" /> All changes saved</>
          )}
        </span>
        <Button variant="outline" onClick={() => router.push(`/plan/view/${storePlan.viewLinkId}`)}>
          View
        </Button>
      </div>
    </main>
  );
}
