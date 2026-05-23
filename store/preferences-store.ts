import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type AbilityTarget = "self" | "party" | "single";
export type AbilityType = "mitigation" | "utility" | "buff" | "interrupt";

export interface UserPreferences {
  showAutoAttacks: boolean;
  showDamageColumn: boolean;
  activationBuffer: number;
  abilityTargetFilter: AbilityTarget[];
  abilityTypeFilter: AbilityType[];
  showSourceColumn: boolean;
  showMechanicTypeColumn: boolean;
  showMistakesColumn: boolean;
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
      }),
    }
  )
);
