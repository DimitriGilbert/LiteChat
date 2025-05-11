// src/store/ui.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent, UiEventPayloads } from "@/types/litechat/events/ui.events";
import type { RegisteredActionHandler } from "@/types/litechat/control";

interface UIState {
  isChatControlPanelOpen: Record<string, boolean>; // For legacy panels like settingsModal
  isPromptControlPanelOpen: Record<string, boolean>;
  isSidebarCollapsed: boolean;
  globalLoading: boolean;
  globalError: string | null;
  focusInputOnNextRender: boolean;
  // The following are for the legacy settings modal, will be superseded by ModalManager
  initialSettingsTab: string | null;
  initialSettingsSubTab: string | null;
  // The following are for the legacy project settings modal
  isProjectSettingsModalOpen: boolean;
  projectSettingsModalTargetId: string | null;
  // The following is for the legacy VFS modal
  isVfsModalOpen: boolean;
}

interface UIActions {
  toggleChatControlPanel: (panelId: string, isOpen?: boolean) => void;
  togglePromptControlPanel: (controlId: string, isOpen?: boolean) => void;
  toggleSidebar: (isCollapsed?: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setFocusInputFlag: (focus: boolean) => void;
  // Legacy settings modal actions
  setInitialSettingsTabs: (tab: string | null, subTab?: string | null) => void;
  clearInitialSettingsTabs: () => void;
  // Legacy project settings modal actions
  openProjectSettingsModal: (projectId: string) => void;
  closeProjectSettingsModal: () => void;
  // Legacy VFS modal action
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
          // If this was the settings modal and it's closing, clear initial tabs
          if (panelId === "settingsModal" && !newOpenState) {
            state.initialSettingsTab = null;
            state.initialSettingsSubTab = null;
          }
        });
        emitter.emit(uiEvent.chatControlPanelVisibilityChanged, {
          panelId,
          isOpen: newOpenState,
        });
        // If this panelId corresponds to a modal managed by ModalManager,
        // emit the generic modal state change as well.
        // This part might need refinement based on how panelIds map to modalIds.
        if (panelId === "settingsModal" || panelId === "projectSettingsModal") {
          emitter.emit(uiEvent.modalStateChanged, {
            modalId: panelId, // Assuming panelId is the modalId
            isOpen: newOpenState,
            targetId:
              panelId === "projectSettingsModal"
                ? get().projectSettingsModalTargetId
                : undefined,
            initialTab:
              panelId === "settingsModal"
                ? get().initialSettingsTab
                : undefined,
            initialSubTab:
              panelId === "settingsModal"
                ? get().initialSettingsSubTab
                : undefined,
          });
        }
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
    },

    clearInitialSettingsTabs: () => {
      set({ initialSettingsTab: null, initialSettingsSubTab: null });
    },

    openProjectSettingsModal: (projectId) => {
      set({
        isProjectSettingsModalOpen: true,
        projectSettingsModalTargetId: projectId,
      });
      // This will be handled by ModalManager via openModalRequest
      // emitter.emit(uiEvent.modalStateChanged, {
      //   modalId: "projectSettingsModal",
      //   isOpen: true,
      //   targetId: projectId,
      // });
    },
    closeProjectSettingsModal: () => {
      set({
        isProjectSettingsModalOpen: false,
        projectSettingsModalTargetId: null,
      });
      // This will be handled by ModalManager via closeModalRequest
      // emitter.emit(uiEvent.modalStateChanged, {
      //   modalId: "projectSettingsModal",
      //   isOpen: false,
      // });
    },

    toggleVfsModal: (isOpen) => {
      const currentOpenState = get().isVfsModalOpen;
      const newOpenState = isOpen ?? !currentOpenState;

      if (currentOpenState !== newOpenState) {
        set({ isVfsModalOpen: newOpenState });
        // This will be handled by ModalManager
        // emitter.emit(uiEvent.modalStateChanged, {
        //   modalId: "core-vfs-modal-panel",
        //   isOpen: newOpenState,
        // });
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
