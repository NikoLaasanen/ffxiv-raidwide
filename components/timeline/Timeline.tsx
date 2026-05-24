"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from "react";
import type { TimelineRow, MitigationAssignment, MechanicType, PlayerMistakeState } from "@/types/timeline";
import type { DamageType } from "@/types/common";
import type { Player, PhaseDivider } from "@/types/player";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { PlayerCastEvent } from "@/types/fflogs";
import { JOB_NAMES, JOB_GROUPS, ALL_JOBS } from "@/lib/jobs";
import { formatTimestamp } from "@/lib/format-timestamp";
import { computeAssignments } from "@/lib/compute-assignments";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useJobAbilities } from "@/hooks/use-job-abilities";
import { computeRowMitigation } from "@/lib/compute-mitigation";
import type { RowMitigation } from "@/lib/compute-mitigation";
import { usePreferencesStore } from "@/store/preferences-store";
import { useShallow } from "zustand/react/shallow";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PreferencesDialog } from "@/components/preferences/PreferencesDialog";
import { FavoriteButton } from "@/components/plan/FavoriteButton";

interface TimelineProps {
  timeline: TimelineRow[];
  players: Player[];
  casts?: PlayerCastEvent[];
  phases?: PhaseDivider[];
  initialAssignments?: MitigationAssignment[];
  onAssignmentsChange?: (a: MitigationAssignment[]) => void;
  readOnly?: boolean;
  viewLinkId?: string;
  title?: string;
  encounterId?: string | null;
}

