import { create } from "zustand";
import type { Plan } from "@/types/plan";
import type { FflogsImportResult } from "@/types/fflogs";

interface PlanState {
  plan: Plan | null;
  pendingImport: FflogsImportResult | null;
  selectedTimestamp: number | null;
  mode: "edit" | "view";
  past: Plan[];
  future: Plan[];
}

interface PlanActions {
  setPlan: (plan: Plan) => void;
  setPendingImport: (data: FflogsImportResult | null) => void;
  updatePlan: (updater: (plan: Plan) => Plan) => void;
  undo: () => void;
  redo: () => void;
  setSelectedTimestamp: (ts: number | null) => void;
  setMode: (mode: "edit" | "view") => void;
}

export const usePlanStore = create<PlanState & PlanActions>((set, get) => ({
  plan: null,
  pendingImport: null,
  selectedTimestamp: null,
  mode: "edit",
  past: [],
  future: [],

  setPlan: (plan) => set({ plan, past: [], future: [] }),
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
}));
