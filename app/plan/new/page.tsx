"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlanStore } from "@/store/plan-store";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/timeline/Timeline";

export default function NewPlanPage() {
  const router = useRouter();
  const pendingImport = usePlanStore((s) => s.pendingImport);

  useEffect(() => {
    if (pendingImport === null) {
      router.replace("/");
    }
  }, [pendingImport, router]);

  if (!pendingImport) return null;

  const { fight, players, timeline } = pendingImport;
  const visibleRows = timeline.filter((row) => !row.hidden);

  return (
    <main className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{fight.name}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {players.length} players · {visibleRows.length} timeline events
        </p>
      </div>

      <Timeline timeline={timeline} players={players} />

      <div className="mt-6 flex items-center gap-3">
        <Button disabled>Save Plan</Button>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>
    </main>
  );
}
