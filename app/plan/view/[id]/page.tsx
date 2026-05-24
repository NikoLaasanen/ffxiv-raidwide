"use client";

import { use, useEffect, useState } from "react";
import { usePlanStore } from "@/store/plan-store";
import { getPlanByViewLink } from "@/lib/plan-service";
import { Timeline } from "@/components/timeline/Timeline";
import { formatTimestamp } from "@/lib/format-timestamp";

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

  const visibleRows = storePlan.timeline.filter((row) => !row.hidden);
  const lastTs = storePlan.timeline.at(-1)?.timestamp ?? 0;
  const duration = formatTimestamp(lastTs);

  return (
    <main className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{storePlan.title}</h1>
          {storePlan.raidplanLink && (
            <a
              href={storePlan.raidplanLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
            >
              View on FFLogs ↗
            </a>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {storePlan.players.length} players · {visibleRows.length} timeline events · {duration}
        </p>
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
      />
    </main>
  );
}
