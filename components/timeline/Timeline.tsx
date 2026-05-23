"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from "react";
import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { DamageType } from "@/types/common";
import type { Player } from "@/types/player";
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

interface TimelineProps {
  timeline: TimelineRow[];
  players: Player[];
  casts?: PlayerCastEvent[];
}

type CellState = {
  assigned: boolean;
  onCooldown: boolean;
  inDuration: boolean;
  cooldownTooltip: string;
};

const TYPE_CYCLE: DamageType[] = ["magical", "physical", "unique"];

const DAMAGE_TYPE_ICON: Record<DamageType, string> = {
  magical:  "/icons/MagicalDamage.png",
  physical: "/icons/PhysicalDamage.png",
  unique:   "/icons/UniqueDamage.png",
};

const TH_BASE = "px-3 py-2.5 text-center font-medium text-zinc-500 dark:text-zinc-400";
const TH_FIXED = "px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400";

interface RowProps {
  row: TimelineRow;
  index: number;
  selectedJobs: JobAbbreviation[];
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
  cellStates: CellState[];
  onToggle: (timestamp: number, job: JobAbbreviation, abilityId: string) => void;
  onCycle: (bossAbility: string) => void;
}

const TimelineBodyRow = memo(
  function TimelineBodyRow({ row, index, selectedJobs, abilitiesByJob, cellStates, onToggle, onCycle }: RowProps) {
    let cellIndex = 0;

    return (
      <tr
        className={cn(
          "group/row transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-950/20",
          index % 2 === 0 ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/50 dark:bg-zinc-900/50"
        )}
      >
        <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {formatTimestamp(row.timestamp)}
        </td>
        <td className="px-4 py-2 font-medium">{row.bossAbility}</td>
        <td className="px-4 py-2">
          {row.damageEvent ? (
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent side="right" className="capitalize">
                {row.damageEvent.type}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-600">—</span>
          )}
        </td>
        <td className="px-4 py-2 text-right font-mono text-xs">
          {row.damageEvent != null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">
                  {row.damageEvent.rawDamage.toLocaleString()}
                </span>
              </TooltipTrigger>
              <TooltipContent side="left">
                <div className="space-y-0.5 text-right text-xs font-mono">
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
        {selectedJobs.flatMap((job) => {
          const abilities = abilitiesByJob[job] ?? [];
          if (abilities.length === 0) {
            cellIndex++;
            return [
              <td
                key={job}
                className="px-3 py-2 text-center text-zinc-300 dark:text-zinc-700 border-l border-zinc-100 dark:border-zinc-800"
              >
                —
              </td>,
            ];
          }
          return abilities.map((ab, i) => {
            const { assigned, onCooldown, inDuration, cooldownTooltip } = cellStates[cellIndex++];

            const btn = (
              <button
                onClick={() => onToggle(row.timestamp, job, ab.id)}
                className={cn(
                  "w-5 h-5 rounded mx-auto block transition-colors",
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
                  i === 0 && "border-l border-zinc-100 dark:border-zinc-800",
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
          });
        })}
      </tr>
    );
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.index === next.index &&
    prev.selectedJobs === next.selectedJobs &&
    prev.abilitiesByJob === next.abilitiesByJob &&
    prev.onToggle === next.onToggle &&
    prev.onCycle === next.onCycle &&
    prev.cellStates.length === next.cellStates.length &&
    prev.cellStates.every(
      (c, i) =>
        c.assigned === next.cellStates[i].assigned &&
        c.onCooldown === next.cellStates[i].onCooldown &&
        c.inDuration === next.cellStates[i].inDuration &&
        c.cooldownTooltip === next.cellStates[i].cooldownTooltip
    )
);

export function Timeline({ timeline, players, casts }: TimelineProps) {
  const allJobs = useMemo(
    () =>
      [...new Set(players.map((p) => p.job))].sort(
        (a, b) => ALL_JOBS.indexOf(a) - ALL_JOBS.indexOf(b)
      ),
    [players]
  );
  const [selectedJobs, setSelectedJobs] = useState<JobAbbreviation[]>(() => allJobs);
  const { abilitiesByJob, isLoading } = useJobAbilities(allJobs);
  const [assignments, setAssignments] = useState<MitigationAssignment[]>([]);
  const [localTimeline, setLocalTimeline] = useState<TimelineRow[]>(timeline);
  const [prevTimeline, setPrevTimeline] = useState<TimelineRow[]>(timeline);
  if (prevTimeline !== timeline) {
    setPrevTimeline(timeline);
    setLocalTimeline(timeline);
  }
  const initializedRef = useRef(false);

  const playerByJob = useMemo(
    () => new Map(players.map((p) => [p.job, p])),
    [players]
  );

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

  const visibleRows = useMemo(() => localTimeline.filter((row) => !row.hidden), [localTimeline]);

  const rowCellStates = useMemo((): CellState[][] =>
    visibleRows.map((row) =>
      selectedJobs.flatMap((job) => {
        const abilities = abilitiesByJob[job] ?? [];
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
            if (ability.duration > 0) {
              const durationMs = ability.duration * 1000;
              const inDuration = list.some(
                (a) => row.timestamp > a.timestamp && row.timestamp <= a.timestamp + durationMs
              );
              if (inDuration) return { assigned: false, onCooldown: false, inDuration: true, cooldownTooltip: "" };
            }
          }

          return { assigned, onCooldown: false, inDuration: false, cooldownTooltip: "" };
        });
      })
    ),
    [assignedSet, assignmentsByPlayerAbility, abilityLookup, playerByJob, visibleRows, selectedJobs, abilitiesByJob]
  );

  // Stable refs so memoized rows never see new function props on unrelated re-renders
  const cycleRef = useRef(cycleDamageType);
  const stableCycle = useCallback((bossAbility: string) => cycleRef.current(bossAbility), []);

  const toggleRef = useRef(toggleAssignment);
  const stableToggle = useCallback(
    (ts: number, job: JobAbbreviation, id: string) => toggleRef.current(ts, job, id),
    []
  );

  useLayoutEffect(() => {
    cycleRef.current = cycleDamageType;
    toggleRef.current = toggleAssignment;
  });

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <div className="overflow-auto max-h-[calc(100vh-16rem)] rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th rowSpan={2} className={`${TH_FIXED} w-20`}>Time</th>
                <th rowSpan={2} className={TH_FIXED}>Boss Ability</th>
                <th rowSpan={2} className={`${TH_FIXED} w-28`}>Type</th>
                <th rowSpan={2} className={`${TH_FIXED} text-right w-28`}>Damage</th>
                {selectedJobs.map((job) => {
                  const abilities = abilitiesByJob[job] ?? [];
                  return (
                    <th
                      key={job}
                      colSpan={abilities.length || 1}
                      className={`${TH_BASE} border-l border-zinc-200 dark:border-zinc-700`}
                    >
                      {job}
                    </th>
                  );
                })}
              </tr>
              <tr>
                {selectedJobs.flatMap((job) => {
                  const abilities = abilitiesByJob[job] ?? [];
                  if (abilities.length === 0) {
                    return [<th key={job} className="border-l border-zinc-200 dark:border-zinc-700 py-1" />];
                  }
                  return abilities.map((ab, i) => (
                    <th
                      key={`${job}-${ab.id}`}
                      className={`py-1 ${i === 0 ? "border-l border-zinc-200 dark:border-zinc-700" : ""}`}
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
                        <TooltipContent>{ab.name}</TooltipContent>
                      </Tooltip>
                    </th>
                  ));
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => (
                <TimelineBodyRow
                  key={`${row.timestamp}-${row.bossAbility}-${index}`}
                  row={row}
                  index={index}
                  selectedJobs={selectedJobs}
                  abilitiesByJob={abilitiesByJob}
                  cellStates={rowCellStates[index]}
                  onToggle={stableToggle}
                  onCycle={stableCycle}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
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
                  >
                    {JOB_NAMES[job]}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
