import type { EncounterDoc } from "@/types/encounter";
import type { FflogsImportResult } from "@/types/fflogs";
import type { Plan } from "@/types/plan";

export function buildPlanFromImport(result: FflogsImportResult): Plan {
  const editLinkId = crypto.randomUUID();
  const viewLinkId = crypto.randomUUID();
  const now = Date.now();
  return {
    id: editLinkId,
    editLinkId,
    viewLinkId,
    title: result.fight.name,
    encounterId: result.encounterId ?? null,
    encounterType: result.encounterType ?? null,
    encounterTier: result.encounterTier ?? null,
    raidplanLink: `https://www.fflogs.com/reports/${result.reportCode}#fight=${result.fight.id}`,
    timeline: result.timeline,
    players: result.players,
    phases: result.phases ?? [],
    assignments: [],
    createdAt: now,
    updatedAt: now,
  };
}

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
