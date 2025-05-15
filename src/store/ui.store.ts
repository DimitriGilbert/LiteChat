// src/store/ui.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent, UiEventPayloads } from "@/types/litechat/events/ui.events";
import type { RegisteredActionHandler } from "@/types/litechat/control";
import type { SidebarItemType } from "@/types/litechat/chat";

interface UIState {
  isChatControlPanelOpen: Record<string, boolean>;
  isPromptControlPanelOpen: Record<string, boolean>;
  isSidebarCollapsed: boolean;
  globalLoading: boolean;
  globalError: string | null;
  focusInputOnNextRender: boolean;
  // Removed modal-specific state:
  // initialSettingsTab, initialSettingsSubTab,
  // isProjectSettingsModalOpen, projectSettingsModalTargetId,
  // isVfsModalOpen
}

interface UIActions {
  toggleChatControlPanel: (panelId: string, isOpen?: boolean) => void;
  togglePromptControlPanel: (controlId: string, isOpen?: boolean) => void;
  toggleSidebar: (isCollapsed?: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setFocusInputFlag: (focus: boolean) => void;
  // Removed modal-specific actions:
  // setInitialSettingsTabs, clearInitialSettingsTabs,
  // openProjectSettingsModal, closeProjectSettingsModal,
  // toggleVfsModal
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

    // Actions
    toggleChatControlPanel: (panelId, isOpen) => {
      const currentOpenState = get().isChatControlPanelOpen[panelId] ?? false;
      const newOpenState = isOpen ?? !currentOpenState;

      if (currentOpenState !== newOpenState) {
        set((state) => {
          state.isChatControlPanelOpen[panelId] = newOpenState;
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
        // and should not be registered here as store actions.
      ];
    },
  }))
);
