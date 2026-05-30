"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, ArrowLeftRight, ChevronDown, ChevronRight, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/format-timestamp";
import { JOB_ROLE_COLOR } from "@/lib/jobs";
import { FALLBACK_JOB_COLOR } from "@/lib/timeline-constants";
import { Button } from "@/components/ui/button";
import type { MitigationAssignment } from "@/types/timeline";
import type { ConflictParty, RedundantMit } from "@/lib/compute-mitigation";
import type { ConflictRow } from "@/lib/compute-conflicts";
import type { MistakeRow } from "@/components/timeline/MistakeSummary";
import type { DiffRow, DiffEntry } from "@/components/timeline/ComparisonSummary";

// ── helpers shared across tabs ───────────────────────────────────────────

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

function MistakeChip({ job, icon, variant }: { job: string; icon: string; variant: "death" | "damageDown" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 pl-1 pr-2 rounded-md border text-xs font-medium",
        variant === "death"
          ? "border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
          : "border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20"
      )}
    >
      <Image src={icon} alt="" width={16} height={16} className="shrink-0" aria-hidden />
      <span className="font-mono text-zinc-500 dark:text-slate-400">{job}</span>
    </span>
  );
}

function DiffChip({ entry, variant }: { entry: DiffEntry; variant: "missing" | "extra" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 pl-1 pr-2 rounded-md border text-xs font-medium",
        variant === "missing"
          ? "border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20"
          : "border-green-300 dark:border-green-500/40 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20"
      )}
    >
      {entry.iconPath && (
        <Image src={entry.iconPath} alt="" width={16} height={16} className="rounded-sm shrink-0" aria-hidden />
      )}
      <span className="font-mono text-zinc-500 dark:text-slate-400">{entry.job}</span>
      <span>{entry.abilityName}</span>
    </span>
  );
}

// ── tab body renderers ───────────────────────────────────────────────────

function WastedTab({
  rows,
  onRemove,
}: {
  rows: ConflictRow[];
  onRemove: (targets: MitigationAssignment[]) => void;
}) {
  const [swapped, setSwapped] = useState<Set<string>>(new Set());

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

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500 dark:text-slate-400">
        No wasted mitigation — plan looks clean.
      </p>
    );
  }

  return (
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
  );
}

