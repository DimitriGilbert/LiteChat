// src/store/ui.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface UIState {
  // Records to store open state for panels, keyed by ID
  isChatControlPanelOpen: Record<string, boolean>;
  isPromptControlPanelOpen: Record<string, boolean>;
  globalLoading: boolean; // General loading indicator for app-wide processes
  globalError: string | null; // For displaying critical app-wide errors
}

interface UIActions {
  // Toggle functions accept an optional explicit state
  toggleChatControlPanel: (panelId: string, isOpen?: boolean) => void;
  togglePromptControlPanel: (controlId: string, isOpen?: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
}

export const useUIStateStore = create(
  immer<UIState & UIActions>((set) => ({
    // Initial State
    isChatControlPanelOpen: {},
    isPromptControlPanelOpen: {},
    globalLoading: false, // Start not loading
    globalError: null, // Start with no error

    // Actions
    toggleChatControlPanel: (panelId, isOpen) => {
      set((state) => {
        // If isOpen is provided, use it; otherwise, toggle the current state
        state.isChatControlPanelOpen[panelId] =
          isOpen ?? !state.isChatControlPanelOpen[panelId];
      });
    },

    togglePromptControlPanel: (controlId, isOpen) => {
      set((state) => {
        // If isOpen is provided, use it; otherwise, toggle the current state
        state.isPromptControlPanelOpen[controlId] =
          isOpen ?? !state.isPromptControlPanelOpen[controlId];
      });
    },

    setGlobalLoading: (loading) => {
      set({ globalLoading: loading });
    },

    setGlobalError: (error) => {
      set({ globalError: error });
    },
  })),
);
