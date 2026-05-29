"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { usePlanStore } from "@/store/plan-store";
import { useEncounters } from "@/hooks/use-encounters";
import { buildPlanFromEncounter } from "@/lib/create-plan-from-encounter";
import type { EncounterDoc } from "@/types/encounter";
import { inputCls, selectCls } from "@/app/admin/admin-styles";

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

type SortField = "name" | "type" | "tier" | "patch" | "events";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-zinc-300 dark:text-zinc-600">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

function SortableTh({
  field, label, sortField, sortDir, onSort, className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400 cursor-pointer select-none hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      {label}
      <SortIcon active={sortField === field} dir={sortDir} />
    </th>
  );
}

export default function EncountersPage() {
  const router = useRouter();
  const setPlan = usePlanStore((s) => s.setPlan);
  const { data: encounters = [], isLoading: loading } = useEncounters();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterPatch, setFilterPatch] = useState("");
  const [sortField, setSortField] = useState<SortField>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleCreate = (encounter: EncounterDoc) => {
    const plan = buildPlanFromEncounter(encounter);
    setPlan(plan);
    router.push(`/plan/${plan.editLinkId}`);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const uniqueTiers = useMemo(
    () => [...new Set(encounters.map((e) => e.tier).filter(Boolean))].sort(),
    [encounters]
  );
  const uniquePatches = useMemo(
    () => [...new Set(encounters.map((e) => e.patch).filter(Boolean))].sort(),
    [encounters]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return encounters
      .filter((e) => !q || e.name.toLowerCase().includes(q))
      .filter((e) => !filterType || e.type === filterType)
      .filter((e) => !filterTier || e.tier === filterTier)
      .filter((e) => !filterPatch || e.patch === filterPatch)
      .sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortField === "events") {
          av = a.timeline?.filter((r) => !r.hidden).length ?? 0;
          bv = b.timeline?.filter((r) => !r.hidden).length ?? 0;
        } else {
          av = (a[sortField] ?? "").toLowerCase();
          bv = (b[sortField] ?? "").toLowerCase();
        }
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [encounters, search, filterType, filterTier, filterPatch, sortField, sortDir]);

  const hasFilters = search || filterType || filterTier || filterPatch;

  const resetFilters = () => {
    setSearch("");
    setFilterType("");
    setFilterTier("");
    setFilterPatch("");
  };

  return (
    <main className="flex-1">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-1">Encounters</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Browse encounter presets and create a new mitigation plan.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <input
            type="search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls + " w-52"}
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={selectCls}
          >
            <option value="">All types</option>
            <option value="Ultimate">Ultimate</option>
            <option value="Savage">Savage</option>
            <option value="Criterion">Criterion</option>
            <option value="Other">Other</option>
          </select>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className={selectCls}
          >
            <option value="">All tiers</option>
            {uniqueTiers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterPatch}
            onChange={(e) => setFilterPatch(e.target.value)}
            className={selectCls}
          >
            <option value="">All patches</option>
            {uniquePatches.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-1"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && <p className="text-sm text-zinc-500">Loading encounters…</p>}

        {!loading && encounters.length === 0 && (
          <p className="text-sm text-zinc-500">No encounters available yet.</p>
        )}

        {!loading && encounters.length > 0 && (
          <>
            {filtered.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No encounters match your filters.{" "}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Clear filters
                </button>
              </p>
            ) : (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                      <SortableTh field="name" label="Name" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableTh field="type" label="Type" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-28" />
                      <SortableTh field="tier" label="Tier" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortableTh field="patch" label="Patch" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-20" />
                      <SortableTh field="events" label="Events" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="w-20" />
                      <th className="px-4 py-2 w-32" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((enc) => {
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
                          <td className="px-4 py-2.5 text-zinc-500">{enc.tier}</td>
                          <td className="px-4 py-2.5 text-zinc-500">{enc.patch}</td>
                          <td className="px-4 py-2.5 text-zinc-500">{visibleCount}</td>
                          <td className="px-4 py-2.5 text-right">
                            <Button size="sm" onClick={() => handleCreate(enc)}>
                              Create Plan
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
