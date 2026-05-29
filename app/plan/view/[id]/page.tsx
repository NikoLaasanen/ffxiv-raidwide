"use client";

const TYPE_BADGE: Record<string, string> = {
  Ultimate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Savage: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Criterion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/store/plan-store";
import { getPlanByViewLink, buildPlanCopy } from "@/lib/plan-service";
import { Timeline } from "@/components/timeline/Timeline";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { formatTimestamp } from "@/lib/format-timestamp";
import { getVisibleRows } from "@/lib/timeline-utils";

export default function PlanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const storePlan = usePlanStore((s) => s.plan);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);
  const setPlan = usePlanStore((s) => s.setPlan);
  const setDraftPlan = usePlanStore((s) => s.setDraftPlan);
  const setPendingImport = usePlanStore((s) => s.setPendingImport);

  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  function handleCopy() {
    if (!storePlan) return;
    // Stage an unsaved copy; the staging page lets the user edit and decide
    // whether to persist it. The original is never written to. Clear any
    // pending import so only one draft source is active at a time.
    setPendingImport(null);
    setDraftPlan(buildPlanCopy(storePlan));
    router.push("/plan/new");
  }

  useEffect(() => {
    if (!hasHydrated) return;
    if (storePlan?.viewLinkId === id) return;

    setLoading(true);
    setNotFound(false);
    getPlanByViewLink(id)
      .then((plan) => {
        if (!plan) {
          setNotFound(true);
        } else {
          setPlan(plan);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [hasHydrated, id, storePlan?.viewLinkId, setPlan]);

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
          The view link may be invalid or the plan was deleted.
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
          <div className="flex items-center gap-2">
            {storePlan.raidplanLink && (
              <Button variant="outline" size="sm" asChild>
                <a href={storePlan.raidplanLink} target="_blank" rel="noopener noreferrer" aria-label="View on FFLogs" className="gap-1.5">
                  <ExternalLink size={16} />
                  <span className="hidden md:inline">View on FFLogs</span>
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleCopy} aria-label="Make a copy" className="cursor-pointer gap-1.5">
              <Copy size={16} />
              <span className="hidden md:inline">Make a copy</span>
            </Button>
          </div>
        </div>
        <h1 className="text-2xl font-bold">{storePlan.title}</h1>
      </div>
      <Timeline
        timeline={storePlan.timeline}
        players={storePlan.players}
        phases={storePlan.phases}
        initialAssignments={storePlan.assignments ?? []}
        readOnly
        viewLinkId={storePlan.viewLinkId}
        title={storePlan.title}
        encounterId={storePlan.encounterId}
        headerLeft={
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {storePlan.players.length} players · {visibleRows.length} timeline events · {duration}
          </p>
        }
      />
    </main>
  );
}
