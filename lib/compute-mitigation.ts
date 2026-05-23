import type { DamageEvent } from "@/types/timeline";
import type { MitigationAssignment } from "@/types/timeline";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { Player } from "@/types/player";
import type { DamageType } from "@/types/common";

export interface RowMitigation {
  totalMitPercent: number;
  mitigatedDamage: number | null;
}

const RANGED_SHARED_MIT = new Set(["Shield Samba", "Tactician", "Troubadour"]);

function effectiveMitValue(ability: JobAbilityRecord, type: DamageType): number {
  if (type === "physical") return ability.mitigationPhysical;
  if (type === "magical") return ability.mitigationMagical;
  return Math.max(ability.mitigationPhysical, ability.mitigationMagical);
}

export function computeRowMitigation(
  rowTimestamp: number,
  damageEvent: DamageEvent | undefined,
  allJobs: JobAbbreviation[],
  abilitiesByJob: Record<JobAbbreviation, JobAbilityRecord[]>,
  playerByJob: Map<JobAbbreviation, Player>,
  assignmentsByPlayerAbility: Map<string, MitigationAssignment[]>
): RowMitigation {
  if (!damageEvent) return { totalMitPercent: 0, mitigatedDamage: null };

  const damageType = damageEvent.type;
  const addedAbilities: string[] = [];
  let mitProduct = 1;

  for (const job of allJobs) {
    const player = playerByJob.get(job);
    if (!player) continue;

    for (const ability of abilitiesByJob[job] ?? []) {
      const list = assignmentsByPlayerAbility.get(`${player.id}|${ability.id}`) ?? [];
      const durationMs = ability.duration * 1000;

      const isActive = list.some(
        (a) =>
          a.timestamp === rowTimestamp ||
          (rowTimestamp > a.timestamp && rowTimestamp < a.timestamp + durationMs)
      );
      if (!isActive) continue;

      // Prevent same ability name from contributing twice
      if (addedAbilities.includes(ability.name)) continue;

      // Ranged shared mitigation dedup: skip if another ranged shared mitigation ability was already counted
      if (
        RANGED_SHARED_MIT.has(ability.name) &&
        addedAbilities.some((n) => RANGED_SHARED_MIT.has(n))
      ) {
        continue;
      }

      const mitValue = effectiveMitValue(ability, damageType);
      if (mitValue <= 0) continue;
      if (damageType === "unique" && mitValue >= 100) continue;

      addedAbilities.push(ability.name);
      mitProduct *= 1 - mitValue / 100;
    }
  }

  const totalMitPercent = (1 - mitProduct) * 100;
  const mitigatedDamage = Math.round(damageEvent.rawDamage * mitProduct);

  return { totalMitPercent, mitigatedDamage };
}
