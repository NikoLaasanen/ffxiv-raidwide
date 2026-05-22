"use client";

import { useState } from "react";
import type { TimelineRow } from "@/types/timeline";
import type { Player } from "@/types/player";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import { JOB_NAMES, JOB_GROUPS } from "@/lib/jobs";
import { formatTimestamp } from "@/lib/format-timestamp";
import { Button } from "@/components/ui/button";

interface TimelineProps {
  timeline: TimelineRow[];
  players: Player[];
}

export function Timeline({ timeline, players }: TimelineProps) {
  const [selectedJobs, setSelectedJobs] = useState<JobAbbreviation[]>(
    () => [...new Set(players.map((p) => p.job))]
  );

  const toggleJob = (job: JobAbbreviation) =>
    setSelectedJobs((prev) =>
      prev.includes(job) ? prev.filter((j) => j !== job) : [...prev, job]
    );

  const visibleRows = timeline.filter((row) => !row.hidden);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400 w-20">
                Time
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400">
                Boss Ability
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-zinc-500 dark:text-zinc-400 w-28">
                Type
              </th>
              <th className="px-4 py-2.5 text-right font-medium text-zinc-500 dark:text-zinc-400 w-28">
                Damage
              </th>
              {selectedJobs.map((job) => (
                <th
                  key={job}
                  className="px-3 py-2.5 text-center font-medium text-zinc-500 dark:text-zinc-400 w-16"
                >
                  {job}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={`${row.timestamp}-${index}`}
                className={
                  index % 2 === 0
                    ? "bg-white dark:bg-zinc-950"
                    : "bg-zinc-50/50 dark:bg-zinc-900/50"
                }
              >
                <td className="px-4 py-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {formatTimestamp(row.timestamp)}
                </td>
                <td className="px-4 py-2 font-medium">{row.bossAbility}</td>
                <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400 capitalize">
                  {row.damageEvent?.type ?? "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs">
                  {row.damageEvent != null
                    ? row.damageEvent.rawDamage.toLocaleString()
                    : "—"}
                </td>
                {selectedJobs.map((job) => (
                  <td
                    key={job}
                    className="px-3 py-2 text-center text-zinc-300 dark:text-zinc-700"
                  >
                    —
                  </td>
                ))}
              </tr>
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
  );
}
