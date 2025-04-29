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
  initialSettingsTab: string | null;
  initialSettingsSubTab: string | null;
  // Added state for project settings modal
  isProjectSettingsModalOpen: boolean;
  projectSettingsModalTargetId: string | null;
}

interface UIActions {
  toggleChatControlPanel: (panelId: string, isOpen?: boolean) => void;
  togglePromptControlPanel: (controlId: string, isOpen?: boolean) => void;
  toggleSidebar: (isCollapsed?: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setFocusInputFlag: (focus: boolean) => void;
  setInitialSettingsTabs: (tab: string | null, subTab?: string | null) => void;
  clearInitialSettingsTabs: () => void;
  // Added actions for project settings modal
  openProjectSettingsModal: (projectId: string) => void;
  closeProjectSettingsModal: () => void;
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
    initialSettingsTab: null,
    initialSettingsSubTab: null,
    // Initialize project settings modal state
    isProjectSettingsModalOpen: false,
    projectSettingsModalTargetId: null,

    // Actions
    toggleChatControlPanel: (panelId, isOpen) => {
      set((state) => {
        state.isChatControlPanelOpen[panelId] =
          isOpen ?? !state.isChatControlPanelOpen[panelId];
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

    setInitialSettingsTabs: (tab, subTab = null) => {
      set({ initialSettingsTab: tab, initialSettingsSubTab: subTab });
    },

    clearInitialSettingsTabs: () => {
      set({ initialSettingsTab: null, initialSettingsSubTab: null });
    },

    // Actions for project settings modal
    openProjectSettingsModal: (projectId) => {
      set({
        isProjectSettingsModalOpen: true,
        projectSettingsModalTargetId: projectId,
      });
    },
    closeProjectSettingsModal: () => {
      set({
        isProjectSettingsModalOpen: false,
        projectSettingsModalTargetId: null,
      });
    },
  })),
);
