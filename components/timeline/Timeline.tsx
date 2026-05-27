"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from "react";
import type { TimelineRow, MitigationAssignment, MechanicType, PlayerMistakeState } from "@/types/timeline";
import type { DamageType } from "@/types/common";
import type { Player, PhaseDivider } from "@/types/player";
import { ChevronDown, ChevronRight, Play, Pause, RotateCcw, ExternalLink } from "lucide-react";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { PlayerCastEvent } from "@/types/fflogs";
import { JOB_NAMES, JOB_GROUPS, ALL_JOBS, JOB_ROLE_COLOR } from "@/lib/jobs";
import { formatTimestamp } from "@/lib/format-timestamp";
import { computeAssignments } from "@/lib/compute-assignments";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useJobAbilities } from "@/hooks/use-job-abilities";
import { computeRowMitigation } from "@/lib/compute-mitigation";
import { isAutoAttack as isAutoAttackAbility } from "@/lib/is-auto-attack";
import type { RowMitigation } from "@/lib/compute-mitigation";
import { usePreferencesStore } from "@/store/preferences-store";
import { useShallow } from "zustand/react/shallow";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PreferencesDialog } from "@/components/preferences/PreferencesDialog";
import { FavoriteButton } from "@/components/plan/FavoriteButton";
import { CompareDialog } from "@/components/plan/CompareDialog";
import { usePlanStore } from "@/store/plan-store";
import { MyTimeline } from "@/components/timeline/MyTimeline";

interface TimelineProps {
  timeline: TimelineRow[];
  players: Player[];
  casts?: PlayerCastEvent[];
  phases?: PhaseDivider[];
  initialAssignments?: MitigationAssignment[];
  onAssignmentsChange?: (a: MitigationAssignment[]) => void;
  onPhasesChange?: (phases: PhaseDivider[]) => void;
  onPlayersChange?: (players: Player[]) => void;
  readOnly?: boolean;
  viewLinkId?: string;
  title?: string;
  encounterId?: string | null;
  raidplanLink?: string;
  headerLeft?: React.ReactNode;
}

type CellState = {
  assigned: boolean;
  onCooldown: boolean;
  inDuration: boolean;
  cooldownTooltip: string;
  compareState: "original-only" | "comparison-only" | "both" | "neither" | null;
};

type DisplayItem =
  | { kind: "phase"; phase: PhaseDivider; endTimestamp: number }
  | { kind: "row"; row: TimelineRow; rowIndex: number };

const TYPE_CYCLE: DamageType[] = ["magical", "physical", "unique"];


const DAMAGE_TYPE_ICON: Record<DamageType, string> = {
  magical:  "/icons/MagicalDamage.png",
  physical: "/icons/PhysicalDamage.png",
  unique:   "/icons/UniqueDamage.png",
};

const TH_BASE = "px-3 py-2.5 text-center font-medium text-zinc-500 dark:text-slate-400";
const TH_FIXED = "px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-slate-400";

