// src/store/ui.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent, UiEventPayloads } from "@/types/litechat/events/ui.events";
import type { RegisteredActionHandler } from "@/types/litechat/control";

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
  toggleVfsModal: (isOpen?: boolean) => void;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

export const useUIStateStore = create(
  immer<UIState & UIActions>((set, get) => ({
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
    isVfsModalOpen: false,

    // Actions
    toggleChatControlPanel: (panelId, isOpen) => {
      const currentOpenState = get().isChatControlPanelOpen[panelId] ?? false;
      const newOpenState = isOpen ?? !currentOpenState;

      if (currentOpenState !== newOpenState) {
        set((state) => {
          state.isChatControlPanelOpen[panelId] = newOpenState;
          if (panelId === "settingsModal" && !newOpenState) {
            state.initialSettingsTab = null;
            state.initialSettingsSubTab = null;
          }
        });
        emitter.emit(uiEvent.chatControlPanelVisibilityChanged, {
          panelId,
          isOpen: newOpenState,
        });
      }
    },

    togglePromptControlPanel: (controlId, isOpen) => {
      const currentOpenState =
        get().isPromptControlPanelOpen[controlId] ?? false;
      const newOpenState = isOpen ?? !currentOpenState;

      if (currentOpenState !== newOpenState) {
        set((state) => {
          state.isPromptControlPanelOpen[controlId] = newOpenState;
        });
        emitter.emit(uiEvent.promptControlPanelVisibilityChanged, {
          controlId,
          isOpen: newOpenState,
        });
      }
    },

    toggleSidebar: (isCollapsed) => {
      const currentCollapsedState = get().isSidebarCollapsed;
      const newCollapsedState = isCollapsed ?? !currentCollapsedState;

      if (currentCollapsedState !== newCollapsedState) {
        set({ isSidebarCollapsed: newCollapsedState });
        emitter.emit(uiEvent.sidebarVisibilityChanged, {
          isCollapsed: newCollapsedState,
        });
      }
    },

    setGlobalLoading: (loading) => {
      if (get().globalLoading !== loading) {
        set({ globalLoading: loading });
        emitter.emit(uiEvent.globalLoadingChanged, { loading });
      }
    },

    setGlobalError: (error) => {
      if (get().globalError !== error) {
        set({ globalError: error });
        emitter.emit(uiEvent.globalErrorChanged, { error });
      }
    },

    setFocusInputFlag: (focus) => {
      if (get().focusInputOnNextRender !== focus) {
        set({ focusInputOnNextRender: focus });
        emitter.emit(uiEvent.focusInputFlagChanged, { focus });
      }
    },

    setInitialSettingsTabs: (tab, subTab = null) => {
      set({ initialSettingsTab: tab, initialSettingsSubTab: subTab });
      // No specific event for this internal UI state, modal opening will trigger its own events
    },

    clearInitialSettingsTabs: () => {
      set({ initialSettingsTab: null, initialSettingsSubTab: null });
    },

    openProjectSettingsModal: (projectId) => {
      set({
        isProjectSettingsModalOpen: true,
        projectSettingsModalTargetId: projectId,
      });
      emitter.emit(uiEvent.modalStateChanged, {
        modalId: "projectSettingsModal",
        isOpen: true,
        targetId: projectId,
      });
    },
    closeProjectSettingsModal: () => {
      set({
        isProjectSettingsModalOpen: false,
        projectSettingsModalTargetId: null,
      });
      emitter.emit(uiEvent.modalStateChanged, {
        modalId: "projectSettingsModal",
        isOpen: false,
      });
    },

    toggleVfsModal: (isOpen) => {
      const currentOpenState = get().isVfsModalOpen;
      const newOpenState = isOpen ?? !currentOpenState;

      if (currentOpenState !== newOpenState) {
        set({ isVfsModalOpen: newOpenState });
        emitter.emit(uiEvent.modalStateChanged, {
          modalId: "core-vfs-modal-panel", // Assuming this is the modalId
          isOpen: newOpenState,
        });
      }
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "uiStateStore";
      const actions = get();
      return [
        {
          eventName: uiEvent.toggleSidebarRequest,
          handler: (p: UiEventPayloads[typeof uiEvent.toggleSidebarRequest]) =>
            actions.toggleSidebar(p?.isCollapsed),
          storeId,
        },
        {
          eventName: uiEvent.toggleChatControlPanelRequest,
          handler: (
            p: UiEventPayloads[typeof uiEvent.toggleChatControlPanelRequest]
          ) => actions.toggleChatControlPanel(p.panelId, p.isOpen),
          storeId,
        },
        {
          eventName: uiEvent.togglePromptControlPanelRequest,
          handler: (
            p: UiEventPayloads[typeof uiEvent.togglePromptControlPanelRequest]
          ) => actions.togglePromptControlPanel(p.controlId, p.isOpen),
          storeId,
        },
        {
          eventName: uiEvent.setGlobalLoadingRequest,
          handler: (
            p: UiEventPayloads[typeof uiEvent.setGlobalLoadingRequest]
          ) => actions.setGlobalLoading(p.loading),
          storeId,
        },
        {
          eventName: uiEvent.setGlobalErrorRequest,
          handler: (p: UiEventPayloads[typeof uiEvent.setGlobalErrorRequest]) =>
            actions.setGlobalError(p.error),
          storeId,
        },
        {
          eventName: uiEvent.setFocusInputFlagRequest,
          handler: (
            p: UiEventPayloads[typeof uiEvent.setFocusInputFlagRequest]
          ) => actions.setFocusInputFlag(p.focus),
          storeId,
        },
        // openModalRequest and closeModalRequest are handled by ModalManager directly
      ];
    },
  }))
);
