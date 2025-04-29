// src/store/ui.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface UIState {
  isChatControlPanelOpen: Record<string, boolean>;
  isPromptControlPanelOpen: Record<string, boolean>;
  isSidebarCollapsed: boolean;
  globalLoading: boolean;
  globalError: string | null;
  focusInputOnNextRender: boolean;
  initialSettingsTab: string | null; // Added state for initial tab
  initialSettingsSubTab: string | null; // Added state for initial sub-tab
}

interface UIActions {
  toggleChatControlPanel: (panelId: string, isOpen?: boolean) => void;
  togglePromptControlPanel: (controlId: string, isOpen?: boolean) => void;
  toggleSidebar: (isCollapsed?: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setFocusInputFlag: (focus: boolean) => void;
  // Added action to set initial tabs
  setInitialSettingsTabs: (tab: string | null, subTab?: string | null) => void;
  clearInitialSettingsTabs: () => void; // Action to clear the initial tabs
}

export const useUIStateStore = create(
  immer<UIState & UIActions>((set) => ({
    // Initial State
    isChatControlPanelOpen: {},
    isPromptControlPanelOpen: {},
    isSidebarCollapsed: false,
    globalLoading: false,
    globalError: null,
    focusInputOnNextRender: false,
    initialSettingsTab: null, // Initialize
    initialSettingsSubTab: null, // Initialize

    // Actions
    toggleChatControlPanel: (panelId, isOpen) => {
      set((state) => {
        state.isChatControlPanelOpen[panelId] =
          isOpen ?? !state.isChatControlPanelOpen[panelId];
        // Clear initial tabs when closing the settings modal
        if (
          panelId === "settingsModal" &&
          !state.isChatControlPanelOpen[panelId]
        ) {
          state.initialSettingsTab = null;
          state.initialSettingsSubTab = null;
        }
      });
    },

    togglePromptControlPanel: (controlId, isOpen) => {
      set((state) => {
        state.isPromptControlPanelOpen[controlId] =
          isOpen ?? !state.isPromptControlPanelOpen[controlId];
      });
    },

    toggleSidebar: (isCollapsed) => {
      console.log("toggleSidebar called :", isCollapsed);
      set((state) => {
        state.isSidebarCollapsed = isCollapsed ?? !state.isSidebarCollapsed;
      });
    },

    setGlobalLoading: (loading) => {
      set({ globalLoading: loading });
    },

    setGlobalError: (error) => {
      set({ globalError: error });
    },

    setFocusInputFlag: (focus) => {
      set({ focusInputOnNextRender: focus });
    },

    // Action to set initial tabs
    setInitialSettingsTabs: (tab, subTab = null) => {
      set({ initialSettingsTab: tab, initialSettingsSubTab: subTab });
    },

    // Action to clear initial tabs (e.g., when modal closes naturally)
    clearInitialSettingsTabs: () => {
      set({ initialSettingsTab: null, initialSettingsSubTab: null });
    },
  })),
);
