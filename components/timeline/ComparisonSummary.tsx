import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/format-timestamp";
import type { JobAbbreviation } from "@/types/ffixiv-job";

export interface DiffEntry {
  job: JobAbbreviation;
  abilityName: string;
  iconPath: string;
}

export interface DiffRow {
  timestamp: number;
  bossAbility: string;
  missing: DiffEntry[];
  extra: DiffEntry[];
}

function Chip({ entry, variant }: { entry: DiffEntry; variant: "missing" | "extra" }) {
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
        <Image
          src={entry.iconPath}
          alt=""
          width={16}
          height={16}
          className="rounded-sm shrink-0"
          aria-hidden
        />
      )}
      <span className="font-mono text-zinc-500 dark:text-slate-400">{entry.job}</span>
      <span>{entry.abilityName}</span>
    </span>
  );
}

export function ComparisonSummary({
  rows,
  label,
  url,
}: {
  rows: DiffRow[];
  label: string | null;
  url: string | null;
}) {
  const totalMissing = rows.reduce((n, r) => n + r.missing.length, 0);
  const totalExtra = rows.reduce((n, r) => n + r.extra.length, 0);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 dark:border-slate-800 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-slate-200">Comparison summary</h2>
        {label &&
          (url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-md bg-zinc-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors cursor-pointer"
            >
              <span className="truncate">{label}</span>
              <ExternalLink size={11} className="shrink-0" />
            </a>
          ) : (
            <span className="max-w-[16rem] truncate rounded-md bg-zinc-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-slate-400">
              {label}
            </span>
          ))}
        <span className="ml-auto flex items-center gap-2 text-xs font-mono">
          <span className="text-red-500 dark:text-red-400">−{totalMissing} missing</span>
          <span className="text-zinc-300 dark:text-slate-600">·</span>
          <span className="text-green-600 dark:text-green-400">+{totalExtra} extra</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-slate-400">
          No differences — plan and comparison match.
        </p>
      ) : (
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
                      <Chip key={`m-${i}`} entry={e} variant="missing" />
                    ))}
                  </div>
                )}
                {row.extra.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                      Extra
                    </span>
                    {row.extra.map((e, i) => (
                      <Chip key={`e-${i}`} entry={e} variant="extra" />
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
