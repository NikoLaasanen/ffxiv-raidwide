"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import type { TimelineRow, MitigationAssignment, MechanicType } from "@/types/timeline";
import type { DamageType } from "@/types/common";
import type { Player, PhaseDivider } from "@/types/player";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import { ChevronDown, ChevronRight, ListX, User } from "lucide-react";
import { formatTimestamp } from "@/lib/format-timestamp";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { usePreferencesStore } from "@/store/preferences-store";

const MECHANIC_BADGE: Partial<Record<MechanicType, { label: string; className: string }>> = {
  enrage:     { label: "Enrage",     className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  tankbuster: { label: "TB",         className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  party:      { label: "Party",      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  single:     { label: "Single",     className: "bg-zinc-100 text-zinc-500 dark:bg-slate-800 dark:text-slate-400" },
};

const DAMAGE_TYPE_ICON: Record<DamageType, string> = {
  magical:  "/icons/MagicalDamage.png",
  physical: "/icons/PhysicalDamage.png",
  unique:   "/icons/UniqueDamage.png",
};

interface MyTimelineProps {
  players: Player[];
  timeline: TimelineRow[];
  phases: PhaseDivider[];
  assignments: MitigationAssignment[];
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
  selectedJob: JobAbbreviation | null;
  currentTimestamp?: number | null;
}

type DisplayItem =
  | { kind: "phase"; phase: PhaseDivider; endTimestamp: number }
  | { kind: "row"; row: TimelineRow; abilityIds: string[] };

export function MyTimeline({
  players,
  timeline,
  phases,
  assignments,
  abilitiesByJob,
  selectedJob,
  currentTimestamp,
}: MyTimelineProps) {
  const myPlanIconsOnly = usePreferencesStore((s) => s.myPlanIconsOnly);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (currentTimestamp == null) return;
    const el = rowRefs.current.get(currentTimestamp);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentTimestamp]);

  const selectedPlayer = useMemo(
    () => players.find((p) => p.job === selectedJob) ?? null,
    [players, selectedJob]
  );

  const playerAbilities = useMemo(
    () => (selectedJob ? (abilitiesByJob[selectedJob] ?? []) : []),
    [selectedJob, abilitiesByJob]
  );

  const abilityById = useMemo(
    () => new Map(playerAbilities.map((a) => [a.id, a])),
    [playerAbilities]
  );

  const myAssignments = useMemo(
    () => (selectedPlayer ? assignments.filter((a) => a.playerId === selectedPlayer.id) : []),
    [selectedPlayer, assignments]
  );

  const assignmentsByTimestamp = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const a of myAssignments) {
      const list = map.get(a.timestamp) ?? [];
      list.push(a.abilityId);
      map.set(a.timestamp, list);
    }
    return map;
  }, [myAssignments]);

  // Fight-relative severity thresholds — same formula as the FFLogs import route:
  // average damage across visible rows; "high" ≥ 2× avg, "med" ≥ 1× avg.
  const { highThreshold, medThreshold } = useMemo(() => {
    const damages = timeline
      .filter((r) => !r.hidden && (r.damageEvent?.rawDamage ?? 0) > 0)
      .map((r) => r.damageEvent!.rawDamage);
    if (damages.length === 0) return { highThreshold: Infinity, medThreshold: Infinity };
    const avg = damages.reduce((a, b) => a + b, 0) / damages.length;
    return { highThreshold: avg * 2, medThreshold: avg };
  }, [timeline]);

  const usageByAbility = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of myAssignments) {
      map.set(a.abilityId, (map.get(a.abilityId) ?? 0) + 1);
    }
    return map;
  }, [myAssignments]);

  const myRows = useMemo(
    () => timeline.filter((row) => !row.hidden && assignmentsByTimestamp.has(row.timestamp)),
    [timeline, assignmentsByTimestamp]
  );

  const displayItems = useMemo((): DisplayItem[] => {
    const sortedPhases = [...phases].sort((a, b) => a.timestamp - b.timestamp);
    const phaseEndTs = sortedPhases.map((ph, i) => {
      const next = sortedPhases[i + 1];
      return next ? next.timestamp : (timeline[timeline.length - 1]?.timestamp ?? ph.timestamp);
    });

    const items: DisplayItem[] = [];
    let lastPhaseIdx = -1;

    for (let r = 0; r < myRows.length; r++) {
      const row = myRows[r];
      let currentPhaseIdx = -1;
      for (let i = 0; i < sortedPhases.length; i++) {
        if (sortedPhases[i].timestamp <= row.timestamp) currentPhaseIdx = i;
        else break;
      }
      if (currentPhaseIdx !== lastPhaseIdx && currentPhaseIdx >= 0) {
        items.push({
          kind: "phase",
          phase: sortedPhases[currentPhaseIdx],
          endTimestamp: phaseEndTs[currentPhaseIdx],
        });
        lastPhaseIdx = currentPhaseIdx;
      }
      items.push({
        kind: "row",
        row,
        abilityIds: assignmentsByTimestamp.get(row.timestamp) ?? [],
      });
    }
    return items;
  }, [myRows, phases, timeline, assignmentsByTimestamp]);

  const hasNoAssignments = selectedPlayer !== null && myRows.length === 0;
  const usedCount = playerAbilities.filter((a) => (usageByAbility.get(a.id) ?? 0) > 0).length;

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 dark:border-slate-800 overflow-hidden min-h-48 max-h-[calc(100vh-16rem)]">
      {/* Main content */}
      {!selectedJob ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6 flex-1">
          <User size={32} className="text-zinc-300 dark:text-slate-600" />
          <div>
            <p className="text-sm font-medium text-zinc-600 dark:text-slate-300">
              Pick your job above
            </p>
            <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">
              Your mitigation assignments will appear as a timeline
            </p>
          </div>
        </div>
      ) : hasNoAssignments ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6 flex-1">
          <ListX size={32} className="text-zinc-300 dark:text-slate-600" />
          <div>
            <p className="text-sm font-medium text-zinc-600 dark:text-slate-300">
              No assignments for {selectedJob} yet
            </p>
            <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">
              Switch to Full view and assign mitigations to see them here
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Scrollable timeline list */}
          <div className="flex-1 overflow-y-auto">
            {displayItems.map((item, idx) => {
              if (item.kind === "phase") {
                return (
                  <div
                    key={`phase-${item.phase.timestamp}`}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100/80 dark:bg-slate-800/60 border-b border-zinc-200 dark:border-slate-700"
                  >
                    <ChevronDown size={13} className="text-teal-500 dark:text-teal-400 shrink-0" />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-slate-300">
                      {item.phase.name}
                    </span>
                    <span className="text-xs font-mono text-zinc-400 dark:text-slate-500 ml-1">
                      {formatTimestamp(item.phase.timestamp)}–{formatTimestamp(item.endTimestamp)}
                    </span>
                  </div>
                );
              }

              const { row, abilityIds } = item;
              const dmg = row.damageEvent?.rawDamage ?? 0;
              const sev = dmg >= highThreshold ? "high" : dmg >= medThreshold ? "med" : dmg > 0 ? "low" : null;
              const stripeClass =
                sev === "high"
                  ? "border-l-red-500"
                  : sev === "med"
                  ? "border-l-amber-400"
                  : "border-l-zinc-200 dark:border-l-slate-700";
              const mechBadge =
                row.mechanicType && row.mechanicType !== "unknown"
                  ? MECHANIC_BADGE[row.mechanicType]
                  : null;
              const dmgTypeIcon = row.damageEvent?.type
                ? DAMAGE_TYPE_ICON[row.damageEvent.type]
                : null;

              return (
                <div
                  key={`row-${row.timestamp}-${idx}`}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.timestamp, el);
                    else rowRefs.current.delete(row.timestamp);
                  }}
                  className={cn(
                    "flex items-stretch gap-3 pl-3 pr-4 py-3 border-b border-zinc-100 dark:border-slate-800/60 last:border-b-0 border-l-[3px]",
                    stripeClass,
                    row.timestamp === currentTimestamp && "bg-teal-50 dark:bg-teal-950/40 ring-1 ring-inset ring-teal-300 dark:ring-teal-700"
                  )}
                >
                  {/* Timestamp */}
                  <div className="min-w-[3rem] shrink-0 flex items-start pt-0.5">
                    <span className="font-mono text-sm font-bold text-zinc-700 dark:text-slate-200 leading-tight">
                      {formatTimestamp(row.timestamp)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-slate-100 leading-tight">
                        {row.bossAbility}
                      </span>
                      {mechBadge && (
                        <span
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                            mechBadge.className
                          )}
                        >
                          {mechBadge.label}
                        </span>
                      )}
                      {dmgTypeIcon && (
                        <Image
                          src={dmgTypeIcon}
                          alt={row.damageEvent!.type}
                          width={16}
                          height={16}
                          className="shrink-0 opacity-70"
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {abilityIds.map((aid) => {
                        const ability = abilityById.get(aid);
                        if (!ability) return null;
                        if (myPlanIconsOnly) {
                          return (
                            <Image
                              key={aid}
                              src={ability.iconPath}
                              alt={ability.name}
                              width={24}
                              height={24}
                              className="rounded"
                              title={ability.name}
                            />
                          );
                        }
                        return (
                          <span
                            key={aid}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300"
                          >
                            <Image
                              src={ability.iconPath}
                              alt={ability.name}
                              width={16}
                              height={16}
                              className="rounded-sm shrink-0"
                            />
                            {ability.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Toolbox (collapsible) */}
          <div className="border-t border-zinc-200 dark:border-slate-700 shrink-0">
            <button
              onClick={() => setToolboxOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              {toolboxOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>My Toolbox</span>
              <span className="ml-auto font-mono text-zinc-400 dark:text-slate-500">
                {usedCount}/{playerAbilities.length} used
              </span>
            </button>
            {toolboxOpen && (
              <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1 bg-zinc-50/50 dark:bg-slate-900/30">
                {playerAbilities.length === 0 ? (
                  <span className="text-xs text-zinc-400 dark:text-slate-500">
                    No abilities loaded
                  </span>
                ) : (
                  playerAbilities.map((ability) => {
                    const uses = usageByAbility.get(ability.id) ?? 0;
                    return (
                      <div
                        key={ability.id}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-lg p-2.5 border min-w-[3.5rem] text-center",
                          uses > 0
                            ? "border-teal-200 dark:border-teal-800/60 bg-teal-50 dark:bg-teal-950/30"
                            : "border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/50 opacity-60"
                        )}
                      >
                        <Image
                          src={ability.iconPath}
                          alt={ability.name}
                          width={24}
                          height={24}
                          className="rounded"
                        />
                        <span className="text-[10px] font-medium text-zinc-600 dark:text-slate-400 max-w-[3.5rem] truncate leading-tight mt-0.5">
                          {ability.name}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-bold font-mono",
                            uses > 0
                              ? "text-teal-600 dark:text-teal-400"
                              : "text-zinc-400 dark:text-slate-500"
                          )}
                        >
                          ×{uses}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
