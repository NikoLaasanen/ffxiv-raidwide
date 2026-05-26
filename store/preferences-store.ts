import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { JobAbbreviation } from "@/types/ffixiv-job";

export type AbilityTarget = "self" | "party" | "single";
export type AbilityType = "mitigation" | "utility" | "buff" | "interrupt" | "cleanse";
export type TimelineViewMode = "full" | "my";

export interface UserPreferences {
  showAutoAttacks: boolean;
  showDamageColumn: boolean;
  activationBuffer: number;
  abilityTargetFilter: AbilityTarget[];
  abilityTypeFilter: AbilityType[];
  showSourceColumn: boolean;
  showMechanicTypeColumn: boolean;
  showMistakesColumn: boolean;
  timelineViewMode: TimelineViewMode;
  myTimelinePlayerJob: JobAbbreviation | null;
  myPlanDefaultJob: JobAbbreviation | null;
  myPlanCompactView: boolean;
}

interface PreferencesActions {
  setShowAutoAttacks: (v: boolean) => void;
  setShowDamageColumn: (v: boolean) => void;
  setActivationBuffer: (v: number) => void;
  setAbilityTargetFilter: (v: AbilityTarget[]) => void;
  setAbilityTypeFilter: (v: AbilityType[]) => void;
  setShowSourceColumn: (v: boolean) => void;
  setShowMechanicTypeColumn: (v: boolean) => void;
  setShowMistakesColumn: (v: boolean) => void;
  setTimelineViewMode: (v: TimelineViewMode) => void;
  setMyTimelinePlayerJob: (v: JobAbbreviation | null) => void;
  setMyPlanDefaultJob: (v: JobAbbreviation | null) => void;
  setMyPlanCompactView: (v: boolean) => void;
  resetPreferences: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  showAutoAttacks: false,
  showDamageColumn: false,
  activationBuffer: 1,
  abilityTargetFilter: ["party"],
  abilityTypeFilter: ["mitigation", "utility"],
  showSourceColumn: false,
  showMechanicTypeColumn: false,
  showMistakesColumn: false,
  timelineViewMode: "full",
  myTimelinePlayerJob: null,
  myPlanDefaultJob: null,
  myPlanCompactView: false,
};

export const usePreferencesStore = create<UserPreferences & PreferencesActions>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,

      setShowAutoAttacks: (v) => set({ showAutoAttacks: v }),
      setShowDamageColumn: (v) => set({ showDamageColumn: v }),
      setActivationBuffer: (v) => set({ activationBuffer: Math.max(0, v) }),
      setAbilityTargetFilter: (v) => set({ abilityTargetFilter: v }),
      setAbilityTypeFilter: (v) => set({ abilityTypeFilter: v }),
      setShowSourceColumn: (v) => set({ showSourceColumn: v }),
      setShowMechanicTypeColumn: (v) => set({ showMechanicTypeColumn: v }),
      setShowMistakesColumn: (v) => set({ showMistakesColumn: v }),
      setTimelineViewMode: (v) => set({ timelineViewMode: v }),
      setMyTimelinePlayerJob: (v) => set({ myTimelinePlayerJob: v }),
      setMyPlanDefaultJob: (v) => set({ myPlanDefaultJob: v }),
      setMyPlanCompactView: (v) => set({ myPlanCompactView: v }),
      resetPreferences: () => set(DEFAULT_PREFERENCES),
    }),
    {
      name: "ffxiv-raidwide-preferences",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        showAutoAttacks: state.showAutoAttacks,
        showDamageColumn: state.showDamageColumn,
        activationBuffer: state.activationBuffer,
        abilityTargetFilter: state.abilityTargetFilter,
        abilityTypeFilter: state.abilityTypeFilter,
        showSourceColumn: state.showSourceColumn,
        showMechanicTypeColumn: state.showMechanicTypeColumn,
        showMistakesColumn: state.showMistakesColumn,
        myTimelinePlayerJob: state.myTimelinePlayerJob,
        myPlanDefaultJob: state.myPlanDefaultJob,
        myPlanCompactView: state.myPlanCompactView,
      }),
    }
  )
);
