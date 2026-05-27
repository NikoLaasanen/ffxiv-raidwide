import { createLocalStorage } from "@/lib/local-storage";
import type { EncounterType } from "@/types/encounter";

export interface MyPlanEntry {
  id: string;
  title: string;
  editLinkId: string;
  viewLinkId: string;
  encounterId: string | null;
  encounterType: EncounterType | null;
  updatedAt: number;
  savedAt: number;
}

const store = createLocalStorage<MyPlanEntry>("ffxiv-raidwide-my-plans", "ffxiv-my-plans-updated", 50);

export const getMyPlans = () => store.get();
export const subscribeToMyPlans = (cb: () => void) => store.subscribe(cb);
export const upsertMyPlan = (entry: MyPlanEntry) => store.upsert(entry, (e) => e.id);
export const removeMyPlan = (id: string) => store.remove(id, (e) => e.id);
