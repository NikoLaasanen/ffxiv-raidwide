import type { DamageEvent } from "@/types/timeline";
import type { MitigationAssignment } from "@/types/timeline";
import type { JobAbilityRecord } from "@/types/job-ability";
import type { JobAbbreviation } from "@/types/ffixiv-job";
import type { Player } from "@/types/player";
import type { DamageType } from "@/types/common";

/** One participant in a redundancy — enough to identify, display, and remove its
 * assignment (`playerId|abilityId|assignmentTimestamp`). */
export interface ConflictParty {
  playerId: string;
  job: JobAbbreviation;
  abilityId: string;
  abilityName: string;
  iconPath: string;
  /** Timestamp of the assignment that made this ability active on the row. */
  assignmentTimestamp: number;
}

/** A mitigation that was active on a damage event but discarded because it does
 * not stack with one already counted — the inverse of the dedup applied below.
 * `kept` is the surviving ability; `wasted` is the discarded one. */
export interface RedundantMit {
  reason: "duplicate" | "ranged-shared";
  kept: ConflictParty;
  wasted: ConflictParty;
}

export interface RowMitigation {
  totalMitPercent: number;
  mitigatedDamage: number | null;
  /** Active-but-discarded mitigations on this row (empty when none). */
  redundancies: RedundantMit[];
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
  if (!damageEvent) return { totalMitPercent: 0, mitigatedDamage: null, redundancies: [] };

  const damageType = damageEvent.type;
  const addedAbilities: string[] = [];
  // The counted (kept) party for attributing discards. Keyed by ability name, plus a
  // single slot for the ranged-shared group (they don't stack with each other).
  const keptByName = new Map<string, ConflictParty>();
  let rangedKeptParty: ConflictParty | null = null;
  const redundancies: RedundantMit[] = [];
  let mitProduct = 1;

  for (const job of allJobs) {
    const player = playerByJob.get(job);
    if (!player) continue;

    for (const ability of abilitiesByJob[job] ?? []) {
      const list = assignmentsByPlayerAbility.get(`${player.id}|${ability.id}`) ?? [];
      const durationMs = ability.duration * 1000;

      const activeAssignment = list.find(
        (a) =>
          a.timestamp === rowTimestamp ||
          (rowTimestamp > a.timestamp && rowTimestamp < a.timestamp + durationMs)
      );
      if (!activeAssignment) continue;

      // The mitigation this ability would contribute if it counted. Discards below
      // only matter for abilities that actually mitigate this damage type.
      const mitValue = effectiveMitValue(ability, damageType);
      if (mitValue <= 0) continue;
      if (damageType === "unique" && mitValue >= 100) continue;

      const party: ConflictParty = {
        playerId: player.id,
        job,
        abilityId: ability.id,
        abilityName: ability.name,
        iconPath: ability.iconPath,
        assignmentTimestamp: activeAssignment.timestamp,
      };

      // Prevent same ability name from contributing twice (e.g. two Reprisals).
      if (addedAbilities.includes(ability.name)) {
        const kept = keptByName.get(ability.name);
        if (kept) redundancies.push({ reason: "duplicate", kept, wasted: party });
        continue;
      }

      // Ranged shared mitigation dedup: skip if another ranged shared mitigation
      // ability was already counted (they share one effect bucket).
      if (
        RANGED_SHARED_MIT.has(ability.name) &&
        addedAbilities.some((n) => RANGED_SHARED_MIT.has(n))
      ) {
        if (rangedKeptParty) redundancies.push({ reason: "ranged-shared", kept: rangedKeptParty, wasted: party });
        continue;
      }

      addedAbilities.push(ability.name);
      keptByName.set(ability.name, party);
      if (RANGED_SHARED_MIT.has(ability.name) && !rangedKeptParty) {
        rangedKeptParty = party;
      }
      mitProduct *= 1 - mitValue / 100;
    }
  }

  const totalMitPercent = (1 - mitProduct) * 100;
  const mitigatedDamage = Math.round(damageEvent.rawDamage * mitProduct);

  return { totalMitPercent, mitigatedDamage, redundancies };
}
