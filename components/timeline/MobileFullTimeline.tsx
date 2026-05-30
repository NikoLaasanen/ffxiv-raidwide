"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import type { TimelineRow } from "@/types/timeline";
import type { PhaseDivider } from "@/types/player";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { RowMitigation } from "@/lib/compute-mitigation";
import type { CellState } from "@/components/timeline/Timeline";
import { JOB_GROUPS } from "@/lib/jobs";
import { DAMAGE_TYPE_ICON, MECHANIC_BADGE } from "@/lib/timeline-constants";
import { formatTimestamp } from "@/lib/format-timestamp";
import { cn } from "@/lib/utils";

type Role = "tank" | "healer" | "dps";

const ROLE_COLOR: Record<Role, string> = {
  tank: "#60a5fa",
  healer: "#4ade80",
  dps: "#f472b6",
};
const ROLE_LABEL: Record<Role, string> = { tank: "Tanks", healer: "Healers", dps: "DPS" };
const ROLE_ORDER: Role[] = ["tank", "healer", "dps"];

const JOB_ROLE = new Map<JobAbbreviation, Role>();
for (const g of JOB_GROUPS) {
  const role: Role = g.label === "Tank" ? "tank" : g.label === "Healer" ? "healer" : "dps";
  for (const j of g.jobs) JOB_ROLE.set(j, role);
}

interface MobileFullTimelineProps {
  className?: string;
  visibleRows: TimelineRow[];
  phases: PhaseDivider[];
  rowCellStates: CellState[][];
  rowMitigations: RowMitigation[];
  selectedJobs: JobAbbreviation[];
  abilitiesByJob: Record<string, JobAbilityRecord[]>;
  onToggle: (timestamp: number, job: JobAbbreviation, abilityId: string) => void;
  onTogglePhase: (timestamp: number) => void;
  readOnly?: boolean;
}

type Group = { phase: PhaseDivider | null; rows: { row: TimelineRow; rowIndex: number }[] };