const MECHANIC_BADGE: Record<MechanicType, { label: string; className: string }> = {
  enrage:     { label: "Enrage",     className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  tankbuster: { label: "Tankbuster", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  party:      { label: "Party",      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  single:     { label: "Single",     className: "bg-zinc-100 text-zinc-500 dark:bg-slate-800 dark:text-slate-400" },
  unknown:    { label: "—",          className: "text-zinc-300 dark:text-slate-600" },
};

type ActivePeriod = { start: number; end: number };
type PlayerRanges = {
  deadRows: number[];
  weaknesses: ActivePeriod[];
  brinks: ActivePeriod[];
  damageDowns: ActivePeriod[];
};

function getMistakeBg(
  rowTs: number,
  ms: PlayerMistakeState | undefined,
  ranges: PlayerRanges | undefined,
): string | undefined {
  if (!ms) return undefined;
  if (ms.deadGray) return "bg-zinc-200/70 dark:bg-slate-700/40";
  if (!ranges) return undefined;

  if (ranges.weaknesses.some((w) => rowTs >= w.start && rowTs <= w.end))
    return "bg-yellow-100 dark:bg-yellow-900/20";
  if (ranges.brinks.some((b) => rowTs >= b.start && rowTs <= b.end))
    return "bg-orange-100 dark:bg-orange-900/20";
  if (ranges.damageDowns.some((d) => rowTs >= d.start && rowTs <= d.end))
    return "bg-red-100 dark:bg-red-900/20";

  return undefined;
}

function MechanicTypeBadge({ type }: { type?: MechanicType }) {
  if (!type || type === "unknown") {
    return <span className="text-zinc-300 dark:text-slate-600">—</span>;
  }
  const { label, className } = MECHANIC_BADGE[type];
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function MistakeCell({ mistakes }: { mistakes?: PlayerMistakeState }) {
  if (!mistakes) return null;
  const { dead, damageDown, damageDownDuration, weakness, weaknessDuration, brinkOfDeath, brinkOfDeathDuration } = mistakes;
  if (!dead && !damageDown && !weakness && !brinkOfDeath) return null;

  const names = [
    dead && "Death",
    weakness && "Weakness",
    brinkOfDeath && "Brink of Death",
    damageDown && "Damage Down",
  ].filter(Boolean) as string[];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center gap-0.5 py-0.5 px-0.5 cursor-default">
          {dead && <Image src="/icons/Death.png" alt="Death" width={16} height={16} />}
          {weakness && (
            <div className="flex items-center gap-0.5">
              <Image src="/icons/Weakness.png" alt="Weakness" width={16} height={16} />
              {weaknessDuration != null && <span className="text-[10px] font-medium text-yellow-500">{Math.round(weaknessDuration)}s</span>}
            </div>
          )}
          {brinkOfDeath && (
            <div className="flex items-center gap-0.5">
              <Image src="/icons/BrinkOfDeath.png" alt="Brink of Death" width={16} height={16} />
              {brinkOfDeathDuration != null && <span className="text-[10px] font-medium text-orange-400">{Math.round(brinkOfDeathDuration)}s</span>}
            </div>
          )}
          {damageDown && (
            <div className="flex items-center gap-0.5">
              <Image src="/icons/DamageDown.png" alt="Damage Down" width={16} height={16} />
              {damageDownDuration != null && <span className="text-[10px] font-medium text-orange-600">{Math.round(damageDownDuration)}s</span>}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {names.join(", ")}
      </TooltipContent>
    </Tooltip>
  );
}

const PhaseDividerRow = memo(function PhaseDividerRow({
  phase,
  endTimestamp,
  colCount,
  onToggle,
  onRename,
  onRemove,
  readOnly,
}: {
  phase: PhaseDivider;
  endTimestamp: number;
  colCount: number;
  onToggle: (ts: number) => void;
  onRename: (ts: number, name: string) => void;
  onRemove: (ts: number) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(phase.name);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed) onRename(phase.timestamp, trimmed);
    else setDraft(phase.name);
  }

  return (
    <tr className="bg-zinc-100/80 dark:bg-slate-800/60 border-y border-zinc-200 dark:border-slate-700">
      <td colSpan={colCount} className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(phase.timestamp)}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-slate-300 transition-colors shrink-0"
            aria-label={phase.collapsed ? "Expand phase" : "Collapse phase"}
          >
            {phase.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          {!readOnly && editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setEditing(false); setDraft(phase.name); }
              }}
              className="text-sm font-medium bg-transparent border-b border-zinc-400 dark:border-slate-500 outline-none px-0.5 w-32 min-w-0"
            />
          ) : (
            <span
              className={cn("text-sm font-medium", !readOnly && "cursor-text hover:text-teal-600 dark:hover:text-teal-400 transition-colors")}
              onClick={readOnly ? undefined : () => { setEditing(true); setDraft(phase.name); }}
            >
              {phase.name}
            </span>
          )}
          <span className="text-xs text-zinc-400 dark:text-slate-500 font-mono">
            {formatTimestamp(phase.timestamp)} – {formatTimestamp(endTimestamp)}
          </span>
          {!readOnly && (
            <button
              onClick={() => onRemove(phase.timestamp)}
              className="ml-auto text-zinc-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors text-base leading-none px-1"
              aria-label="Remove phase divider"
            >
              ×
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

interface RowProps {
  row: TimelineRow;
  index: number;
  players: Player[];
  selectedJobs: JobAbbreviation[];
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
  cellStates: CellState[];
  mitigation: RowMitigation;
  playerByJob: Map<JobAbbreviation, Player>;
  showDamageColumn: boolean;
  showSourceColumn: boolean;
  showMechanicTypeColumn: boolean;
  showMistakesColumn: boolean;
  playerStatusRanges: Map<string, PlayerRanges>;
  onToggle: (timestamp: number, job: JobAbbreviation, abilityId: string) => void;
  onCycle: (bossAbility: string) => void;
  onAddPhase: (ts: number) => void;
  readOnly?: boolean;
  isComparing: boolean;
}

const TimelineBodyRow = memo(
  function TimelineBodyRow({ row, index, players, selectedJobs, abilitiesByJob, cellStates, mitigation, playerByJob, showDamageColumn, showSourceColumn, showMechanicTypeColumn, showMistakesColumn, playerStatusRanges, onToggle, onCycle, onAddPhase, readOnly, isComparing }: RowProps) {
    let cellIndex = 0;

    const deathPlayers = players.filter((p) => row.playerMistakes[p.id]?.dead);
    const ddPlayers = players.filter((p) => row.playerMistakes[p.id]?.damageDownTimestamp != null);
    const hasMistakeSummary = deathPlayers.length > 0 || ddPlayers.length > 0;

    return (
      <tr
        className={cn(
          "group/row transition-colors hover:bg-teal-50/60 dark:hover:bg-teal-950/20",
          index % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-zinc-50/50 dark:bg-slate-900/50"
        )}
      >
        <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-slate-400 relative">
          {formatTimestamp(row.timestamp)}
          {!readOnly && (
            <button
              onClick={() => onAddPhase(row.timestamp)}
              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-all text-[10px] leading-none"
              aria-label="Add phase divider here"
            >
              +
            </button>
          )}
        </td>
        <td className="px-4 py-2 font-medium">
          <span className="flex items-center gap-1.5 flex-wrap">
            {row.bossAbility}
            {row.cleanse && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 cursor-default">
                    Cleanse
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">Players should cleanse this debuff</TooltipContent>
              </Tooltip>
            )}
            {row.interrupt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 cursor-default">
                    Interrupt
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">This ability can be interrupted</TooltipContent>
              </Tooltip>
            )}
          </span>
        </td>
        {showMistakesColumn && (
          <td className="px-3 py-2 text-center">
            {hasMistakeSummary ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 cursor-default focus:outline-none mx-auto">
                    {deathPlayers.length > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Image src="/icons/Death.png" alt="Deaths" width={14} height={14} />
                        {deathPlayers.length > 1 && <span className="text-[10px] font-medium text-slate-500">×{deathPlayers.length}</span>}
                      </span>
                    )}
                    {ddPlayers.length > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Image src="/icons/DamageDown.png" alt="Damage Downs" width={14} height={14} />
                        {ddPlayers.length > 1 && <span className="text-[10px] font-medium text-slate-500">×{ddPlayers.length}</span>}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs space-y-0.5">
                  {deathPlayers.length > 0 && (
                    <div>
                      <span className="font-medium">Deaths: </span>
                      {deathPlayers
                        .map((p) => row.playerMistakes[p.id].deathTimestamp != null ? `${formatTimestamp(row.playerMistakes[p.id].deathTimestamp!)} (${p.job})` : null)
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                  {ddPlayers.length > 0 && (
                    <div>
                      <span className="font-medium">Damage Downs: </span>
                      {ddPlayers
                        .map((p) => row.playerMistakes[p.id].damageDownTimestamp != null ? `${formatTimestamp(row.playerMistakes[p.id].damageDownTimestamp!)} (${p.job})` : null)
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-zinc-300 dark:text-slate-600">—</span>
            )}
          </td>
        )}
        <td className="px-4 py-2">
          {row.damageEvent ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {readOnly ? (
                  <div className="block rounded p-0.5">
                    <Image
                      src={DAMAGE_TYPE_ICON[row.damageEvent.type]}
                      alt={row.damageEvent.type}
                      width={24}
                      height={24}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => onCycle(row.bossAbility)}
                    className="block rounded p-0.5 hover:ring-2 hover:ring-zinc-300 dark:hover:ring-slate-600 transition-shadow"
                    aria-label={`Damage type: ${row.damageEvent.type}. Click to cycle.`}
                  >
                    <Image
                      src={DAMAGE_TYPE_ICON[row.damageEvent.type]}
                      alt={row.damageEvent.type}
                      width={24}
                      height={24}
                    />
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent side="right" className="capitalize">
                {row.damageEvent.type}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-zinc-400 dark:text-slate-600">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-slate-400">
          {mitigation.totalMitPercent > 0 ? (
            `${Math.round(mitigation.totalMitPercent)}%`
          ) : (
            <span className="text-zinc-300 dark:text-slate-600">—</span>
          )}
        </td>
        {isComparing && (() => {
          const addedCount = cellStates.filter((cs) => cs.compareState === "comparison-only").length;
          const removedCount = cellStates.filter((cs) => cs.compareState === "original-only").length;
          return (
            <td className="px-3 py-2 text-center font-mono text-xs whitespace-nowrap">
              {addedCount === 0 && removedCount === 0 ? (
                <span className="text-zinc-300 dark:text-slate-600">—</span>
              ) : (
                <>
                  {addedCount > 0 && <span className="text-green-600 dark:text-green-400">+{addedCount}</span>}
                  {addedCount > 0 && removedCount > 0 && <span className="text-zinc-400 dark:text-slate-500"> / </span>}
                  {removedCount > 0 && <span className="text-red-500 dark:text-red-400">−{removedCount}</span>}
                </>
              )}
            </td>
          );
        })()}
        {showDamageColumn && (
          <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
            {row.damageEvent != null ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">
                    {mitigation.totalMitPercent > 0 && mitigation.mitigatedDamage != null
                      ? mitigation.mitigatedDamage.toLocaleString()
                      : row.damageEvent.rawDamage.toLocaleString()}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <div className="space-y-1 text-right text-xs font-mono">
                    <div className="text-zinc-400">Raw: {row.damageEvent.rawDamage.toLocaleString()}</div>
                    {[...row.damageEvent.allDamages]
                      .sort((a, b) => b - a)
                      .map((d, i) => (
                        <div key={i}>{d.toLocaleString()}</div>
                      ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              "—"
            )}
          </td>
        )}
        {showSourceColumn && (
          <td className="px-4 py-2 text-sm text-zinc-600 dark:text-slate-400 max-w-[8rem] truncate">
            {row.sourceName ?? "—"}
          </td>
        )}
        {showMechanicTypeColumn && (
          <td className="px-4 py-2 text-center">
            <MechanicTypeBadge type={row.mechanicType} />
          </td>
        )}
        {selectedJobs.flatMap((job) => {
          const abilities = abilitiesByJob[job] ?? [];
          const player = playerByJob.get(job);
          const showMistakes = showMistakesColumn && (player?.mistakeColumnsEnabled ?? false);
          const mistakeCell = showMistakes && player ? (() => {
            const ms = row.playerMistakes[player.id];
            const mistakeBg = getMistakeBg(row.timestamp, ms, playerStatusRanges.get(player.id));
            return (
              <td key={`${job}-mistakes`} className={cn("w-10 border-l border-zinc-100 dark:border-slate-800 align-middle", mistakeBg)}>
                <MistakeCell mistakes={ms} />
              </td>
            );
          })() : null;

          if (abilities.length === 0) {
            cellIndex++;
            return [
              mistakeCell,
              <td
                key={job}
                className={cn("px-3 py-2 text-center text-zinc-300 dark:text-slate-700", !showMistakes && "border-l border-zinc-100 dark:border-slate-800")}
              >
                —
              </td>,
            ].filter(Boolean);
          }
          return [
            mistakeCell,
            ...abilities.map((ab, i) => {
            const { assigned, onCooldown, inDuration, cooldownTooltip, compareState } = cellStates[cellIndex++];
            const showBadge = compareState === "original-only" || compareState === "comparison-only";

            const btn = (
              <button
                onClick={readOnly ? undefined : () => onToggle(row.timestamp, job, ab.id)}
                disabled={readOnly}
                className={cn(
                  "w-5 h-5 rounded mx-auto block transition-colors",
                  readOnly && "cursor-default pointer-events-none",
                  assigned
                    ? "bg-teal-500 dark:bg-teal-400"
                    : onCooldown
                    ? "bg-zinc-200 dark:bg-slate-700 cursor-not-allowed opacity-50"
                    : inDuration
                    ? "border border-teal-200 dark:border-teal-800 hover:border-teal-400 dark:hover:border-teal-500"
                    : "border border-zinc-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500",
                  compareState === "original-only" && "ring-2 ring-red-500 dark:ring-red-400",
                  compareState === "comparison-only" && "ring-2 ring-green-500 dark:ring-green-400"
                )}
                aria-label={`Toggle ${ab.name}`}
              />
            );

            const badge = showBadge ? (
              <span
                className={cn(
                  "pointer-events-none absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold leading-none",
                  compareState === "original-only" ? "bg-red-500 text-white" : "bg-green-500 text-white"
                )}
                aria-hidden
              >
                {compareState === "original-only" ? "−" : "+"}
              </span>
            ) : null;

            const cellContent = badge ? (
              <span className="relative inline-block">{btn}{badge}</span>
            ) : btn;

            return (
              <td
                key={`${job}-${ab.id}`}
                className={cn(
                  "py-2 w-8 text-center",
                  i === 0 && !showMistakes && "border-l border-zinc-100 dark:border-slate-800",
                  inDuration && "bg-teal-50 dark:bg-teal-950/30"
                )}
              >
                {onCooldown ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
                    <TooltipContent>{cooldownTooltip}</TooltipContent>
                  </Tooltip>
                ) : (
                  cellContent
                )}
              </td>
            );
          })];
        })}
      </tr>
    );
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.index === next.index &&
    prev.players === next.players &&
    prev.selectedJobs === next.selectedJobs &&
    prev.abilitiesByJob === next.abilitiesByJob &&
    prev.playerByJob === next.playerByJob &&
    prev.showDamageColumn === next.showDamageColumn &&
    prev.showSourceColumn === next.showSourceColumn &&
    prev.showMechanicTypeColumn === next.showMechanicTypeColumn &&
    prev.showMistakesColumn === next.showMistakesColumn &&
    prev.playerStatusRanges === next.playerStatusRanges &&
    prev.onToggle === next.onToggle &&
    prev.onCycle === next.onCycle &&
    prev.onAddPhase === next.onAddPhase &&
    prev.readOnly === next.readOnly &&
    prev.isComparing === next.isComparing &&
    prev.mitigation.totalMitPercent === next.mitigation.totalMitPercent &&
    prev.mitigation.mitigatedDamage === next.mitigation.mitigatedDamage &&
    prev.cellStates.length === next.cellStates.length &&
    prev.cellStates.every(
      (c, i) =>
        c.assigned === next.cellStates[i].assigned &&
        c.onCooldown === next.cellStates[i].onCooldown &&
        c.inDuration === next.cellStates[i].inDuration &&
        c.cooldownTooltip === next.cellStates[i].cooldownTooltip &&
        c.compareState === next.cellStates[i].compareState
    )
);

const EMPTY_PHASES: PhaseDivider[] = [];

export function Timeline({ timeline, players, casts, phases = EMPTY_PHASES, initialAssignments, onAssignmentsChange, onPhasesChange, onPlayersChange, readOnly, viewLinkId, title, encounterId, raidplanLink, headerLeft }: TimelineProps) {
  const {
    showAutoAttacks,
    showDamageColumn,
    showSourceColumn,
    showMechanicTypeColumn,
    showMistakesColumn,
    activationBuffer,
    abilityTargetFilter,
    abilityTypeFilter,
    timelineViewMode,
    myTimelinePlayerJob,
    myPlanDefaultJob,
    myPlanCompactView,
    setTimelineViewMode,
    setMyTimelinePlayerJob,
  } = usePreferencesStore(
    useShallow((s) => ({
      showAutoAttacks: s.showAutoAttacks,
      showDamageColumn: s.showDamageColumn,
      showSourceColumn: s.showSourceColumn,
      showMechanicTypeColumn: s.showMechanicTypeColumn,
      showMistakesColumn: s.showMistakesColumn,
      activationBuffer: s.activationBuffer,
      abilityTargetFilter: s.abilityTargetFilter,
      abilityTypeFilter: s.abilityTypeFilter,
      timelineViewMode: s.timelineViewMode,
      myTimelinePlayerJob: s.myTimelinePlayerJob,
      myPlanDefaultJob: s.myPlanDefaultJob,
      myPlanCompactView: s.myPlanCompactView,
      setTimelineViewMode: s.setTimelineViewMode,
      setMyTimelinePlayerJob: s.setMyTimelinePlayerJob,
    }))
  );

  const [localPlayers, setLocalPlayers] = useState<Player[]>(players);
  useEffect(() => setLocalPlayers(players), [players]);
  const onPlayersChangeRef = useRef(onPlayersChange);
  useLayoutEffect(() => { onPlayersChangeRef.current = onPlayersChange; });
  useEffect(() => { onPlayersChangeRef.current?.(localPlayers); }, [localPlayers]);

  const allJobs = useMemo(
    () =>
      [...new Set(localPlayers.map((p) => p.job))].sort(
        (a, b) => ALL_JOBS.indexOf(a) - ALL_JOBS.indexOf(b)
      ),
    [localPlayers]
  );
  const [selectedJobs, setSelectedJobs] = useState<JobAbbreviation[]>(() => allJobs);
  const [myPlanEditJobs, setMyPlanEditJobs] = useState<JobAbbreviation[]>(() => allJobs);
  useEffect(() => {
    setMyPlanEditJobs((prev) => {
      const existing = new Set(prev);
      const missing = allJobs.filter((j) => !existing.has(j));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [allJobs]);
  const [myPlanViewJobs, setMyPlanViewJobs] = useState<JobAbbreviation[]>(() => {
    if (myPlanDefaultJob && allJobs.includes(myPlanDefaultJob)) return [myPlanDefaultJob];
    return allJobs.length ? [allJobs[0]] : [];
  });
  const { abilitiesByJob, isLoading } = useJobAbilities(allJobs);
  const initializedRef = useRef(!!initialAssignments?.length);
  const [assignments, setAssignments] = useState<MitigationAssignment[]>(
    () => initialAssignments ?? []
  );
  const onAssignmentsChangeRef = useRef(onAssignmentsChange);
  useLayoutEffect(() => { onAssignmentsChangeRef.current = onAssignmentsChange; });
  useEffect(() => { onAssignmentsChangeRef.current?.(assignments); }, [assignments]);
  const [localTimeline, setLocalTimeline] = useState<TimelineRow[]>(timeline);
  useEffect(() => { setLocalTimeline(timeline); }, [timeline]);

  const [localPhases, setLocalPhases] = useState<PhaseDivider[]>(phases);
  useEffect(() => { setLocalPhases(phases); }, [phases]);
  const onPhasesChangeRef = useRef(onPhasesChange);
  useLayoutEffect(() => { onPhasesChangeRef.current = onPhasesChange; });
  useEffect(() => { onPhasesChangeRef.current?.(localPhases); }, [localPhases]);

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startTimeRef.current = Date.now();
    const tick = () => {
      setElapsedMs(accumulatedRef.current + (Date.now() - startTimeRef.current!));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isRunning]);

  function handlePlayPause() {
    if (isRunning) {
      accumulatedRef.current = elapsedMs;
      setIsRunning(false);
    } else {
      setIsRunning(true);
    }
  }

  function handleReset() {
    setIsRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    accumulatedRef.current = 0;
    setElapsedMs(0);
  }

  const mySelectedPlayers = useMemo(
    () => localPlayers.filter((p) => myPlanViewJobs.includes(p.job)),
    [localPlayers, myPlanViewJobs]
  );

  const { myCurrentRow, myNextRow } = useMemo(() => {
    if (mySelectedPlayers.length === 0) return { myCurrentRow: null, myNextRow: null };
    const playerIds = new Set(mySelectedPlayers.map((p) => p.id));
    const ts = new Set(assignments.filter((a) => playerIds.has(a.playerId)).map((a) => a.timestamp));
    const assigned = localTimeline.filter((r) => !r.hidden && ts.has(r.timestamp));
    let current: TimelineRow | null = null;
    for (const r of assigned) {
      if (r.timestamp <= elapsedMs) current = r;
      else break;
    }
    const next = assigned.find((r) => r.timestamp > elapsedMs) ?? null;
    return { myCurrentRow: current, myNextRow: next };
  }, [mySelectedPlayers, assignments, localTimeline, elapsedMs]);

  const myNextRowAbilities = useMemo(() => {
    if (!myNextRow || mySelectedPlayers.length === 0) return [];
    const playerIds = new Set(mySelectedPlayers.map((p) => p.id));
    const abilityIds = new Set(
      assignments.filter((a) => playerIds.has(a.playerId) && a.timestamp === myNextRow.timestamp).map((a) => a.abilityId)
    );
    const seen = new Set<string>();
    return Object.values(abilitiesByJob).flat().filter((ab) => {
      if (!abilityIds.has(ab.id) || seen.has(ab.id)) return false;
      seen.add(ab.id);
      return true;
    });
  }, [myNextRow, mySelectedPlayers, assignments, abilitiesByJob]);

  const myNextRowFollowups = useMemo(() => {
    if (!myNextRow || mySelectedPlayers.length === 0) return [];
    const playerIds = new Set(mySelectedPlayers.map((p) => p.id));
    const cutoff = myNextRow.timestamp + 5000;
    const byTimestamp = new Map<number, Set<string>>();
    for (const a of assignments) {
      if (playerIds.has(a.playerId) && a.timestamp > myNextRow.timestamp && a.timestamp <= cutoff) {
        if (!byTimestamp.has(a.timestamp)) byTimestamp.set(a.timestamp, new Set());
        byTimestamp.get(a.timestamp)!.add(a.abilityId);
      }
    }
    if (byTimestamp.size === 0) return [];
    const followupRows = localTimeline
      .filter((r) => !r.hidden && byTimestamp.has(r.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);
    const allAbilities = Object.values(abilitiesByJob).flat();
    return followupRows.map((row) => {
      const abilityIds = byTimestamp.get(row.timestamp)!;
      const seen = new Set<string>();
      const abilities = allAbilities.filter((ab) => {
        if (!abilityIds.has(ab.id) || seen.has(ab.id)) return false;
        seen.add(ab.id);
        return true;
      });
      return { row, abilities };
    }).filter((f) => f.abilities.length > 0);
  }, [myNextRow, mySelectedPlayers, assignments, localTimeline, abilitiesByJob]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#my-plan") {
      setTimelineViewMode("my");
    }
    // setTimelineViewMode is a stable Zustand setter — run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addPhase(atTimestamp: number) {
    setLocalPhases((prev) => {
      if (prev.some((p) => p.timestamp === atTimestamp)) return prev;
      return [...prev, { timestamp: atTimestamp, name: `Phase ${prev.length + 1}`, collapsed: false }];
    });
  }
  const stableTogglePhase = useCallback((timestamp: number) => {
    setLocalPhases((prev) => prev.map((p) => p.timestamp === timestamp ? { ...p, collapsed: !p.collapsed } : p));
  }, []);
  const stableRenamePhase = useCallback((timestamp: number, name: string) => {
    setLocalPhases((prev) => prev.map((p) => p.timestamp === timestamp ? { ...p, name } : p));
  }, []);
  const stableRemovePhase = useCallback((timestamp: number) => {
    setLocalPhases((prev) => prev.filter((p) => p.timestamp !== timestamp));
  }, []);

  const playerByJob = useMemo(
    () => new Map(localPlayers.map((p) => [p.job, p])),
    [localPlayers]
  );

  const { worstMistakeByPlayer, playerMistakeTimestamps, playerStatusRanges } = useMemo(() => {
    const worst = new Map<string, "death" | "damageDown">();
    const timestamps = new Map<string, { deaths: number[]; damageDowns: number[] }>();
    const statusRanges = new Map<string, PlayerRanges>();
    for (const player of localPlayers) {
      timestamps.set(player.id, { deaths: [], damageDowns: [] });
      statusRanges.set(player.id, { deadRows: [], weaknesses: [], brinks: [], damageDowns: [] });
    }
    for (const row of timeline) {
      for (const player of localPlayers) {
        const m = row.playerMistakes[player.id];
        if (!m) continue;
        if (m.dead) { worst.set(player.id, "death"); }
        else if (m.damageDownTimestamp != null && worst.get(player.id) !== "death") {
          worst.set(player.id, "damageDown");
        }
        const ts = timestamps.get(player.id)!;
        if (m.dead && m.deathTimestamp != null) ts.deaths.push(m.deathTimestamp);
        if (m.damageDownTimestamp != null) ts.damageDowns.push(m.damageDownTimestamp);
        const r = statusRanges.get(player.id)!;
        if (m.dead) r.deadRows.push(row.timestamp);
        if (m.weaknessTimestamp != null && m.weaknessDuration != null)
          r.weaknesses.push({ start: row.timestamp, end: m.weaknessTimestamp + m.weaknessDuration * 1000 });
        if (m.brinkOfDeathTimestamp != null && m.brinkOfDeathDuration != null)
          r.brinks.push({ start: row.timestamp, end: m.brinkOfDeathTimestamp + m.brinkOfDeathDuration * 1000 });
        if (m.damageDownTimestamp != null && m.damageDownDuration != null)
          r.damageDowns.push({ start: row.timestamp, end: m.damageDownTimestamp + m.damageDownDuration * 1000 });
      }
    }
    return { worstMistakeByPlayer: worst, playerMistakeTimestamps: timestamps, playerStatusRanges: statusRanges };
  }, [timeline, localPlayers]);

  const comparisonAssignments = usePlanStore((s) => s.comparisonAssignments);
  const comparisonLabel = usePlanStore((s) => s.comparisonLabel);
  const setComparison = usePlanStore((s) => s.setComparison);

  // Clear comparison when navigating to a different plan
  const prevViewLinkIdRef = useRef(viewLinkId);
  useEffect(() => {
    if (prevViewLinkIdRef.current !== viewLinkId) {
      prevViewLinkIdRef.current = viewLinkId;
      setComparison(null, null);
    }
  }, [viewLinkId, setComparison]);

  const assignedSet = useMemo(
    () => new Set(assignments.map((a) => `${a.playerId}|${a.abilityId}|${a.timestamp}`)),
    [assignments]
  );

  const comparisonSet = useMemo(
    () =>
      comparisonAssignments
        ? new Set(comparisonAssignments.map((a) => `${a.playerId}|${a.abilityId}|${a.timestamp}`))
        : null,
    [comparisonAssignments]
  );

  const isComparing = comparisonSet !== null;

  const assignmentsByPlayerAbility = useMemo(() => {
    const map = new Map<string, MitigationAssignment[]>();
    for (const a of assignments) {
      const key = `${a.playerId}|${a.abilityId}`;
      const list = map.get(key);
      if (list) list.push(a); else map.set(key, [a]);
    }
    return map;
  }, [assignments]);

  const abilityLookup = useMemo(() => {
    const map = new Map<string, JobAbilityRecord>();
    for (const job of allJobs) {
      for (const ab of abilitiesByJob[job] ?? []) map.set(`${job}|${ab.id}`, ab);
    }
    return map;
  }, [abilitiesByJob, allJobs]);

  const filteredAbilitiesByJob = useMemo(
    () =>
      Object.fromEntries(
        allJobs.map((job) => [
          job,
          (abilitiesByJob[job] ?? []).filter(
            (ab) =>
              abilityTargetFilter.includes(ab.target) &&
              abilityTypeFilter.includes(ab.abilityType)
          ),
        ])
      ) as Record<JobAbbreviation, JobAbilityRecord[]>,
    [abilitiesByJob, allJobs, abilityTargetFilter, abilityTypeFilter]
  );

  useEffect(() => {
    if (!initializedRef.current && casts?.length && !isLoading) {
      initializedRef.current = true;
      setAssignments(computeAssignments(casts, localPlayers, abilitiesByJob, timeline));
    }
  }, [casts, isLoading, localPlayers, abilitiesByJob, timeline]);

  function toggleJob(job: JobAbbreviation) {
    if (selectedJobs.includes(job)) {
      setSelectedJobs((prev) => prev.filter((j) => j !== job));
    } else {
      if (!localPlayers.some((p) => p.job === job)) {
        setLocalPlayers((prev) => [...prev, { id: `player-${job}`, job, abilities: [], mistakeColumnsEnabled: false }]);
      }
      setSelectedJobs((prev) => [...prev, job]);
    }
  }

  function cycleDamageType(bossAbility: string) {
    setLocalTimeline((prev) =>
      prev.map((row) => {
        if (row.bossAbility !== bossAbility || !row.damageEvent) return row;
        const current = TYPE_CYCLE.indexOf(row.damageEvent.type);
        const next = TYPE_CYCLE[(current + 1) % TYPE_CYCLE.length];
        return { ...row, damageEvent: { ...row.damageEvent, type: next, overriddenType: true } };
      })
    );
  }

  function isOnCooldown(timestamp: number, job: JobAbbreviation, abilityId: string): boolean {
    const player = playerByJob.get(job);
    if (!player) return false;
    const ability = abilityLookup.get(`${job}|${abilityId}`);
    if (!ability || ability.cooldown <= 0) return false;
    const cooldownMs = ability.cooldown * 1000;
    return (assignmentsByPlayerAbility.get(`${player.id}|${abilityId}`) ?? []).some(
      (a) => a.timestamp !== timestamp && Math.abs(a.timestamp - timestamp) < cooldownMs
    );
  }

  function toggleAssignment(timestamp: number, job: JobAbbreviation, abilityId: string) {
    const player = playerByJob.get(job);
    if (!player) return;
    const exists = assignedSet.has(`${player.id}|${abilityId}|${timestamp}`);
    if (!exists && isOnCooldown(timestamp, job, abilityId)) return;
    setAssignments((prev) =>
      exists
        ? prev.filter(
            (a) => !(a.timestamp === timestamp && a.playerId === player.id && a.abilityId === abilityId)
          )
        : [...prev, { timestamp, playerId: player.id, abilityId }]
    );
  }

  const visibleRows = useMemo(
    () =>
      localTimeline.filter((row) => {
        const isAutoAttack = isAutoAttackAbility(row.bossAbility);
        if (isAutoAttack) return showAutoAttacks;
        return !row.hidden;
      }),
    [localTimeline, showAutoAttacks]
  );

  const rowCellStates = useMemo((): CellState[][] =>
    visibleRows.map((row) =>
      selectedJobs.flatMap((job) => {
        const abilities = filteredAbilitiesByJob[job] ?? [];
        if (abilities.length === 0)
          return [{ assigned: false, onCooldown: false, inDuration: false, cooldownTooltip: "", compareState: null as CellState["compareState"] }];
        return abilities.map((ab) => {
          const player = playerByJob.get(job);
          const assigned = player
            ? assignedSet.has(`${player.id}|${ab.id}|${row.timestamp}`)
            : false;
          const ability = abilityLookup.get(`${job}|${ab.id}`);

          const compareState: CellState["compareState"] = comparisonSet === null || !player
            ? null
            : (() => {
                const inComp = comparisonSet.has(`${player.id}|${ab.id}|${row.timestamp}`);
                if (assigned && inComp) return "both";
                if (assigned) return "original-only";
                if (inComp) return "comparison-only";
                return "neither";
              })();

          if (!assigned && player && ability) {
            const list = assignmentsByPlayerAbility.get(`${player.id}|${ab.id}`) ?? [];
            if (ability.duration > 0) {
              const durationMs = ability.duration * 1000;
              const bufferMs = activationBuffer * 1000;
              const inDuration = list.some(
                (a) => row.timestamp > a.timestamp && row.timestamp <= a.timestamp + durationMs - bufferMs
              );
              if (inDuration) return { assigned: false, onCooldown: false, inDuration: true, cooldownTooltip: "", compareState };
            }
            if (ability.cooldown > 0) {
              const cooldownMs = ability.cooldown * 1000;
              const blocking = list.find(
                (a) => a.timestamp !== row.timestamp && Math.abs(a.timestamp - row.timestamp) < cooldownMs
              );
              if (blocking) {
                return {
                  assigned: false,
                  onCooldown: true,
                  inDuration: false,
                  cooldownTooltip: `On cooldown (expires at ${formatTimestamp(blocking.timestamp + cooldownMs)})`,
                  compareState,
                };
              }
            }
          }

          return { assigned, onCooldown: false, inDuration: false, cooldownTooltip: "", compareState };
        });
      })
    ),
    [assignedSet, comparisonSet, assignmentsByPlayerAbility, abilityLookup, playerByJob, visibleRows, selectedJobs, filteredAbilitiesByJob, activationBuffer]
  );

  const rowMitigations = useMemo(
    (): RowMitigation[] =>
      visibleRows.map((row) =>
        computeRowMitigation(
          row.timestamp,
          row.damageEvent,
          allJobs,
          filteredAbilitiesByJob,
          playerByJob,
          assignmentsByPlayerAbility
        )
      ),
    [visibleRows, allJobs, filteredAbilitiesByJob, playerByJob, assignmentsByPlayerAbility]
  );

  const totalColCount = useMemo(() => {
    let count = 4 + (showMistakesColumn ? 1 : 0); // Time, Boss Ability, [Mistakes], Type, Mit%
    if (isComparing) count++;
    if (showDamageColumn) count++;
    if (showSourceColumn) count++;
    if (showMechanicTypeColumn) count++;
    for (const job of selectedJobs) {
      const abilities = filteredAbilitiesByJob[job] ?? [];
      const player = playerByJob.get(job);
      const hasMistakes = showMistakesColumn && (player?.mistakeColumnsEnabled ?? false);
      count += (hasMistakes ? 1 : 0) + (abilities.length || 1);
    }
    return count;
  }, [isComparing, showDamageColumn, showSourceColumn, showMechanicTypeColumn, selectedJobs, filteredAbilitiesByJob, playerByJob, showMistakesColumn]);

  const displayItems = useMemo((): DisplayItem[] => {
    const sortedPhases = [...localPhases].sort((a, b) => a.timestamp - b.timestamp);
    const phaseEndTimestamps = sortedPhases.map((ph, idx) => {
      const nextTs = sortedPhases[idx + 1]?.timestamp ?? Infinity;
      let end = ph.timestamp;
      for (const r of visibleRows) {
        if (r.timestamp < nextTs) end = r.timestamp;
      }
      return end;
    });

    const items: DisplayItem[] = [];
    let phaseIdx = 0;
    let collapsing = false;

    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i];
      while (phaseIdx < sortedPhases.length && sortedPhases[phaseIdx].timestamp <= row.timestamp) {
        items.push({ kind: "phase", phase: sortedPhases[phaseIdx], endTimestamp: phaseEndTimestamps[phaseIdx] });
        collapsing = sortedPhases[phaseIdx].collapsed;
        phaseIdx++;
      }
      if (!collapsing) items.push({ kind: "row", row, rowIndex: i });
    }
    while (phaseIdx < sortedPhases.length) {
      items.push({ kind: "phase", phase: sortedPhases[phaseIdx], endTimestamp: phaseEndTimestamps[phaseIdx] });
      phaseIdx++;
    }
    return items;
  }, [visibleRows, localPhases]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalVirtualHeight = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = totalVirtualHeight - (virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].end : 0);

  // Stable refs so memoized rows never see new function props on unrelated re-renders
  const cycleRef = useRef(cycleDamageType);
  const stableCycle = useCallback((bossAbility: string) => cycleRef.current(bossAbility), []);

  const toggleRef = useRef(toggleAssignment);
  const stableToggle = useCallback(
    (ts: number, job: JobAbbreviation, id: string) => toggleRef.current(ts, job, id),
    []
  );

  const addPhaseRef = useRef(addPhase);
  const stableAddPhase = useCallback((ts: number) => addPhaseRef.current(ts), []);

  useLayoutEffect(() => {
    cycleRef.current = cycleDamageType;
    toggleRef.current = toggleAssignment;
    addPhaseRef.current = addPhase;
  });

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          {headerLeft ?? <div />}
          <div className="flex items-center gap-2 shrink-0">
            {/* Full timeline / My plan toggle — desktop only */}
            <div className="hidden md:flex rounded-md overflow-hidden border border-zinc-200 dark:border-slate-700 text-xs font-medium">
              <button
                onClick={() => setTimelineViewMode("full")}
                className={cn(
                  "px-3 py-1.5 transition-colors cursor-pointer",
                  timelineViewMode === "full"
                    ? "bg-teal-600 dark:bg-teal-700 text-white"
                    : "bg-white dark:bg-slate-900 text-zinc-500 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-slate-800"
                )}
              >
                Full timeline
              </button>
              <button
                onClick={() => setTimelineViewMode("my")}
                className={cn(
                  "px-3 py-1.5 transition-colors border-l border-zinc-200 dark:border-slate-700 cursor-pointer",
                  timelineViewMode === "my"
                    ? "bg-teal-600 dark:bg-teal-700 text-white"
                    : "bg-white dark:bg-slate-900 text-zinc-500 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-slate-800"
                )}
              >
                My plan
              </button>
            </div>
            {readOnly && comparisonLabel && (
              <div className="flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-slate-800 px-2 py-1 text-xs text-zinc-600 dark:text-slate-400">
                <span className="font-medium">Comparing:</span>
                <span className="max-w-[12rem] truncate">{comparisonLabel}</span>
                <button
                  onClick={() => setComparison(null, null)}
                  aria-label="Clear comparison"
                  className="leading-none text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  ×
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5 md:flex md:items-center md:gap-2">
              {raidplanLink && (
                <Button variant="outline" size="icon-sm" asChild aria-label="View on FFLogs">
                  <a href={raidplanLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={16} />
                  </a>
                </Button>
              )}
              {viewLinkId && title !== undefined && (
                <FavoriteButton viewLinkId={viewLinkId} title={title} encounterId={encounterId ?? null} />
              )}
              {readOnly && viewLinkId && (
                <CompareDialog
                  originalPlayers={localPlayers}
                  originalTimeline={timeline}
                  originalTitle={title ?? ""}
                  abilitiesByJob={abilitiesByJob}
                  abilitiesLoading={isLoading}
                  onCompare={(a, label) => setComparison(a, label)}
                  onClear={() => setComparison(null, null)}
                />
              )}
              <PreferencesDialog />
            </div>
          </div>
        </div>

        {/* Full-width Full/My plan toggle — mobile only */}
        <div className="flex md:hidden rounded-md overflow-hidden border border-zinc-200 dark:border-slate-700 text-xs font-medium">
          <button
            onClick={() => setTimelineViewMode("full")}
            className={cn(
              "flex-1 py-2 transition-colors",
              timelineViewMode === "full"
                ? "bg-teal-600 dark:bg-teal-700 text-white font-semibold"
                : "bg-white dark:bg-slate-900 text-zinc-500 dark:text-slate-400"
            )}
          >
            Full timeline
          </button>
          <button
            onClick={() => setTimelineViewMode("my")}
            className={cn(
              "flex-1 py-2 transition-colors border-l border-zinc-200 dark:border-slate-700",
              timelineViewMode === "my"
                ? "bg-teal-600 dark:bg-teal-700 text-white font-semibold"
                : "bg-white dark:bg-slate-900 text-zinc-500 dark:text-slate-400"
            )}
          >
            My plan
          </button>
        </div>

        {/* Job multiselect — edit mode, My plan view */}
        {!readOnly && timelineViewMode === "my" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 dark:border-slate-800 px-3 py-2 bg-zinc-50 dark:bg-slate-900">
            <span className="text-xs font-medium text-zinc-500 dark:text-slate-400 shrink-0">
              Showing
            </span>
            <span className={cn(
              "inline-flex items-center h-5 px-1.5 rounded-full border text-[10.5px] font-semibold font-mono shrink-0",
              myPlanEditJobs.length === allJobs.length
                ? "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400"
                : "bg-zinc-100 dark:bg-slate-800 border-zinc-200 dark:border-slate-700 text-zinc-500 dark:text-slate-400"
            )}>
              {myPlanEditJobs.length}/{allJobs.length}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {allJobs.map((job) => {
                const active = myPlanEditJobs.includes(job);
                const roleColor = JOB_ROLE_COLOR[job] ?? "#94a3b8";
                return (
                  <button
                    key={job}
                    onClick={() => setMyPlanEditJobs((prev) =>
                      active ? prev.filter((j) => j !== job) : [...prev, job]
                    )}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                      active
                        ? "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/60 text-zinc-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500"
                        : "bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-700 text-zinc-400 dark:text-slate-500 hover:border-zinc-300 dark:hover:border-slate-600"
                    )}
                  >
                    <span className="w-1 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: active ? roleColor : "#94a3b8" }} />
                    {job}
                  </button>
                );
              })}
            </div>
            {myPlanEditJobs.length < allJobs.length && (
              <button
                onClick={() => setMyPlanEditJobs(allJobs)}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline shrink-0 cursor-pointer"
              >
                All
              </button>
            )}
          </div>
        )}

        {/* Job multiselect — view mode, My plan view */}
        {readOnly && timelineViewMode === "my" && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 dark:border-slate-800 px-3 py-2 bg-zinc-50 dark:bg-slate-900">
            <span className="text-xs font-medium text-zinc-500 dark:text-slate-400 shrink-0">
              Showing
            </span>
            <span className={cn(
              "inline-flex items-center h-5 px-1.5 rounded-full border text-[10.5px] font-semibold font-mono shrink-0",
              myPlanViewJobs.length === allJobs.length
                ? "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400"
                : "bg-zinc-100 dark:bg-slate-800 border-zinc-200 dark:border-slate-700 text-zinc-500 dark:text-slate-400"
            )}>
              {myPlanViewJobs.length}/{allJobs.length}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {allJobs.map((job) => {
                const active = myPlanViewJobs.includes(job);
                const roleColor = JOB_ROLE_COLOR[job] ?? "#94a3b8";
                return (
                  <button
                    key={job}
                    onClick={() => setMyPlanViewJobs((prev) =>
                      active ? prev.filter((j) => j !== job) : [...prev, job]
                    )}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                      active
                        ? "bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/60 text-zinc-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500"
                        : "bg-white dark:bg-slate-900 border-zinc-200 dark:border-slate-700 text-zinc-400 dark:text-slate-500 hover:border-zinc-300 dark:hover:border-slate-600"
                    )}
                  >
                    <span className="w-1 h-3.5 rounded-sm shrink-0" style={{ backgroundColor: active ? roleColor : "#94a3b8" }} />
                    {job}
                  </button>
                );
              })}
            </div>
            {myPlanViewJobs.length < allJobs.length && (
              <button
                onClick={() => setMyPlanViewJobs(allJobs)}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline shrink-0 cursor-pointer"
              >
                All
              </button>
            )}
          </div>
        )}

        {/* Next Up + timer — always visible in My view (read-only) */}
        {readOnly && timelineViewMode === "my" && (
          <div className="relative flex gap-3 px-4 py-2.5 rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50 dark:bg-teal-950/40 overflow-hidden">
            {myNextRow && (
              <div
                className="absolute bottom-0 left-0 h-0.5 bg-teal-400/50 dark:bg-teal-400/30"
                style={{
                  width: `${(() => {
                    if (!isRunning && elapsedMs === 0) return 0;
                    const start = myCurrentRow?.timestamp ?? 0;
                    const end = myNextRow.timestamp;
                    if (end <= start) return 100;
                    return Math.min(100, Math.max(0, ((elapsedMs - start) / (end - start)) * 100));
                  })()}%`,
                }}
              />
            )}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              {myNextRow ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-wider text-teal-600 dark:text-teal-400 shrink-0">
                      NEXT UP
                    </span>
                    <span className={cn(
                      "font-mono text-sm font-bold shrink-0 tabular-nums",
                      !isRunning && elapsedMs > 0
                        ? "text-teal-500 dark:text-teal-400 animate-pulse"
                        : "text-teal-700 dark:text-teal-300"
                    )}>
                      {(isRunning || elapsedMs > 0) ? formatTimestamp(myNextRow.timestamp - elapsedMs) : "——:——"}
                    </span>
                  </div>
                  <span className="text-base font-semibold text-zinc-800 dark:text-slate-100">
                    {myNextRow.bossAbility}
                  </span>
                  {myNextRowAbilities.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {myNextRowAbilities.map((ability) =>
                        myPlanCompactView ? (
                          <Image key={ability.id} src={ability.iconPath} alt={ability.name} width={32} height={32} className="rounded" title={ability.name} />
                        ) : (
                          <span key={ability.id} className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium bg-white dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300">
                            <Image src={ability.iconPath} alt={ability.name} width={32} height={32} className="rounded-sm shrink-0" />
                            {ability.name}
                          </span>
                        )
                      )}
                    </div>
                  )}
                  {myNextRowFollowups.length > 0 && (
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-teal-200/60 dark:border-teal-800/40">
                      {myNextRowFollowups.map(({ row, abilities }) => (
                        <div key={row.timestamp} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-semibold text-teal-500 dark:text-teal-400 shrink-0">
                            +{formatTimestamp(row.timestamp - myNextRow.timestamp)}
                          </span>
                          {abilities.map((ability) => (
                            <Image key={ability.id} src={ability.iconPath} alt={ability.name} width={24} height={24} className="rounded opacity-80" title={ability.name} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-teal-600/70 dark:text-teal-400/60 self-center py-1">
                  {myPlanViewJobs.length === 0 ? "Select a job above" : "No upcoming assignments"}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-1.5 shrink-0 self-center">
              <button
                onClick={handlePlayPause}
                title={isRunning ? "Pause timer" : "Play timer"}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-teal-200 dark:border-teal-700 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
                aria-label={isRunning ? "Pause timer" : "Play timer"}
              >
                {isRunning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                onClick={handleReset}
                title="Reset timer"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-teal-200 dark:border-teal-700 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors cursor-pointer"
                aria-label="Reset timer"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
        )}

        {timelineViewMode === "full" && (
        <div ref={scrollContainerRef} className="relative overflow-auto min-h-48 max-h-[calc(100vh-16rem)] rounded-lg border border-zinc-200 dark:border-slate-800">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/70 dark:bg-slate-950/70 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-sm text-zinc-500 dark:text-slate-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-slate-700 dark:border-t-slate-300" />
                Loading abilities…
              </div>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 dark:border-slate-800 bg-zinc-50 dark:bg-slate-900">
              <tr>
                <th rowSpan={2} className={`${TH_FIXED} w-20`}>Time</th>
                <th rowSpan={2} className={TH_FIXED}>Boss Ability</th>
                {showMistakesColumn && <th rowSpan={2} className={`${TH_BASE} w-20`}>Mistakes</th>}
                <th rowSpan={2} className={`${TH_FIXED} w-28`}>Type</th>
                <th rowSpan={2} className={`${TH_BASE} text-right w-16`}>Mit%</th>
                {isComparing && <th rowSpan={2} className={`${TH_BASE} w-16`}>Diff</th>}
                {showDamageColumn && (
                  <th rowSpan={2} className={`${TH_FIXED} text-right w-28`}>Damage</th>
                )}
                {showSourceColumn && (
                  <th rowSpan={2} className={`${TH_FIXED} w-32`}>Source</th>
                )}
                {showMechanicTypeColumn && (
                  <th rowSpan={2} className={`${TH_BASE} w-28`}>Mechanic</th>
                )}
                {selectedJobs.map((job) => {
                  const abilities = filteredAbilitiesByJob[job] ?? [];
                  const player = playerByJob.get(job);
                  const hasMistakes = showMistakesColumn && (player?.mistakeColumnsEnabled ?? false);
                  const colSpan = (hasMistakes ? 1 : 0) + (abilities.length || 1);
                  return (
                    <th
                      key={job}
                      colSpan={colSpan}
                      className={`${TH_BASE} border-l border-zinc-200 dark:border-slate-700`}
                    >
                      {job}
                    </th>
                  );
                })}
              </tr>
              <tr>
                {selectedJobs.flatMap((job) => {
                  const abilities = filteredAbilitiesByJob[job] ?? [];
                  const player = playerByJob.get(job);
                  const hasMistakes = showMistakesColumn && (player?.mistakeColumnsEnabled ?? false);

                  const cells = [];
                  if (hasMistakes) {
                    const pId = playerByJob.get(job)?.id;
                    const worst = pId ? worstMistakeByPlayer.get(pId) : undefined;
                    const mistakeTimes = pId ? playerMistakeTimestamps.get(pId) : undefined;
                    const hasTooltip = mistakeTimes && (mistakeTimes.deaths.length > 0 || mistakeTimes.damageDowns.length > 0);
                    cells.push(
                      <th key={`${job}-mistakes-hdr`} className="border-l border-zinc-200 dark:border-slate-700 py-1 w-10 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-default inline-flex justify-center">
                              {worst === "death" ? (
                                <Image src="/icons/Death.png" alt="Death" width={16} height={16} />
                              ) : worst === "damageDown" ? (
                                <Image src="/icons/DamageDown.png" alt="Damage Down" width={16} height={16} />
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          {hasTooltip && (
                            <TooltipContent className="text-xs space-y-0.5">
                              {mistakeTimes!.deaths.length > 0 && (
                                <div><span className="font-medium">Deaths: </span>{mistakeTimes!.deaths.map(formatTimestamp).join(", ")}</div>
                              )}
                              {mistakeTimes!.damageDowns.length > 0 && (
                                <div><span className="font-medium">Damage Downs: </span>{mistakeTimes!.damageDowns.map(formatTimestamp).join(", ")}</div>
                              )}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </th>
                    );
                  }

                  if (abilities.length === 0) {
                    cells.push(<th key={job} className={hasMistakes ? "py-1" : "border-l border-zinc-200 dark:border-slate-700 py-1"} />);
                  } else {
                    abilities.forEach((ab, i) => {
                      cells.push(
                        <th
                          key={`${job}-${ab.id}`}
                          className={`py-1 ${i === 0 && !hasMistakes ? "border-l border-zinc-200 dark:border-slate-700" : ""}`}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Image
                                src={ab.iconPath}
                                alt={ab.name}
                                width={24}
                                height={24}
                                className="mx-auto rounded"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="font-medium">{ab.name}</div>
                              <div className="text-xs text-slate-400">
                                Cooldown: {ab.cooldown}s{ab.duration > 0 ? ` | Duration: ${ab.duration}s` : ""}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      );
                    });
                  }
                  return cells;
                })}
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr><td colSpan={totalColCount} style={{ height: paddingTop }} /></tr>
              )}
              {virtualItems.map((vItem) => {
                const item = displayItems[vItem.index];
                return item.kind === "phase" ? (
                  <PhaseDividerRow
                    key={`phase-${item.phase.timestamp}`}
                    phase={item.phase}
                    endTimestamp={item.endTimestamp}
                    colCount={totalColCount}
                    onToggle={stableTogglePhase}
                    onRename={stableRenamePhase}
                    onRemove={stableRemovePhase}
                    readOnly={readOnly}
                  />
                ) : (
                  <TimelineBodyRow
                    key={`${item.row.timestamp}-${item.row.bossAbility}-${item.rowIndex}`}
                    row={item.row}
                    index={item.rowIndex}
                    players={localPlayers}
                    selectedJobs={selectedJobs}
                    abilitiesByJob={filteredAbilitiesByJob}
                    cellStates={rowCellStates[item.rowIndex]}
                    mitigation={rowMitigations[item.rowIndex]}
                    playerByJob={playerByJob}
                    showDamageColumn={showDamageColumn}
                    showSourceColumn={showSourceColumn}
                    showMechanicTypeColumn={showMechanicTypeColumn}
                    showMistakesColumn={showMistakesColumn}
                    playerStatusRanges={playerStatusRanges}
                    onToggle={stableToggle}
                    onCycle={stableCycle}
                    onAddPhase={stableAddPhase}
                    readOnly={readOnly}
                    isComparing={isComparing}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <tr><td colSpan={totalColCount} style={{ height: paddingBottom }} /></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
        {timelineViewMode === "my" && (
          <MyTimeline
            players={localPlayers}
            timeline={localTimeline}
            phases={localPhases}
            assignments={assignments}
            abilitiesByJob={filteredAbilitiesByJob}
            selectedJobs={readOnly ? myPlanViewJobs : myPlanEditJobs}
            currentTimestamp={readOnly ? (myNextRow?.timestamp ?? null) : null}
            onTogglePhase={stableTogglePhase}
          />
        )}

        {!readOnly && <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-slate-800 p-4">
          {/* Active roster strip — Option A */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-slate-400">
              Active in timeline
            </span>
            <span className={cn(
              "inline-flex items-center h-5 px-1.5 rounded-full border text-[10.5px] font-semibold font-mono",
              selectedJobs.length === allJobs.length
                ? "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400"
                : "bg-zinc-100 dark:bg-slate-800 border-zinc-200 dark:border-slate-700 text-zinc-500 dark:text-slate-400"
            )}>
              {selectedJobs.length}/{allJobs.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {selectedJobs.map((job) => (
              <button
                key={job}
                onClick={() => toggleJob(job)}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/60 text-zinc-700 dark:text-slate-200 hover:border-teal-400 dark:hover:border-teal-500 transition-colors disabled:opacity-50"
              >
                <span
                  className="w-1 h-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: JOB_ROLE_COLOR[job] ?? '#94a3b8' }}
                />
                {job}
                <span className="text-zinc-400 dark:text-slate-500 ml-0.5 leading-none">×</span>
              </button>
            ))}
            {Array.from({ length: Math.max(0, allJobs.length - selectedJobs.length) }).map((_, i) => (
              <span
                key={`slot-${i}`}
                className="inline-flex items-center justify-center h-7 px-3 rounded-md text-xs border border-dashed border-zinc-200 dark:border-slate-700 text-zinc-300 dark:text-slate-600 font-mono"
              >
                —
              </span>
            ))}
          </div>
          <div className="border-t border-zinc-200 dark:border-slate-700 -mx-4 mb-1" />
          <p className="text-xs font-medium text-zinc-500 dark:text-slate-400 mb-1">Jobs</p>
          {JOB_GROUPS.map(({ label, jobs }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 dark:text-slate-500 w-14 shrink-0">
                {label}
              </span>
              <div className="flex flex-wrap gap-1">
                {jobs.map((job) => (
                  <Button
                    key={job}
                    size="sm"
                    variant={selectedJobs.includes(job) ? "default" : "outline"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => toggleJob(job)}
                    disabled={isLoading}
                  >
                    {JOB_NAMES[job]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>}
      </div>
    </TooltipProvider>
  );
}
