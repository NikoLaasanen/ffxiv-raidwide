import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Plan } from "@/types/plan";
import type { FflogsImportResult } from "@/types/fflogs";
import type { MitigationAssignment } from "@/types/timeline";

interface PlanState {
  _hasHydrated: boolean;
  plan: Plan | null;
  /** Unsaved plan copy awaiting explicit save on the draft preview page. */
  draftPlan: Plan | null;
  pendingImport: FflogsImportResult | null;
  selectedTimestamp: number | null;
  mode: "edit" | "view";
  past: Plan[];
  future: Plan[];
  comparisonAssignments: MitigationAssignment[] | null;
  comparisonLabel: string | null;
}

interface PlanActions {
  _setHasHydrated: (v: boolean) => void;
  setPlan: (plan: Plan) => void;
  setDraftPlan: (plan: Plan | null) => void;
  setPendingImport: (data: FflogsImportResult | null) => void;
  updatePlan: (updater: (plan: Plan) => Plan) => void;
  undo: () => void;
  redo: () => void;
  setSelectedTimestamp: (ts: number | null) => void;
  setMode: (mode: "edit" | "view") => void;
  setComparison: (assignments: MitigationAssignment[] | null, label: string | null) => void;
}

export const usePlanStore = create<PlanState & PlanActions>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      plan: null,
      draftPlan: null,
      pendingImport: null,
      selectedTimestamp: null,
      mode: "edit",
      past: [],
      future: [],
      comparisonAssignments: null,
      comparisonLabel: null,

      _setHasHydrated: (v) => set({ _hasHydrated: v }),
      setPlan: (plan) => set({ plan, past: [], future: [], comparisonAssignments: null, comparisonLabel: null }),
      setDraftPlan: (plan) => set({ draftPlan: plan }),
      setPendingImport: (data) => set({ pendingImport: data }),

      updatePlan: (updater) => {
        const { plan, past } = get();
        if (!plan) return;
        set({
          past: [...past.slice(-49), plan],
          plan: updater(plan),
          future: [],
        });
      },

      undo: () => {
        const { plan, past, future } = get();
        if (past.length === 0 || !plan) return;
        const previous = past[past.length - 1];
        set({
          past: past.slice(0, -1),
          plan: previous,
          future: [plan, ...future],
        });
      },

      redo: () => {
        const { plan, past, future } = get();
        if (future.length === 0 || !plan) return;
        const next = future[0];
        set({
          past: [...past, plan],
          plan: next,
          future: future.slice(1),
        });
      },

      setSelectedTimestamp: (ts) => set({ selectedTimestamp: ts }),
      setMode: (mode) => set({ mode }),
      setComparison: (assignments, label) => set({ comparisonAssignments: assignments, comparisonLabel: label }),
    }),
    {
      name: "ffxiv-raidwide-plan",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ pendingImport: state.pendingImport, draftPlan: state.draftPlan }),
      onRehydrateStorage: () => (state) => {
        state?._setHasHydrated(true);
      },
    }
  )
);
