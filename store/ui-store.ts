import { create } from "zustand";

interface UIState {
  detailPanelOpen: boolean;
  sidebarOpen: boolean;
  activeAbilityFilter: string | null;
}

interface UIActions {
  setDetailPanelOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveAbilityFilter: (abilityId: string | null) => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  detailPanelOpen: false,
  sidebarOpen: false,
  activeAbilityFilter: null,

  setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveAbilityFilter: (abilityId) => set({ activeAbilityFilter: abilityId }),
}));