function MistakesTab({ rows }: { rows: MistakeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500 dark:text-slate-400">
        No mistakes recorded for this plan.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-slate-800">
      {rows.map((row) => (
        <li
          key={row.timestamp}
          className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:gap-4"
        >
          <div className="flex shrink-0 items-baseline gap-2 sm:w-56">
            <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-slate-400">
              {formatTimestamp(row.timestamp)}
            </span>
            <span className="text-sm text-zinc-700 dark:text-slate-200">{row.bossAbility}</span>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {row.deaths.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400">
                  Deaths
                </span>
                {row.deaths.map((d, i) => (
                  <MistakeChip key={`d-${i}`} job={d.job} icon="/icons/Death.png" variant="death" />
                ))}
              </div>
            )}
            {row.damageDowns.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Damage Downs
                </span>
                {row.damageDowns.map((d, i) => (
                  <MistakeChip key={`dd-${i}`} job={d.job} icon="/icons/DamageDown.png" variant="damageDown" />
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ComparisonTab({ rows }: { rows: DiffRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-500 dark:text-slate-400">
        No differences — plan and comparison match.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-slate-800">
      {rows.map((row) => (
        <li
          key={row.timestamp}
          className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-start sm:gap-4"
        >
          <div className="flex shrink-0 items-baseline gap-2 sm:w-56">
            <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-slate-400">
              {formatTimestamp(row.timestamp)}
            </span>
            <span className="text-sm text-zinc-700 dark:text-slate-200">{row.bossAbility}</span>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {row.missing.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400">
                  Missing
                </span>
                {row.missing.map((e, i) => (
                  <DiffChip key={`m-${i}`} entry={e} variant="missing" />
                ))}
              </div>
            )}
            {row.extra.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                  Extra
                </span>
                {row.extra.map((e, i) => (
                  <DiffChip key={`e-${i}`} entry={e} variant="extra" />
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── main export ──────────────────────────────────────────────────────────

type Tab = "wasted" | "mistakes" | "compare";

export function DiagnosticsPanel({
  conflictRows,
  onRemove,
  mistakeRows,
  showMistakes,
  comparisonRows,
  comparisonLabel,
  comparisonUrl,
  isComparing,
}: {
  conflictRows: ConflictRow[];
  onRemove: (targets: MitigationAssignment[]) => void;
  mistakeRows: MistakeRow[];
  showMistakes: boolean;
  comparisonRows: DiffRow[];
  comparisonLabel: string | null;
  comparisonUrl: string | null;
  isComparing: boolean;
}) {
  const hasConflicts = conflictRows.length > 0;
  const hasMistakes = showMistakes && mistakeRows.length > 0;

  const visible = hasConflicts || isComparing || hasMistakes;

  // The "wasted" hero tab is always present when the panel is visible; the
  // mistakes/compare tabs only exist when their data is available.
  const preferredTab: Tab = hasConflicts ? "wasted" : hasMistakes ? "mistakes" : isComparing ? "compare" : "wasted";

  // `null` until the user picks a tab — until then we follow `preferredTab`,
  // which reacts to data loading in (abilities/conflicts arrive after mount).
  const [tab, setTab] = useState<Tab | null>(null);
  const [open, setOpen] = useState(true);

  // Fall back to the preferred tab if the chosen one isn't currently available
  // (e.g. comparison was cleared, or mistakes are hidden).
  const tabAvailable =
    tab === "wasted" || (tab === "mistakes" && hasMistakes) || (tab === "compare" && isComparing);
  const activeTab: Tab = tab && tabAvailable ? tab : preferredTab;

  if (!visible) return null;

  const wastedTotal = conflictRows.reduce((n, r) => n + r.redundancies.length, 0);
  const mistakesTotal = mistakeRows.reduce(
    (n, r) => n + r.deaths.length + r.damageDowns.length,
    0
  );
  const compTotal = comparisonRows.reduce((n, r) => n + r.missing.length + r.extra.length, 0);

  const removeAll = () => {
    const targets: MitigationAssignment[] = [];
    for (const row of conflictRows) {
      for (const r of row.redundancies) {
        targets.push(toAssignment(r.wasted));
      }
    }
    onRemove(targets);
  };

  return (
    <section className="rounded-lg border border-zinc-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header row with tabs */}
      <header className="flex items-center gap-1.5 px-3 py-2 border-b border-zinc-100 dark:border-slate-800 flex-wrap">
        {/* Hero tab — wasted mitigation */}
        <button
          type="button"
          onClick={() => setTab("wasted")}
          className={cn(
            "inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer",
            activeTab === "wasted"
              ? "border border-amber-300 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10 text-amber-700 dark:text-amber-400"
              : "border border-transparent text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200"
          )}
        >
          <AlertTriangle size={15} className="shrink-0" />
          Wasted mitigation
          <span
            className={cn(
              "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full border text-[10.5px] font-bold font-mono",
              activeTab === "wasted"
                ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-500/50 text-amber-700 dark:text-amber-400"
                : "bg-zinc-100 dark:bg-slate-800 border-zinc-200 dark:border-slate-700 text-zinc-500 dark:text-slate-400"
            )}
          >
            {wastedTotal}
          </span>
        </button>

        {/* Divider between hero and secondary tabs */}
        {(showMistakes || isComparing) && (
          <span className="w-px h-5 bg-zinc-200 dark:bg-slate-700 mx-1 shrink-0" />
        )}

        {/* Secondary tab — Mistakes */}
        {showMistakes && (
          <button
            type="button"
            onClick={() => setTab("mistakes")}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              activeTab === "mistakes"
                ? "bg-zinc-100 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 text-zinc-800 dark:text-slate-100"
                : "border border-transparent text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200"
            )}
          >
            Mistakes
            <span className="font-mono font-semibold text-zinc-500 dark:text-slate-400">
              {mistakesTotal}
            </span>
          </button>
        )}

        {/* Secondary tab — Comparison */}
        {isComparing && (
          <button
            type="button"
            onClick={() => setTab("compare")}
            className={cn(
              "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              activeTab === "compare"
                ? "bg-zinc-100 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 text-zinc-800 dark:text-slate-100"
                : "border border-transparent text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-200"
            )}
          >
            Comparison
            {isComparing && comparisonLabel && (
              <span className="max-w-[10rem] truncate text-zinc-400 dark:text-slate-500">
                {comparisonLabel}
              </span>
            )}
            <span className="font-mono font-semibold text-zinc-500 dark:text-slate-400">
              {compTotal}
            </span>
          </button>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Context action */}
        {activeTab === "wasted" && wastedTotal > 0 && open && (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={removeAll}>
            <Trash2 size={13} />
            Remove all
          </Button>
        )}
        {activeTab === "compare" && comparisonUrl && open && (
          <a
            href={comparisonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-zinc-200 dark:border-slate-700 text-xs text-zinc-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
          >
            <ExternalLink size={12} />
            Open
          </a>
        )}

        {/* Collapse chevron */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
        >
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
      </header>

      {open && (
        <div className="p-4">
          {activeTab === "wasted" && <WastedTab rows={conflictRows} onRemove={onRemove} />}
          {activeTab === "mistakes" && <MistakesTab rows={mistakeRows} />}
          {activeTab === "compare" && <ComparisonTab rows={comparisonRows} />}
        </div>
      )}
    </section>
  );
}
