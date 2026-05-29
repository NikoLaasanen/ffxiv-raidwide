"use client";

import { useMemo, useRef, useEffect, useState, Fragment } from "react";
import type { TimelineRow, MitigationAssignment } from "@/types/timeline";
import type { Player, PhaseDivider } from "@/types/player";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import { ChevronDown, ChevronRight, ListX, User } from "lucide-react";
import { formatTimestamp } from "@/lib/format-timestamp";
import { cn } from "@/lib/utils";
import { JOB_ROLE_COLOR } from "@/lib/jobs";
import { buildMyTimelineData } from "@/lib/my-timeline";
import { DAMAGE_TYPE_ICON, MECHANIC_BADGE, FALLBACK_JOB_COLOR } from "@/lib/timeline-constants";
import Image from "next/image";
import { usePreferencesStore } from "@/store/preferences-store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


interface MyTimelineProps {
  players: Player[];
  timeline: TimelineRow[];
  phases: PhaseDivider[];
  assignments: MitigationAssignment[];
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>;
  selectedJobs: JobAbbreviation[];
  currentTimestamp?: number | null;
  onTogglePhase?: (timestamp: number) => void;
}

export function MyTimeline({
  players,
  timeline,
  phases,
  assignments,
  abilitiesByJob,
  selectedJobs,
  currentTimestamp,
  onTogglePhase,
}: MyTimelineProps) {
  const myPlanCompactView = usePreferencesStore((s) => s.myPlanCompactView);
  const myPlanCompactStyle = usePreferencesStore((s) => s.myPlanCompactStyle);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (currentTimestamp == null) return;
    const el = rowRefs.current.get(currentTimestamp);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentTimestamp]);

  const isMultiJob = selectedJobs.length > 1;

  const { sortedSelectedJobs, selectedPlayers, playerAbilities, abilityById, myAssignments, myRows, displayItems } =
    useMemo(
      () => buildMyTimelineData({ players, timeline, phases, assignments, abilitiesByJob, selectedJobs }),
      [players, timeline, phases, assignments, abilitiesByJob, selectedJobs]
    );

  const hasCleanseCapability = useMemo(
    () => sortedSelectedJobs.some((job) =>
      (abilitiesByJob[job] ?? []).some((ab) => ab.abilityType === "cleanse")
    ),
    [sortedSelectedJobs, abilitiesByJob]
  );

  const hasInterruptCapability = useMemo(
    () => sortedSelectedJobs.some((job) =>
      (abilitiesByJob[job] ?? []).some((ab) => ab.abilityType === "interrupt")
    ),
    [sortedSelectedJobs, abilitiesByJob]
  );

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

  const hasNoAssignments = selectedPlayers.length > 0 && myRows.length === 0;
  const usedCount = playerAbilities.filter((a) => (usageByAbility.get(a.id) ?? 0) > 0).length;

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 dark:border-slate-800 overflow-hidden min-h-48 max-h-[calc(100vh-16rem)]">
      {selectedJobs.length === 0 ? (
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
              No assignments for {selectedJobs.join(", ")} yet
            </p>
            <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">
              {isMultiJob
                ? "Assign mitigations to see them here"
                : "Switch to Full view and assign mitigations to see them here"}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Scrollable timeline list */}
          <div className="flex-1 overflow-y-auto">
            <div className={myPlanCompactStyle === "centered" ? "grid grid-cols-[1fr_auto_1fr]" : undefined}>
              {displayItems.map((item, idx) => {
                if (item.kind === "phase") {
                  return (
                    <button
                      key={`phase-${item.phase.timestamp}`}
                      onClick={() => onTogglePhase?.(item.phase.timestamp)}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-2 bg-zinc-100/80 dark:bg-slate-800/60 border-b border-zinc-200 dark:border-slate-700 text-left hover:bg-zinc-200/60 dark:hover:bg-slate-700/60 transition-colors",
                        myPlanCompactStyle === "centered" && "col-span-3"
                      )}
                    >
                      {item.phase.collapsed
                        ? <ChevronRight size={13} className="text-teal-500 dark:text-teal-400 shrink-0" />
                        : <ChevronDown size={13} className="text-teal-500 dark:text-teal-400 shrink-0" />
                      }
                      <span className="text-xs font-semibold text-zinc-700 dark:text-slate-300">
                        {item.phase.name}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 dark:text-slate-500 ml-1">
                        {formatTimestamp(item.phase.timestamp)}–{formatTimestamp(item.endTimestamp)}
                      </span>
                    </button>
                  );
                }

                const { row, abilityEntries } = item;
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

                if (myPlanCompactStyle === "classic") {
                  const isCurrentRow = row.timestamp === currentTimestamp;
                  if (myPlanCompactView) {
                    return (
                      <div
                        key={`row-${row.timestamp}-${idx}`}
                        ref={(el) => {
                          if (el) rowRefs.current.set(row.timestamp, el);
                          else rowRefs.current.delete(row.timestamp);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 flex-wrap py-1.5 pl-3 pr-4 border-b border-zinc-100 dark:border-slate-800/60 last:border-b-0 border-l-[3px]",
                          stripeClass,
                          isCurrentRow && "bg-teal-50 dark:bg-teal-950/40 ring-1 ring-inset ring-teal-300 dark:ring-teal-700"
                        )}
                      >
                        <span className="font-mono text-sm font-bold text-zinc-500 dark:text-slate-400 leading-tight shrink-0">
                          {formatTimestamp(row.timestamp)}
                        </span>
                        {abilityEntries.map(({ job, abilityId }, i) => {
                          const ability = abilityById.get(abilityId);
                          if (!ability) return null;
                          const roleColor = JOB_ROLE_COLOR[job] ?? FALLBACK_JOB_COLOR;
                          return (
                            <span key={`${abilityId}-${i}`} className="relative inline-flex items-center">
                              {isMultiJob && (
                                <span
                                  className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 z-10"
                                  style={{ backgroundColor: roleColor }}
                                />
                              )}
                              <Image
                                src={ability.iconPath}
                                alt={ability.name}
                                width={24}
                                height={24}
                                className="rounded"
                                title={isMultiJob ? `${job}: ${ability.name}` : ability.name}
                              />
                            </span>
                          );
                        })}
                        <span className="text-sm font-semibold text-zinc-800 dark:text-slate-100 leading-tight">
                          {row.bossAbility}
                        </span>
                        {row.cleanse && hasCleanseCapability && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 cursor-default">
                                Cleanse
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">Players should cleanse this debuff</TooltipContent>
                          </Tooltip>
                        )}
                        {row.interrupt && hasInterruptCapability && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 cursor-default">
                                Interrupt
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">This ability can be interrupted</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`row-${row.timestamp}-${idx}`}
                      ref={(el) => {
                        if (el) rowRefs.current.set(row.timestamp, el);
                        else rowRefs.current.delete(row.timestamp);
                      }}
                      className={cn(
                        "flex items-stretch gap-3 pl-3 pr-4 border-b border-zinc-100 dark:border-slate-800/60 last:border-b-0 border-l-[3px] py-3",
                        stripeClass,
                        isCurrentRow && "bg-teal-50 dark:bg-teal-950/40 ring-1 ring-inset ring-teal-300 dark:ring-teal-700"
                      )}
                    >
                      <div className="min-w-[3rem] shrink-0 flex items-start pt-0.5">
                        <span className="font-mono text-sm font-bold text-zinc-700 dark:text-slate-200 leading-tight">
                          {formatTimestamp(row.timestamp)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-zinc-800 dark:text-slate-100 leading-tight">
                            {row.bossAbility}
                          </span>
                          {mechBadge && (
                            <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", mechBadge.className)}>
                              {mechBadge.label}
                            </span>
                          )}
                          {dmgTypeIcon && (
                            <Image src={dmgTypeIcon} alt={row.damageEvent!.type} width={16} height={16} className="shrink-0 opacity-70" />
                          )}
                          {row.cleanse && hasCleanseCapability && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 cursor-default">Cleanse</span>
                              </TooltipTrigger>
                              <TooltipContent side="right">Players should cleanse this debuff</TooltipContent>
                            </Tooltip>
                          )}
                          {row.interrupt && hasInterruptCapability && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 cursor-default">Interrupt</span>
                              </TooltipTrigger>
                              <TooltipContent side="right">This ability can be interrupted</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {abilityEntries.map(({ job, abilityId }, i) => {
                            const ability = abilityById.get(abilityId);
                            if (!ability) return null;
                            const roleColor = JOB_ROLE_COLOR[job] ?? FALLBACK_JOB_COLOR;
                            return (
                              <span
                                key={`${abilityId}-${i}`}
                                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300"
                              >
                                {isMultiJob && (
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: roleColor }} />
                                )}
                                <Image src={ability.iconPath} alt={ability.name} width={16} height={16} className="rounded-sm shrink-0" />
                                {isMultiJob && <span className="text-[10px] font-semibold opacity-60">{job}</span>}
                                {ability.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Centered style — grid Fragment for both compact and full
                {
                  const isCurrentRow = row.timestamp === currentTimestamp;
                  const cellBase = cn(
                    "border-b border-zinc-100 dark:border-slate-800/60",
                    myPlanCompactView ? "py-1.5" : "py-3",
                    isCurrentRow && "bg-teal-50 dark:bg-teal-950/40"
                  );
                  return (
                    <Fragment key={`row-${row.timestamp}-${idx}`}>
                      {/* Col 1: abilities right-aligned */}
                      <div className={cn(cellBase, "flex items-center justify-end flex-wrap gap-1.5 pl-3 pr-2 border-l-[3px]", stripeClass)}>
                        {myPlanCompactView ? (
                          abilityEntries.map(({ job, abilityId }, i) => {
                            const ability = abilityById.get(abilityId);
                            if (!ability) return null;
                            const roleColor = JOB_ROLE_COLOR[job] ?? FALLBACK_JOB_COLOR;
                            return (
                              <span key={`${abilityId}-${i}`} className="relative inline-flex items-center shrink-0">
                                {isMultiJob && (
                                  <span
                                    className="absolute -top-0.5 -left-0.5 w-2 h-2 rounded-full border border-white dark:border-slate-900 z-10"
                                    style={{ backgroundColor: roleColor }}
                                  />
                                )}
                                <Image
                                  src={ability.iconPath}
                                  alt={ability.name}
                                  width={24}
                                  height={24}
                                  className="rounded"
                                  title={isMultiJob ? `${job}: ${ability.name}` : ability.name}
                                />
                              </span>
                            );
                          })
                        ) : (
                          abilityEntries.map(({ job, abilityId }, i) => {
                            const ability = abilityById.get(abilityId);
                            if (!ability) return null;
                            const roleColor = JOB_ROLE_COLOR[job] ?? FALLBACK_JOB_COLOR;
                            return (
                              <span
                                key={`${abilityId}-${i}`}
                                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300"
                              >
                                {isMultiJob && (
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: roleColor }} />
                                )}
                                <Image src={ability.iconPath} alt={ability.name} width={16} height={16} className="rounded-sm shrink-0" />
                                {isMultiJob && <span className="text-[10px] font-semibold opacity-60">{job}</span>}
                                {ability.name}
                              </span>
                            );
                          })
                        )}
                      </div>
                      {/* Col 2: Timestamp centered */}
                      <div
                        ref={(el) => {
                          if (el) rowRefs.current.set(row.timestamp, el);
                          else rowRefs.current.delete(row.timestamp);
                        }}
                        className={cn(cellBase, "flex items-center justify-center px-3")}
                      >
                        <span className="font-mono text-sm font-bold text-zinc-700 dark:text-slate-200 leading-tight">
                          {formatTimestamp(row.timestamp)}
                        </span>
                      </div>
                      {/* Col 3: Boss ability + badges */}
                      <div className={cn(cellBase, "flex items-center gap-1.5 flex-wrap pl-2 pr-4")}>
                        <span className="text-sm font-semibold text-zinc-500 dark:text-slate-400 leading-tight">
                          {row.bossAbility}
                        </span>
                        {!myPlanCompactView && mechBadge && (
                          <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-medium", mechBadge.className)}>
                            {mechBadge.label}
                          </span>
                        )}
                        {!myPlanCompactView && dmgTypeIcon && (
                          <Image src={dmgTypeIcon} alt={row.damageEvent!.type} width={16} height={16} className="shrink-0 opacity-70" />
                        )}
                        {row.cleanse && hasCleanseCapability && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 cursor-default">Cleanse</span>
                            </TooltipTrigger>
                            <TooltipContent side="right">Players should cleanse this debuff</TooltipContent>
                          </Tooltip>
                        )}
                        {row.interrupt && hasInterruptCapability && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 cursor-default">Interrupt</span>
                            </TooltipTrigger>
                            <TooltipContent side="right">This ability can be interrupted</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </Fragment>
                  );
                }
              })}
            </div>
          </div>

          {/* Toolbox (collapsible) — single job only */}
          {!isMultiJob && (
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
          )}
        </>
      )}
    </div>
  );
}
