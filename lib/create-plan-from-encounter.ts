import type { EncounterDoc } from "@/types/encounter";
import type { Plan } from "@/types/plan";

export function buildPlanFromEncounter(encounter: EncounterDoc): Plan {
  const editLinkId = crypto.randomUUID();
  const viewLinkId = crypto.randomUUID();
  const now = Date.now();
  return {
    id: editLinkId,
    editLinkId,
    viewLinkId,
    title: encounter.name,
    encounterId: encounter.id,
    encounterType: encounter.type ?? null,
    encounterTier: encounter.tier ?? null,
    raidplanLink: null,
    timeline: encounter.timeline,
    players: [],
    phases: encounter.phases ?? [],
    assignments: [],
    createdAt: now,
    updatedAt: now,
  };
}
