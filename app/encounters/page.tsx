"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePlanStore } from "@/store/plan-store";
import type { EncounterDoc } from "@/types/encounter";

const TYPE_BADGE: Record<string, string> = {
  Ultimate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Savage: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  Criterion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

function TypeBadge({ type }: { type: string }) {
  if (!type) return null;
  const cls = TYPE_BADGE[type] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>{type}</span>
  );
}

export default function EncountersPage() {
  const router = useRouter();
  const setPlan = usePlanStore((s) => s.setPlan);
  const [encounters, setEncounters] = useState<EncounterDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/encounters")
      .then((r) => r.json())
      .then((data) => setEncounters(data.encounters ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = (encounter: EncounterDoc) => {
    const editLinkId = crypto.randomUUID();
    const viewLinkId = crypto.randomUUID();
    const now = Date.now();
    setPlan({
      id: editLinkId,
      editLinkId,
      viewLinkId,
      title: encounter.name,
      encounterId: encounter.id,
      encounterType: encounter.type ?? null,
      encounterTier: encounter.tier ?? null,
      raidplanLink: null,
      timeline: encounter.timeline,
      players: [],
      phases: encounter.phases ?? [],
      assignments: [],
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/plan/${editLinkId}`);
  };

  // Group by tier, preserving insertion order; blank tier goes last
  const grouped = new Map<string, EncounterDoc[]>();
  for (const enc of encounters) {
    const key = enc.tier?.trim() || "";
    const arr = grouped.get(key) ?? [];
    arr.push(enc);
    grouped.set(key, arr);
  }
  // Move blank tier to end
  const sortedKeys = [...grouped.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return 0;
  });

  return (
    <main className="flex-1">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-1">Encounters</h1>
      <p className="mt-1 mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Browse encounter presets and create a new mitigation plan.
      </p>

      {loading && (
        <p className="text-sm text-zinc-500">Loading encounters…</p>
      )}

      {!loading && encounters.length === 0 && (
        <p className="text-sm text-zinc-500">No encounters available yet.</p>
      )}

      {!loading && sortedKeys.map((tier) => {
        const rows = grouped.get(tier)!;
        return (
          <section key={tier || "__no_tier__"} className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
              {tier || "Other"}
            </h2>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-24">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">Patch</th>
                    <th className="px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">Events</th>
                    <th className="px-4 py-2 w-32" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((enc) => {
                    const visibleCount = enc.timeline?.filter((r) => !r.hidden).length ?? 0;
                    return (
                      <tr
                        key={enc.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <td className="px-4 py-2.5 font-medium">{enc.name}</td>
                        <td className="px-4 py-2.5">
                          <TypeBadge type={enc.type} />
                        </td>
                        <td className="px-4 py-2.5 text-zinc-500">{enc.patch}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{visibleCount}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleCreate(enc)}
                          >
                            Create Plan
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      </div>
    </main>
  );
}
