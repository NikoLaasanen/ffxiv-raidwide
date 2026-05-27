import type { DamageType } from "@/types/common";
import type { MechanicType } from "@/types/timeline";

export const FALLBACK_JOB_COLOR = "#94a3b8";

export const DAMAGE_TYPE_ICON: Record<DamageType, string> = {
  magical:  "/icons/MagicalDamage.png",
  physical: "/icons/PhysicalDamage.png",
  unique:   "/icons/UniqueDamage.png",
};

export const MECHANIC_BADGE: Record<MechanicType, { label: string; className: string }> = {
  enrage:     { label: "Enrage",     className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  tankbuster: { label: "Tankbuster", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
  party:      { label: "Party",      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  single:     { label: "Single",     className: "bg-zinc-100 text-zinc-500 dark:bg-slate-800 dark:text-slate-400" },
  unknown:    { label: "—",          className: "text-zinc-300 dark:text-slate-600" },
};
