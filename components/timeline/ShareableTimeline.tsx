import { forwardRef } from "react";
import Image from "next/image";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { DisplayItem } from "@/lib/my-timeline";
import { formatTimestamp } from "@/lib/format-timestamp";
import { JOB_ROLE_COLOR, JOB_NAMES, JOB_GROUPS, ALL_JOBS } from "@/lib/jobs";
import { FALLBACK_JOB_COLOR } from "@/lib/timeline-constants";

const MECH_BADGE: Record<string, { bg: string; fg: string }> = {
  enrage: { bg: "#fee2e2", fg: "#b91c1c" },
  tankbuster: { bg: "#ffedd5", fg: "#c2410c" },
  party: { bg: "#dbeafe", fg: "#1d4ed8" },
  single: { bg: "#f4f4f5", fg: "#71717a" },
};

const JOB_ROLE = new Map<JobAbbreviation, string>();
for (const group of JOB_GROUPS) {
  for (const job of group.jobs) JOB_ROLE.set(job, group.label);
}

/**
 * Assigns each job a shape index *within its role*, so two same-role jobs that
 * share a role action (e.g. both tanks with Reprisal) are distinguishable in
 * the exported image. 0=circle, 1=triangle, 2=square, 3=star.
 */
function buildShapeIndexByJob(jobs: JobAbbreviation[]): Map<JobAbbreviation, number> {
  const byRole = new Map<string, JobAbbreviation[]>();
  for (const job of jobs) {
    const role = JOB_ROLE.get(job) ?? "?";
    const arr = byRole.get(role) ?? [];
    arr.push(job);
    byRole.set(role, arr);
  }
  const result = new Map<JobAbbreviation, number>();
  for (const arr of byRole.values()) {
    arr.sort((a, b) => ALL_JOBS.indexOf(a) - ALL_JOBS.indexOf(b));
    arr.forEach((job, i) => result.set(job, i));
  }
  return result;
}

const STAR_POINTS =
  "5,0.2 6.18,3.38 9.76,3.46 6.9,5.62 7.94,9.3 5,7.1 2.06,9.3 3.1,5.62 0.25,3.46 3.82,3.38";

function ShapeMarker({ index, color, px }: { index: number; color: string; px: number }) {
  const common = {
    fill: color,
    stroke: "#ffffff",
    strokeWidth: 1.2,
    strokeLinejoin: "round" as const,
  };
  let shape;
  switch (Math.min(index, 3)) {
    case 0:
      shape = <circle cx={5} cy={5} r={4.2} {...common} />;
      break;
    case 1:
      shape = <polygon points="5,0.7 9.4,9.3 0.6,9.3" {...common} />;
      break;
    case 2:
      shape = <rect x={0.8} y={0.8} width={8.4} height={8.4} rx={1} {...common} />;
      break;
    default:
      shape = <polygon points={STAR_POINTS} {...common} />;
  }
  return (
    <svg width={px} height={px} viewBox="0 0 10 10" aria-hidden>
      {shape}
    </svg>
  );
}

interface ShareableTimelineProps {
  title: string;
  encounterTier?: string | null;
  selectedJobs: JobAbbreviation[];
  displayItems: DisplayItem[];
  abilityById: Map<string, JobAbilityRecord>;
  isMultiJob: boolean;
}

/**
 * Static, light-themed card rendered off-screen and captured to PNG by
 * ShareImageDialog. Avoids `dark:` variants so the exported image looks the
 * same regardless of the app's active theme.
 */
export const ShareableTimeline = forwardRef<HTMLDivElement, ShareableTimelineProps>(
  function ShareableTimeline(
    { title, encounterTier, selectedJobs, displayItems, abilityById, isMultiJob },
    ref
  ) {
    const shapeByJob = buildShapeIndexByJob(selectedJobs);

    return (
      <div
        ref={ref}
        style={{ width: 720, backgroundColor: "#ffffff", color: "#18181b" }}
        className="font-sans"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-200">
          {encounterTier && <p className="text-xs text-zinc-500 mb-1">{encounterTier}</p>}
          <h1 className="text-xl font-bold leading-tight text-zinc-900">{title}</h1>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {selectedJobs.map((job) => {
              const color = JOB_ROLE_COLOR[job] ?? FALLBACK_JOB_COLOR;
              return (
                <span
                  key={job}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: `${color}22`, color: "#3f3f46" }}
                >
                  <ShapeMarker index={shapeByJob.get(job) ?? 0} color={color} px={10} />
                  {JOB_NAMES[job]}
                </span>
              );
            })}
          </div>
        </div>

        {/* Rows */}
        <div>
          {displayItems.map((item, idx) => {
            if (item.kind === "phase") {
              return (
                <div
                  key={`phase-${item.phase.timestamp}`}
                  className="flex items-center gap-2 px-6 py-1.5 bg-zinc-100 border-b border-zinc-200"
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-zinc-600">
                    {item.phase.name}
                  </span>
                  <span className="text-xs font-mono text-zinc-400">
                    {formatTimestamp(item.phase.timestamp)}–{formatTimestamp(item.endTimestamp)}
                  </span>
                </div>
              );
            }

            const { row, abilityEntries } = item;
            const mech =
              row.mechanicType && row.mechanicType !== "unknown"
                ? MECH_BADGE[row.mechanicType]
                : null;

            return (
              <div
                key={`row-${row.timestamp}-${idx}`}
                className="flex items-center gap-3 px-6 py-2 border-b border-zinc-100"
              >
                <span className="font-mono text-sm font-bold text-zinc-500 shrink-0 w-12">
                  {formatTimestamp(row.timestamp)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {abilityEntries.map(({ job, abilityId }, i) => {
                    const ability = abilityById.get(abilityId);
                    if (!ability) return null;
                    const roleColor = JOB_ROLE_COLOR[job] ?? FALLBACK_JOB_COLOR;
                    return (
                      <span key={`${abilityId}-${i}`} className="relative inline-flex">
                        {isMultiJob && (
                          <span className="absolute -top-1 -left-1 z-10">
                            <ShapeMarker index={shapeByJob.get(job) ?? 0} color={roleColor} px={10} />
                          </span>
                        )}
                        <Image
                          src={ability.iconPath}
                          alt={ability.name}
                          width={26}
                          height={26}
                          loading="eager"
                          className="rounded"
                        />
                      </span>
                    );
                  })}
                </div>
                <span className="text-sm font-semibold text-zinc-800 leading-tight">
                  {row.bossAbility}
                </span>
                {mech && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: mech.bg, color: mech.fg }}
                  >
                    {row.mechanicType}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-zinc-50 border-t border-zinc-200">
          <span className="text-[11px] font-medium text-zinc-400">Made with ffxiv-raidwide</span>
        </div>
      </div>
    );
  }
);
