// src/store/ui.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface UIState {
  isChatControlPanelOpen: Record<string, boolean>;
  isPromptControlPanelOpen: Record<string, boolean>;
  isSidebarCollapsed: boolean; // Add this state
  globalLoading: boolean;
  globalError: string | null;
  focusInputOnNextRender: boolean; // Flag to trigger focus
}

interface UIActions {
  toggleChatControlPanel: (panelId: string, isOpen?: boolean) => void;
  togglePromptControlPanel: (controlId: string, isOpen?: boolean) => void;
  toggleSidebar: (isCollapsed?: boolean) => void; // Add this action
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setFocusInputFlag: (focus: boolean) => void; // Action to set the flag
}

export const useUIStateStore = create(
  immer<UIState & UIActions>((set) => ({
    // Initial State
    isChatControlPanelOpen: {},
    isPromptControlPanelOpen: {},
    isSidebarCollapsed: false, // Default to not collapsed
    globalLoading: false,
    globalError: null,
    focusInputOnNextRender: false, // Initialize flag

    // Actions
    toggleChatControlPanel: (panelId, isOpen) => {
      set((state) => {
        state.isChatControlPanelOpen[panelId] =
          isOpen ?? !state.isChatControlPanelOpen[panelId];
      });
    },

    togglePromptControlPanel: (controlId, isOpen) => {
      set((state) => {
        state.isPromptControlPanelOpen[controlId] =
          isOpen ?? !state.isPromptControlPanelOpen[controlId];
      });
    },

    // Action to toggle sidebar
    toggleSidebar: (isCollapsed) => {
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

    // Action to set the focus flag
    setFocusInputFlag: (focus) => {
      set({ focusInputOnNextRender: focus });
    },
  })),
);
