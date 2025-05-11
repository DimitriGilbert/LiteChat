// src/types/litechat/events/ui.events.ts
// FULL FILE
export const uiEvent = {
  // State Change Events (emitted by UIStore or ModalManager)
  sidebarVisibilityChanged: "stores.ui.sidebar.visibility.changed",
  chatControlPanelVisibilityChanged:
    "stores.ui.chat.control.panel.visibility.changed",
  promptControlPanelVisibilityChanged:
    "stores.ui.prompt.control.panel.visibility.changed",
  globalLoadingChanged: "stores.ui.global.loading.changed",
  globalErrorChanged: "stores.ui.global.error.changed",
  focusInputFlagChanged: "stores.ui.focus.input.flag.changed",
  modalStateChanged: "stores.ui.modal.state.changed", // Generic for any modal

  // Action Request Events (to be handled by UIStore or ModalManager via Coordinator)
  toggleSidebarRequest: "stores.ui.toggle.sidebar.request",
  toggleChatControlPanelRequest: "stores.ui.toggle.chat.control.panel.request",
  togglePromptControlPanelRequest:
    "stores.ui.toggle.prompt.control.panel.request",
  setGlobalLoadingRequest: "stores.ui.set.global.loading.request",
  setGlobalErrorRequest: "stores.ui.set.global.error.request",
  setFocusInputFlagRequest: "stores.ui.set.focus.input.flag.request",
  openModalRequest: "stores.ui.modal.open.request", // Generic open
  closeModalRequest: "stores.ui.modal.close.request", // Generic close

  // Original events (can be re-emitted if needed)
  contextChanged: "ui.contextChanged", // Will be replaced by conversationStoreEvent.selectedItemChanged
  openSettingsModalRequest: "ui.openSettingsModalRequest", // Will be replaced by generic modal open
} as const;
