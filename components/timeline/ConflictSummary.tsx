"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeftRight, AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/format-timestamp";
import { JOB_ROLE_COLOR } from "@/lib/jobs";
import { FALLBACK_JOB_COLOR } from "@/lib/timeline-constants";
import { Button } from "@/components/ui/button";
import type { MitigationAssignment } from "@/types/timeline";
import type { ConflictParty, RedundantMit } from "@/lib/compute-mitigation";
import type { ConflictRow } from "@/lib/compute-conflicts";

const redundancyId = (timestamp: number, r: RedundantMit) =>
  `${timestamp}|${r.kept.playerId}:${r.kept.abilityId}|${r.wasted.playerId}:${r.wasted.abilityId}`;

const toAssignment = (p: ConflictParty): MitigationAssignment => ({
  playerId: p.playerId,
  abilityId: p.abilityId,
  timestamp: p.assignmentTimestamp,
});

function PartyCard({ party, removed }: { party: ConflictParty; removed?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-7 pl-1 pr-2 rounded-md border text-xs font-medium",
        removed
          ? "border-zinc-200 dark:border-slate-700 text-zinc-400 dark:text-slate-500 bg-zinc-50 dark:bg-slate-900"
          : "border-zinc-300 dark:border-slate-600 text-zinc-700 dark:text-slate-200 bg-white dark:bg-slate-800"
      )}
    >
      <Image
        src={party.iconPath}
        alt=""
        width={18}
        height={18}
        className={cn("rounded shrink-0", removed && "opacity-50")}
        aria-hidden
      />
      <span className={cn(removed && "line-through")}>{party.abilityName}</span>
      <span
        className="w-1 h-3.5 rounded-sm shrink-0"
        style={{ backgroundColor: removed ? FALLBACK_JOB_COLOR : JOB_ROLE_COLOR[party.job] ?? FALLBACK_JOB_COLOR }}
      />
      <span className={cn("font-mono text-zinc-500 dark:text-slate-400", removed && "line-through")}>{party.job}</span>
    </span>
  );
}

export function ConflictSummary({
  rows,
  onRemove,
}: {
  rows: ConflictRow[];
  onRemove: (targets: MitigationAssignment[]) => void;
}) {
  // Which redundancies have their kept/removed sides swapped (panel-local UI state).
  const [swapped, setSwapped] = useState<Set<string>>(new Set());

  if (rows.length === 0) return null;

  const total = rows.reduce((n, r) => n + r.redundancies.length, 0);

  // For a redundancy, the side that will be deleted (and its surviving counterpart).
  const sides = (id: string, r: RedundantMit) => {
    const isSwapped = swapped.has(id);
    return { kept: isSwapped ? r.wasted : r.kept, removed: isSwapped ? r.kept : r.wasted };
  };

  const toggleSwap = (id: string) =>
    setSwapped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const removeAll = () => {
    const targets: MitigationAssignment[] = [];
    for (const row of rows) {
      for (const r of row.redundancies) {
        targets.push(toAssignment(sides(redundancyId(row.timestamp, r), r).removed));
      }
    }
    onRemove(targets);
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <AlertTriangle size={15} className="shrink-0" />
          Wasted mitigation
        </h2>
        <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
          {`${total} ${total === 1 ? "overlap" : "overlaps"} that don't stack`}
        </span>
        <Button variant="outline" size="sm" className="ml-auto h-7 gap-1.5 text-xs" onClick={removeAll}>
          <Trash2 size={13} />
          Remove all
        </Button>
      </div>

      <ul className="flex flex-col divide-y divide-amber-200/60 dark:divide-amber-500/20">
        {rows.map((row, ri) => (
          <li
            key={`${row.timestamp}-${ri}`}
            className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:gap-4"
          >
            <div className="flex shrink-0 items-baseline gap-2 sm:w-56">
              <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-slate-400">
                {formatTimestamp(row.timestamp)}
              </span>
              <span className="text-sm text-zinc-700 dark:text-slate-200">{row.bossAbility}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {row.redundancies.map((r) => {
                const id = redundancyId(row.timestamp, r);
                const { kept, removed } = sides(id, r);
                return (
                  <div key={id} className="flex flex-wrap items-center gap-1.5">
                    <PartyCard party={kept} />
                    <button
                      type="button"
                      onClick={() => toggleSwap(id)}
                      title="Swap which side is removed"
                      aria-label="Swap which side is removed"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-amber-600 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 transition-colors cursor-pointer shrink-0"
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                    <PartyCard party={removed} removed />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
                      {r.reason === "ranged-shared" ? "ranged shared" : "duplicate"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove([toAssignment(removed)])}
                      title={`Remove ${removed.job}'s ${removed.abilityName}`}
                      aria-label={`Remove ${removed.job}'s ${removed.abilityName}`}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
