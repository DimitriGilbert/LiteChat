// src/types/litechat/events/ui.events.ts
// FULL FILE
import type { SidebarItemType } from "@/types/litechat/chat";

export const uiEvent = {
  // State Change Events
  sidebarVisibilityChanged: "ui.sidebar.visibility.changed",
  chatControlPanelVisibilityChanged: "ui.chat.control.panel.visibility.changed",
  promptControlPanelVisibilityChanged:
    "ui.prompt.control.panel.visibility.changed",
  globalLoadingChanged: "ui.global.loading.changed",
  globalErrorChanged: "ui.global.error.changed",
  focusInputFlagChanged: "ui.focus.input.flag.changed",
  modalStateChanged: "ui.modal.state.changed",

  // Action Request Events
  toggleSidebarRequest: "ui.toggle.sidebar.request",
  toggleChatControlPanelRequest: "ui.toggle.chat.control.panel.request",
  togglePromptControlPanelRequest: "ui.toggle.prompt.control.panel.request",
  setGlobalLoadingRequest: "ui.set.global.loading.request",
  setGlobalErrorRequest: "ui.set.global.error.request",
  setFocusInputFlagRequest: "ui.set.focus.input.flag.request",
  openModalRequest: "ui.modal.open.request",
  closeModalRequest: "ui.modal.close.request",

  // Legacy events (to be phased out or re-mapped)
  contextChanged: "ui.legacy.contextChanged",
  openSettingsModalRequest: "ui.legacy.openSettingsModalRequest",
} as const;

export interface UiEventPayloads {
  [uiEvent.sidebarVisibilityChanged]: { isCollapsed: boolean };
  [uiEvent.chatControlPanelVisibilityChanged]: {
    panelId: string;
    isOpen: boolean;
  };
  [uiEvent.promptControlPanelVisibilityChanged]: {
    controlId: string;
    isOpen: boolean;
  };
  [uiEvent.globalLoadingChanged]: { loading: boolean };
  [uiEvent.globalErrorChanged]: { error: string | null };
  [uiEvent.focusInputFlagChanged]: { focus: boolean };
  [uiEvent.modalStateChanged]: {
    modalId: string;
    isOpen: boolean;
    targetId?: string | null;
    initialTab?: string | null;
    initialSubTab?: string | null;
    modalProps?: any;
  };
  [uiEvent.toggleSidebarRequest]: { isCollapsed?: boolean } | undefined;
  [uiEvent.toggleChatControlPanelRequest]: {
    panelId: string;
    isOpen?: boolean;
  };
  [uiEvent.togglePromptControlPanelRequest]: {
    controlId: string;
    isOpen?: boolean;
  };
  [uiEvent.setGlobalLoadingRequest]: { loading: boolean };
  [uiEvent.setGlobalErrorRequest]: { error: string | null };
  [uiEvent.setFocusInputFlagRequest]: { focus: boolean };
  [uiEvent.openModalRequest]: {
    modalId: string;
    targetId?: string | null;
    initialTab?: string | null;
    initialSubTab?: string | null;
    modalProps?: any;
  };
  [uiEvent.closeModalRequest]: { modalId: string };

  // Legacy
  [uiEvent.contextChanged]: {
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
  };
  [uiEvent.openSettingsModalRequest]: { tabId: string; subTabId?: string };
}