type CellState = {
  assigned: boolean;
  onCooldown: boolean;
  inDuration: boolean;
  cooldownTooltip: string;
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

const TH_BASE = "px-3 py-2.5 text-center font-medium text-zinc-500 dark:text-zinc-400";
const TH_FIXED = "px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400";

const MECHANIC_BADGE: Record<MechanicType, { label: string; className: string }> = {
  enrage:     { label: "Enrage",     className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  tankbuster: { label: "Tankbuster", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  party:      { label: "Party",      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  single:     { label: "Single",     className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
  unknown:    { label: "—",          className: "text-zinc-300 dark:text-zinc-600" },
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
  if (ms.deadGray) return "bg-zinc-200/70 dark:bg-zinc-700/40";
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
    return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
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
    <tr className="bg-zinc-100/80 dark:bg-zinc-800/60 border-y border-zinc-200 dark:border-zinc-700">
      <td colSpan={colCount} className="px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(phase.timestamp)}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors shrink-0"
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
              className="text-sm font-medium bg-transparent border-b border-zinc-400 dark:border-zinc-500 outline-none px-0.5 w-32 min-w-0"
            />
          ) : (
            <span
              className={cn("text-sm font-medium", !readOnly && "cursor-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors")}
              onClick={readOnly ? undefined : () => { setEditing(true); setDraft(phase.name); }}
            >
              {phase.name}
            </span>
          )}
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-mono">
            {formatTimestamp(phase.timestamp)} – {formatTimestamp(endTimestamp)}
          </span>
          {!readOnly && (
            <button
              onClick={() => onRemove(phase.timestamp)}
              className="ml-auto text-zinc-300 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors text-base leading-none px-1"
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
}

const TimelineBodyRow = memo(
  function TimelineBodyRow({ row, index, players, selectedJobs, abilitiesByJob, cellStates, mitigation, playerByJob, showDamageColumn, showSourceColumn, showMechanicTypeColumn, showMistakesColumn, playerStatusRanges, onToggle, onCycle, onAddPhase, readOnly }: RowProps) {
    let cellIndex = 0;

    const deathPlayers = players.filter((p) => row.playerMistakes[p.id]?.dead);
    const ddPlayers = players.filter((p) => row.playerMistakes[p.id]?.damageDownTimestamp != null);
    const hasMistakeSummary = deathPlayers.length > 0 || ddPlayers.length > 0;

    return (
      <tr
        className={cn(
          "group/row transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/20",
          index % 2 === 0 ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/50 dark:bg-zinc-900/50"
        )}
      >
        <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400 relative">
          {formatTimestamp(row.timestamp)}
          {!readOnly && (
            <button
              onClick={() => onAddPhase(row.timestamp)}
              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 w-4 h-4 rounded flex items-center justify-center text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all text-[10px] leading-none"
              aria-label="Add phase divider here"
            >
              +
            </button>
          )}
        </td>
        <td className="px-4 py-2 font-medium">{row.bossAbility}</td>
        {showMistakesColumn && (
          <td className="px-3 py-2 text-center">
            {hasMistakeSummary ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 cursor-default focus:outline-none mx-auto">
                    {deathPlayers.length > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Image src="/icons/Death.png" alt="Deaths" width={14} height={14} />
                        {deathPlayers.length > 1 && <span className="text-[10px] font-medium text-zinc-500">×{deathPlayers.length}</span>}
                      </span>
                    )}
                    {ddPlayers.length > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Image src="/icons/DamageDown.png" alt="Damage Downs" width={14} height={14} />
                        {ddPlayers.length > 1 && <span className="text-[10px] font-medium text-zinc-500">×{ddPlayers.length}</span>}
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
              <span className="text-zinc-300 dark:text-zinc-600">—</span>
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
                    className="block rounded p-0.5 hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-600 transition-shadow"
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
            <span className="text-zinc-400 dark:text-zinc-600">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {mitigation.totalMitPercent > 0 ? (
            `${Math.round(mitigation.totalMitPercent)}%`
          ) : (
            <span className="text-zinc-300 dark:text-zinc-600">—</span>
          )}
        </td>
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
          <td className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-[8rem] truncate">
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
              <td key={`${job}-mistakes`} className={cn("w-10 border-l border-zinc-100 dark:border-zinc-800 align-middle", mistakeBg)}>
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
                className={cn("px-3 py-2 text-center text-zinc-300 dark:text-zinc-700", !showMistakes && "border-l border-zinc-100 dark:border-zinc-800")}
              >
                —
              </td>,
            ].filter(Boolean);
          }
          return [
            mistakeCell,
            ...abilities.map((ab, i) => {
            const { assigned, onCooldown, inDuration, cooldownTooltip } = cellStates[cellIndex++];

            const btn = (
              <button
                onClick={readOnly ? undefined : () => onToggle(row.timestamp, job, ab.id)}
                disabled={readOnly}
                className={cn(
                  "w-5 h-5 rounded mx-auto block transition-colors",
                  readOnly && "cursor-default pointer-events-none",
                  assigned
                    ? "bg-blue-500 dark:bg-blue-400"
                    : onCooldown
                    ? "bg-zinc-200 dark:bg-zinc-700 cursor-not-allowed opacity-50"
                    : inDuration
                    ? "border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-500"
                    : "border border-zinc-300 dark:border-zinc-600 hover:border-blue-400 dark:hover:border-blue-500"
                )}
                aria-label={`Toggle ${ab.name}`}
              />
            );

            return (
              <td
                key={`${job}-${ab.id}`}
                className={cn(
                  "py-2 w-8 text-center",
                  i === 0 && !showMistakes && "border-l border-zinc-100 dark:border-zinc-800",
                  inDuration && "bg-blue-50 dark:bg-blue-950/30"
                )}
              >
                {onCooldown ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent>{cooldownTooltip}</TooltipContent>
                  </Tooltip>
                ) : (
                  btn
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
    prev.mitigation.totalMitPercent === next.mitigation.totalMitPercent &&
    prev.mitigation.mitigatedDamage === next.mitigation.mitigatedDamage &&
    prev.cellStates.length === next.cellStates.length &&
    prev.cellStates.every(
      (c, i) =>
        c.assigned === next.cellStates[i].assigned &&
        c.onCooldown === next.cellStates[i].onCooldown &&
        c.inDuration === next.cellStates[i].inDuration &&
        c.cooldownTooltip === next.cellStates[i].cooldownTooltip
    )
);

export function Timeline({ timeline, players, casts, phases = [], initialAssignments, onAssignmentsChange, readOnly, viewLinkId, title, encounterId }: TimelineProps) {
  const {
    showAutoAttacks,
    showDamageColumn,
    showSourceColumn,
    showMechanicTypeColumn,
    showMistakesColumn,
    activationBuffer,
    abilityTargetFilter,
    abilityTypeFilter,
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
    }))
  );

  const allJobs = useMemo(
    () =>
      [...new Set(players.map((p) => p.job))].sort(
        (a, b) => ALL_JOBS.indexOf(a) - ALL_JOBS.indexOf(b)
      ),
    [players]
  );
  const [selectedJobs, setSelectedJobs] = useState<JobAbbreviation[]>(() => allJobs);
  const { abilitiesByJob, isLoading } = useJobAbilities(allJobs);
  const initializedRef = useRef(!!initialAssignments?.length);
  const [assignments, setAssignments] = useState<MitigationAssignment[]>(
    () => initialAssignments ?? []
  );
  const onAssignmentsChangeRef = useRef(onAssignmentsChange);
  useLayoutEffect(() => { onAssignmentsChangeRef.current = onAssignmentsChange; });
  useEffect(() => { onAssignmentsChangeRef.current?.(assignments); }, [assignments]);
  const [localTimeline, setLocalTimeline] = useState<TimelineRow[]>(timeline);
  const [prevTimeline, setPrevTimeline] = useState<TimelineRow[]>(timeline);
  if (prevTimeline !== timeline) {
    setPrevTimeline(timeline);
    setLocalTimeline(timeline);
  }

  const [localPhases, setLocalPhases] = useState<PhaseDivider[]>(phases);

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
    () => new Map(players.map((p) => [p.job, p])),
    [players]
  );

  const { worstMistakeByPlayer, playerMistakeTimestamps, playerStatusRanges } = useMemo(() => {
    const worst = new Map<string, "death" | "damageDown">();
    const timestamps = new Map<string, { deaths: number[]; damageDowns: number[] }>();
    const statusRanges = new Map<string, PlayerRanges>();
    for (const player of players) {
      timestamps.set(player.id, { deaths: [], damageDowns: [] });
      statusRanges.set(player.id, { deadRows: [], weaknesses: [], brinks: [], damageDowns: [] });
    }
    for (const row of timeline) {
      for (const player of players) {
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
  }, [timeline, players]);

  const assignedSet = useMemo(
    () => new Set(assignments.map((a) => `${a.playerId}|${a.abilityId}|${a.timestamp}`)),
    [assignments]
  );

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
      setAssignments(computeAssignments(casts, players, abilitiesByJob, timeline));
    }
  }, [casts, isLoading, players, abilitiesByJob, timeline]);

  const toggleJob = (job: JobAbbreviation) =>
    setSelectedJobs((prev) =>
      prev.includes(job) ? prev.filter((j) => j !== job) : [...prev, job]
    );

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
        const isAutoAttack = row.bossAbility.toLowerCase() === "attack";
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
          return [{ assigned: false, onCooldown: false, inDuration: false, cooldownTooltip: "" }];
        return abilities.map((ab) => {
          const player = playerByJob.get(job);
          const assigned = player
            ? assignedSet.has(`${player.id}|${ab.id}|${row.timestamp}`)
            : false;
          const ability = abilityLookup.get(`${job}|${ab.id}`);

          if (!assigned && player && ability) {
            const list = assignmentsByPlayerAbility.get(`${player.id}|${ab.id}`) ?? [];
            if (ability.duration > 0) {
              const durationMs = ability.duration * 1000;
              const bufferMs = activationBuffer * 1000;
              const inDuration = list.some(
                (a) => row.timestamp > a.timestamp && row.timestamp <= a.timestamp + durationMs - bufferMs
              );
              if (inDuration) return { assigned: false, onCooldown: false, inDuration: true, cooldownTooltip: "" };
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
                };
              }
            }
          }

          return { assigned, onCooldown: false, inDuration: false, cooldownTooltip: "" };
        });
      })
    ),
    [assignedSet, assignmentsByPlayerAbility, abilityLookup, playerByJob, visibleRows, selectedJobs, filteredAbilitiesByJob, activationBuffer]
  );

  const rowMitigations = useMemo(
    (): RowMitigation[] =>
      visibleRows.map((row) =>
        computeRowMitigation(
          row.timestamp,
          row.damageEvent,
          allJobs,
          abilitiesByJob,
          playerByJob,
          assignmentsByPlayerAbility
        )
      ),
    [visibleRows, allJobs, abilitiesByJob, playerByJob, assignmentsByPlayerAbility]
  );

  const totalColCount = useMemo(() => {
    let count = 4 + (showMistakesColumn ? 1 : 0); // Time, Boss Ability, [Mistakes], Type, Mit%
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
  }, [showDamageColumn, showSourceColumn, showMechanicTypeColumn, selectedJobs, filteredAbilitiesByJob, playerByJob, showMistakesColumn]);

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
        <div className="flex items-center justify-end gap-2">
          {viewLinkId && title !== undefined && (
            <FavoriteButton viewLinkId={viewLinkId} title={title} encounterId={encounterId ?? null} />
          )}
          <PreferencesDialog />
        </div>
        <div ref={scrollContainerRef} className="relative overflow-auto max-h-[calc(100vh-16rem)] rounded-lg border border-zinc-200 dark:border-zinc-800">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/70 dark:bg-zinc-950/70 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
                Loading abilities…
              </div>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th rowSpan={2} className={`${TH_FIXED} w-20`}>Time</th>
                <th rowSpan={2} className={TH_FIXED}>Boss Ability</th>
                {showMistakesColumn && <th rowSpan={2} className={`${TH_BASE} w-20`}>Mistakes</th>}
                <th rowSpan={2} className={`${TH_FIXED} w-28`}>Type</th>
                <th rowSpan={2} className={`${TH_BASE} text-right w-16`}>Mit%</th>
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
                      className={`${TH_BASE} border-l border-zinc-200 dark:border-zinc-700`}
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
                      <th key={`${job}-mistakes-hdr`} className="border-l border-zinc-200 dark:border-zinc-700 py-1 w-10 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-default inline-flex justify-center">
                              {worst === "death" ? (
                                <Image src="/icons/Death.png" alt="Death" width={16} height={16} />
                              ) : worst === "damageDown" ? (
                                <Image src="/icons/DamageDown.png" alt="Damage Down" width={16} height={16} />
                              ) : (
                                <span className="text-zinc-400 text-xs">—</span>
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
                    cells.push(<th key={job} className={hasMistakes ? "py-1" : "border-l border-zinc-200 dark:border-zinc-700 py-1"} />);
                  } else {
                    abilities.forEach((ab, i) => {
                      cells.push(
                        <th
                          key={`${job}-${ab.id}`}
                          className={`py-1 ${i === 0 && !hasMistakes ? "border-l border-zinc-200 dark:border-zinc-700" : ""}`}
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
                              <div className="text-xs text-zinc-400">
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
                    players={players}
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
                  />
                );
              })}
              {paddingBottom > 0 && (
                <tr><td colSpan={totalColCount} style={{ height: paddingBottom }} /></tr>
              )}
            </tbody>
          </table>
        </div>

        {!readOnly && <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Jobs</p>
          {JOB_GROUPS.map(({ label, jobs }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 dark:text-zinc-500 w-14 shrink-0">
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