export function MobileFullTimeline({
  className,
  visibleRows,
  phases,
  rowCellStates,
  rowMitigations,
  selectedJobs,
  abilitiesByJob,
  onToggle,
  onTogglePhase,
  readOnly,
}: MobileFullTimelineProps) {
  // Which event card is expanded (local UI state — intentionally not synced).
  const [expanded, setExpanded] = useState<number | null>(null);

  // Group visible rows under their phases, mirroring Timeline's displayItems logic.
  const groups = useMemo<Group[]>(() => {
    const sorted = [...phases].sort((a, b) => a.timestamp - b.timestamp);
    const result: Group[] = [];
    const preRows: Group["rows"] = [];
    let gi = 0;
    let current: Group | null = null;
    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i];
      while (gi < sorted.length && sorted[gi].timestamp <= row.timestamp) {
        current = { phase: sorted[gi], rows: [] };
        result.push(current);
        gi++;
      }
      if (current) current.rows.push({ row, rowIndex: i });
      else preRows.push({ row, rowIndex: i });
    }
    while (gi < sorted.length) {
      result.push({ phase: sorted[gi], rows: [] });
      gi++;
    }
    if (preRows.length) result.unshift({ phase: null, rows: preRows });
    return result;
  }, [visibleRows, phases]);

  // Split a row's flat cell-state array back into per-job slices, matching the
  // table's flattening (one placeholder entry for a job with no abilities).
  const cellStatesByJob = (cellStates: CellState[]): Map<JobAbbreviation, CellState[]> => {
    const map = new Map<JobAbbreviation, CellState[]>();
    let idx = 0;
    for (const job of selectedJobs) {
      const abils = abilitiesByJob[job] ?? [];
      if (abils.length === 0) {
        map.set(job, []);
        idx++;
      } else {
        map.set(job, cellStates.slice(idx, idx + abils.length));
        idx += abils.length;
      }
    }
    return map;
  };

  return (
    <div className={cn("rounded-lg border border-zinc-200 dark:border-slate-800", className)}>
      {groups.map((g, gIdx) => {
        const collapsed = g.phase?.collapsed ?? false;
        const span =
          g.rows.length > 0
            ? `${formatTimestamp(g.rows[0].row.timestamp)} – ${formatTimestamp(g.rows[g.rows.length - 1].row.timestamp)}`
            : "";
        return (
          <div key={g.phase ? `phase-${g.phase.timestamp}` : `pre-${gIdx}`}>
            {g.phase && (
              <button
                type="button"
                onClick={() => onTogglePhase(g.phase!.timestamp)}
                className="sticky top-0 z-10 flex w-full items-center gap-2.5 border-y border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-left dark:border-slate-800 dark:bg-slate-900 cursor-pointer"
              >
                <ChevronDown
                  size={14}
                  className={cn("shrink-0 text-teal-600 transition-transform dark:text-teal-400", collapsed && "-rotate-90")}
                />
                <span className="text-sm font-bold text-zinc-800 dark:text-slate-100">{g.phase.name}</span>
                {span && <span className="font-mono text-[10.5px] text-zinc-400 dark:text-slate-500">{span}</span>}
                <span className="flex-1" />
                <span className="text-[11px] text-zinc-400 dark:text-slate-500">{g.rows.length} events</span>
              </button>
            )}
            {!collapsed && (
              <div className="flex flex-col gap-2 p-3">
                {g.rows.map(({ row, rowIndex }) => (
                  <EventCard
                    key={`${row.timestamp}-${row.bossAbility}-${rowIndex}`}
                    row={row}
                    mitigation={rowMitigations[rowIndex]}
                    cellStatesByJob={cellStatesByJob(rowCellStates[rowIndex] ?? [])}
                    selectedJobs={selectedJobs}
                    abilitiesByJob={abilitiesByJob}
                    open={expanded === rowIndex}
                    onOpen={() => setExpanded((e) => (e === rowIndex ? null : rowIndex))}
                    onToggle={onToggle}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── mit% bar ──────────────────────────────────────────────────────
function MitMeter({ mit }: { mit: number }) {
  if (!mit || mit <= 0) {
    return <span className="font-mono text-[11px] text-zinc-300 dark:text-slate-600">—</span>;
  }
  const tone =
    mit >= 40
      ? { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" }
      : mit >= 25
        ? { bar: "bg-teal-500 dark:bg-teal-400", text: "text-teal-600 dark:text-teal-400" }
        : { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-[52px] overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 dark:border-slate-700 dark:bg-slate-800">
        <span className={cn("block h-full rounded-full", tone.bar)} style={{ width: `${Math.min(100, mit)}%` }} />
      </span>
      <span className={cn("font-mono text-[11.5px] font-bold tabular-nums", tone.text)}>{Math.round(mit)}%</span>
    </span>
  );
}

// ── mistake tag (Deaths [n] / Damage downs [n]) ───────────────────
function MistakeTag({ icon, label, n }: { icon: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-rose-300/60 bg-rose-50 px-1.5 py-0.5 dark:border-rose-500/30 dark:bg-rose-500/10">
      <Image src={icon} alt="" width={12} height={12} />
      <span className="text-[10.5px] font-semibold text-rose-600 dark:text-rose-400">{label}</span>
      <span className="font-mono text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400">{n}</span>
    </span>
  );
}

// ── ability tile (real icon + state styling) ──────────────────────
function AbilityTile({
  ability,
  cell,
  size,
  locked,
  readOnly,
  onClick,
}: {
  ability: JobAbilityRecord;
  cell: CellState | undefined;
  size: number;
  locked: boolean;
  readOnly?: boolean;
  onClick?: () => void;
}) {
  const assigned = cell?.assigned ?? false;
  const inDuration = cell?.inDuration ?? false;
  const onCooldown = cell?.onCooldown ?? false;
  const conflict = (cell?.conflict ?? false) && assigned;
  const compareState = cell?.compareState ?? null;
  const tappable = !readOnly && !locked;

  const showBadge = compareState === "original-only" || compareState === "comparison-only";

  const tileClass = cn(
    "flex items-center justify-center overflow-hidden rounded-md border transition-colors",
    tappable ? "cursor-pointer" : "cursor-default",
    assigned
      ? "border-teal-400 bg-teal-500/15 dark:border-teal-400 dark:bg-teal-400/15"
      : inDuration
        ? "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30"
        : "border-zinc-300 bg-transparent hover:border-teal-400 dark:border-slate-600 dark:hover:border-teal-500",
    conflict && "border-amber-500 ring-2 ring-amber-500 dark:border-amber-400 dark:ring-amber-400",
    compareState === "original-only" && "ring-2 ring-red-500 dark:ring-red-400",
    compareState === "comparison-only" && "ring-2 ring-green-500 dark:ring-green-400",
  );

  const inner = (
    <Image
      src={ability.iconPath}
      alt={ability.name}
      width={size - 4}
      height={size - 4}
      className={cn(
        "rounded-sm",
        assigned ? "opacity-100" : inDuration ? "opacity-80" : onCooldown ? "opacity-30 grayscale" : "opacity-40",
      )}
    />
  );

  return (
    <span className="relative inline-flex">
      {/* Render as a real button only when interactive — avoids nested <button>
          inside the collapsed card's summary button (locked/coverage tiles). */}
      {tappable ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={`${assigned ? "Unassign" : "Assign"} ${ability.name}`}
          className={tileClass}
          style={{ width: size, height: size }}
        >
          {inner}
        </button>
      ) : (
        <span className={tileClass} style={{ width: size, height: size }} aria-hidden>
          {inner}
        </span>
      )}
      {showBadge && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold leading-none text-white",
            compareState === "original-only" ? "bg-red-500" : "bg-green-500",
          )}
        >
          {compareState === "original-only" ? "−" : "+"}
        </span>
      )}
    </span>
  );
}

// ── event card ────────────────────────────────────────────────────
function EventCard({
  row,
  mitigation,
  cellStatesByJob,
  selectedJobs,
  abilitiesByJob,
  open,
  onOpen,
  onToggle,
  readOnly,
}: {
  row: TimelineRow;
  mitigation: RowMitigation | undefined;
  cellStatesByJob: Map<JobAbbreviation, CellState[]>;
  selectedJobs: JobAbbreviation[];
  abilitiesByJob: Record<string, JobAbilityRecord[]>;
  open: boolean;
  onOpen: () => void;
  onToggle: (timestamp: number, job: JobAbbreviation, abilityId: string) => void;
  readOnly?: boolean;
}) {
  const dim = !row.damageEvent;
  const mech = row.mechanicType && row.mechanicType !== "unknown" ? MECHANIC_BADGE[row.mechanicType] : null;
  const mit = mitigation?.totalMitPercent ?? 0;

  // Mistake counts (mirrors the table's per-row summary logic).
  const deaths = Object.values(row.playerMistakes).filter((m) => m?.dead).length;
  const damageDowns = Object.values(row.playerMistakes).filter((m) => m?.damageDownTimestamp != null).length;
  const hasMistakes = deaths > 0 || damageDowns > 0;

  // Collapsed coverage tiles: abilities that are assigned or in-duration.
  const coverage: { job: JobAbbreviation; ability: JobAbilityRecord; cell: CellState }[] = [];
  if (!dim) {
    for (const job of selectedJobs) {
      const abils = abilitiesByJob[job] ?? [];
      const cells = cellStatesByJob.get(job) ?? [];
      abils.forEach((ab, i) => {
        const c = cells[i];
        if (c && (c.assigned || c.inDuration)) coverage.push({ job, ability: ab, cell: c });
      });
    }
  }

  const railColor = dim
    ? "transparent"
    : row.damageEvent?.type === "magical"
      ? "#a78bfa"
      : row.damageEvent?.type === "physical"
        ? "#fb923c"
        : "#fbbf24";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white dark:bg-slate-900",
        open
          ? "border-teal-400/60 shadow-md dark:border-teal-400/50"
          : "border-zinc-200 dark:border-slate-800",
      )}
    >
      <button
        type="button"
        onClick={dim ? undefined : onOpen}
        className={cn("flex w-full items-stretch text-left", dim ? "cursor-default" : "cursor-pointer")}
      >
        <span className="w-1 shrink-0" style={{ background: railColor, opacity: dim ? 0 : 0.85 }} />
        <span className="min-w-0 flex-1 px-3 py-2.5">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "shrink-0 font-mono text-sm font-bold tabular-nums",
                dim ? "text-zinc-300 dark:text-slate-600" : "text-zinc-800 dark:text-slate-100",
              )}
            >
              {formatTimestamp(row.timestamp)}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-semibold",
                dim ? "text-zinc-400 dark:text-slate-500" : "text-zinc-800 dark:text-slate-100",
              )}
            >
              {row.bossAbility}
            </span>
            {mech && (
              <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", mech.className)}>
                {mech.label}
              </span>
            )}
            {!dim && (
              <ChevronDown
                size={14}
                className={cn("shrink-0 text-zinc-400 transition-transform dark:text-slate-500", open && "rotate-180")}
              />
            )}
          </span>

          {dim ? (
            <span className="mt-1.5 block text-[11.5px] text-zinc-400 dark:text-slate-600">No raidwide damage</span>
          ) : (
            <>
              <span className="mt-2 flex items-center gap-2">
                {row.damageEvent && (
                  <Image
                    src={DAMAGE_TYPE_ICON[row.damageEvent.type]}
                    alt={row.damageEvent.type}
                    width={17}
                    height={17}
                  />
                )}
                {row.damageEvent && (
                  <span className="font-mono text-[12.5px] tabular-nums text-zinc-500 dark:text-slate-400">
                    {(mit > 0 && mitigation?.mitigatedDamage != null
                      ? mitigation.mitigatedDamage
                      : row.damageEvent.rawDamage
                    ).toLocaleString()}
                  </span>
                )}
                <span className="flex-1" />
                <MitMeter mit={mit} />
              </span>

              {(coverage.length > 0 || hasMistakes) && (
                <span className="mt-2.5 flex items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {coverage.map(({ job, ability, cell }, k) => (
                      <span key={`${job}-${ability.id}-${k}`} className="relative inline-flex">
                        <AbilityTile ability={ability} cell={cell} size={22} locked readOnly />
                        <span
                          className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-white dark:ring-slate-900"
                          style={{ background: ROLE_COLOR[JOB_ROLE.get(job) ?? "dps"] }}
                        />
                      </span>
                    ))}
                  </span>
                  {hasMistakes && (
                    <span className="flex shrink-0 gap-1.5">
                      {deaths > 0 && <MistakeTag icon="/icons/Death.png" label="Deaths" n={deaths} />}
                      {damageDowns > 0 && <MistakeTag icon="/icons/DamageDown.png" label="Damage downs" n={damageDowns} />}
                    </span>
                  )}
                </span>
              )}
            </>
          )}
        </span>
      </button>

      {open && !dim && (
        <div className="border-t border-zinc-200 bg-zinc-50/60 px-0 py-1 dark:border-slate-800 dark:bg-slate-950/40">
          {ROLE_ORDER.map((role) => {
            const jobs = selectedJobs.filter(
              (j) => (JOB_ROLE.get(j) ?? "dps") === role && (abilitiesByJob[j] ?? []).length > 0,
            );
            if (jobs.length === 0) return null;
            return (
              <div key={role}>
                <div className="flex items-center gap-1.5 px-3.5 pt-2.5 pb-1">
                  <span className="h-1.5 w-1.5 rounded-sm" style={{ background: ROLE_COLOR[role] }} />
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: ROLE_COLOR[role] }}
                  >
                    {ROLE_LABEL[role]}
                  </span>
                </div>
                {jobs.map((job) => {
                  const abils = abilitiesByJob[job] ?? [];
                  const cells = cellStatesByJob.get(job) ?? [];
                  return (
                    <div key={job} className="flex items-center gap-2.5 px-3.5 py-1.5">
                      <span className="w-9 shrink-0 font-mono text-xs font-bold text-zinc-700 dark:text-slate-200">
                        {job}
                      </span>
                      <span className="flex flex-wrap gap-1.5">
                        {abils.map((ab, i) => {
                          const cell = cells[i];
                          const locked = (cell?.inDuration ?? false) || (cell?.onCooldown ?? false);
                          return (
                            <AbilityTile
                              key={ab.id}
                              ability={ab}
                              cell={cell}
                              size={34}
                              locked={locked}
                              readOnly={readOnly}
                              onClick={() => onToggle(row.timestamp, job, ab.id)}
                            />
                          );
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* legend — Assigned · In duration · On cooldown */}
          <div className="flex flex-wrap items-center gap-3.5 px-3.5 pb-2.5 pt-2">
            <LegendSwatch label="Assigned" kind="assigned" />
            <LegendSwatch label="In duration" kind="inDuration" />
            <LegendSwatch label="On cooldown" kind="onCooldown" />
          </div>
        </div>
      )}
    </div>
  );
}

function LegendSwatch({ label, kind }: { label: string; kind: "assigned" | "inDuration" | "onCooldown" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-3.5 w-3.5 rounded border",
          kind === "assigned"
            ? "border-teal-400 bg-teal-500/15 dark:border-teal-400 dark:bg-teal-400/15"
            : kind === "inDuration"
              ? "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30"
              : "border-zinc-300 bg-zinc-200 opacity-50 dark:border-slate-600 dark:bg-slate-700",
        )}
      />
      <span className="text-[10.5px] text-zinc-500 dark:text-slate-400">{label}</span>
    </span>
  );
}
