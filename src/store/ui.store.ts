// src/store/ui.store.ts
// FULL FILE
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
  isProjectSettingsModalOpen: boolean;
  projectSettingsModalTargetId: string | null;
  // Add state for VFS modal
  isVfsModalOpen: boolean;
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
  openProjectSettingsModal: (projectId: string) => void;
  closeProjectSettingsModal: () => void;
  // Add actions for VFS modal
  toggleVfsModal: (isOpen?: boolean) => void;
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
    isProjectSettingsModalOpen: false,
    projectSettingsModalTargetId: null,
    // Initialize VFS modal state
    isVfsModalOpen: false,

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

    // Actions for VFS modal
    toggleVfsModal: (isOpen) => {
      set((state) => {
        state.isVfsModalOpen = isOpen ?? !state.isVfsModalOpen;
      });
    },
  })),
);
