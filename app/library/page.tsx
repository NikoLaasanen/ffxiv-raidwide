"use client";

import Image from "next/image";
import { useJobAbilities } from "@/hooks/use-job-abilities";
import { JOB_GROUPS, JOB_NAMES, ALL_JOBS, JOB_ROLE_COLOR } from "@/lib/jobs";
import type { JobAbilityRecord, AbilityType } from "@/types/job-ability";

const TYPE_BADGE: Record<AbilityType, string> = {
  mitigation: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  utility:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  buff:       "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  interrupt:  "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  cleanse:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

function fmt(val: number, suffix: string) {
  return val > 0 ? `${val}${suffix}` : "—";
}

function AbilityRow({ ability }: { ability: JobAbilityRecord }) {
  return (
    <tr
      className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 ${
        ability.enabled ? "" : "opacity-40"
      }`}
    >
      <td className="px-3 py-2 w-10">
        <Image
          src={ability.iconPath}
          alt={ability.name}
          width={32}
          height={32}
          className="rounded"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm">{ability.name}</span>
          {ability.isRoleAction && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400 font-medium uppercase tracking-wide leading-none">
              Role
            </span>
          )}
          {!ability.enabled && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600 italic">disabled</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 w-24">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[ability.abilityType]}`}>
          {ability.abilityType}
        </span>
      </td>
      <td className="px-3 py-2 w-16 text-xs text-zinc-500 dark:text-zinc-400">{ability.target}</td>
      <td className="px-3 py-2 w-16 text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
        {fmt(ability.cooldown, "s")}
      </td>
      <td className="px-3 py-2 w-16 text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
        {fmt(ability.duration, "s")}
      </td>
      <td className="px-3 py-2 w-16 text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
        {fmt(ability.mitigationPhysical, "%")}
      </td>
      <td className="px-3 py-2 w-16 text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
        {fmt(ability.mitigationMagical, "%")}
      </td>
    </tr>
  );
}

export default function LibraryPage() {
  const { abilitiesByJob, isLoading } = useJobAbilities(ALL_JOBS, { includeDisabled: true });

  return (
    <main className="flex-1">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold">Ability Library</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        All job abilities grouped by role. Dimmed rows are disabled.
      </p>

      {isLoading ? (
        <div className="mt-16 text-center text-sm text-zinc-400">Loading abilities…</div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {JOB_GROUPS.map((group) => {
            const roleColor = JOB_ROLE_COLOR[group.jobs[0]] ?? "#71717a";
            return (
              <section key={group.label}>
                <h2
                  className="text-base font-semibold mb-4 pl-3 border-l-4"
                  style={{ borderColor: roleColor, color: roleColor }}
                >
                  {group.label}
                </h2>

                <div className="flex flex-col gap-6">
                  {group.jobs.map((job) => {
                    const abilities = (abilitiesByJob[job] ?? []).filter(a => !a.isRoleAction);
                    if (abilities.length === 0) return null;

                    return (
                      <div key={job}>
                        <div className="flex items-baseline gap-2 mb-1.5 px-1">
                          <span
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: roleColor }}
                          >
                            {job}
                          </span>
                          <span className="text-sm font-medium">{JOB_NAMES[job]}</span>
                          <span className="text-xs text-zinc-400">{abilities.length} abilities</span>
                        </div>

                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                                <th className="px-3 py-1.5 w-10" />
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-24">Type</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Target</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">CD</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Duration</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Phys</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Mag</th>
                              </tr>
                            </thead>
                            <tbody>
                              {abilities.map((ability) => (
                                <AbilityRow key={ability.id} ability={ability} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}

                  {(() => {
                    const roleActions = Object.values(
                      group.jobs
                        .flatMap(job => (abilitiesByJob[job] ?? []).filter(a => a.isRoleAction))
                        .reduce<Record<string, JobAbilityRecord>>((acc, a) => {
                          acc[a.id] ??= a;
                          return acc;
                        }, {})
                    );
                    if (roleActions.length === 0) return null;
                    return (
                      <div>
                        <div className="flex items-baseline gap-2 mb-1.5 px-1">
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: roleColor }}>
                            Role
                          </span>
                          <span className="text-sm font-medium">Role Actions</span>
                          <span className="text-xs text-zinc-400">{roleActions.length} abilities</span>
                        </div>
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                                <th className="px-3 py-1.5 w-10" />
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Name</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-24">Type</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Target</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">CD</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Duration</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Phys</th>
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 w-16">Mag</th>
                              </tr>
                            </thead>
                            <tbody>
                              {roleActions.map(a => <AbilityRow key={a.id} ability={a} />)}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>
            );
          })}
        </div>
      )}
      </div>
    </main>
  );
}
