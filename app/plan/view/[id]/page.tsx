"use client";

import { use, useEffect, useState } from "react";
import { usePlanStore } from "@/store/plan-store";
import { getPlanByViewLink } from "@/lib/plan-service";
import { Timeline } from "@/components/timeline/Timeline";
import { formatTimestamp } from "@/lib/format-timestamp";
import { getVisibleRows } from "@/lib/timeline-utils";

export default function PlanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const storePlan = usePlanStore((s) => s.plan);
  const hasHydrated = usePlanStore((s) => s._hasHydrated);
  const setPlan = usePlanStore((s) => s.setPlan);

  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

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
      <Timeline
        timeline={storePlan.timeline}
        players={storePlan.players}
        phases={storePlan.phases}
        initialAssignments={storePlan.assignments ?? []}
        readOnly
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
    </main>
  );
}
