import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { JobAbbreviation } from "@/types/ffixiv-job";

export interface MistakeRow {
  timestamp: number;
  bossAbility: string;
  deaths: { job: JobAbbreviation }[];
  damageDowns: { job: JobAbbreviation }[];
}

function Chip({ job, icon, variant }: { job: JobAbbreviation; icon: string; variant: "death" | "damageDown" }) {
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

export function MistakeSummary({ rows }: { rows: MistakeRow[] }) {
  if (rows.length === 0) return null;

  const totalDeaths = rows.reduce((n, r) => n + r.deaths.length, 0);
  const totalDamageDowns = rows.reduce((n, r) => n + r.damageDowns.length, 0);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 dark:border-slate-800 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-slate-200">Mistakes summary</h2>
        <span className="ml-auto flex items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            <Image src="/icons/Death.png" alt="" width={14} height={14} aria-hidden />
            {totalDeaths} {totalDeaths === 1 ? "death" : "deaths"}
          </span>
          <span className="text-zinc-300 dark:text-slate-600">·</span>
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
            <Image src="/icons/DamageDown.png" alt="" width={14} height={14} aria-hidden />
            {totalDamageDowns} damage {totalDamageDowns === 1 ? "down" : "downs"}
          </span>
        </span>
      </div>

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
                    <Chip key={`d-${i}`} job={d.job} icon="/icons/Death.png" variant="death" />
                  ))}
                </div>
              )}
              {row.damageDowns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Damage Downs
                  </span>
                  {row.damageDowns.map((d, i) => (
                    <Chip key={`dd-${i}`} job={d.job} icon="/icons/DamageDown.png" variant="damageDown" />
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
