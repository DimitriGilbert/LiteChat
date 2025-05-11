// src/types/litechat/events/stores/conversation.events.ts
// FULL FILE
export const conversationStoreEvent = {
  // State Change Events
  sidebarItemsLoaded: "stores.conversation.sidebar.items.loaded",
  selectedItemChanged: "stores.conversation.selected.item.changed",
  conversationAdded: "stores.conversation.added",
  conversationUpdated: "stores.conversation.updated",
  conversationDeleted: "stores.conversation.deleted",
  conversationSyncStatusChanged: "stores.conversation.sync.status.changed",
  syncReposLoaded: "stores.conversation.sync.repos.loaded",
  syncRepoChanged: "stores.conversation.sync.repo.changed",
  syncRepoInitStatusChanged:
    "stores.conversation.sync.repo.init.status.changed",
  loadingStateChanged: "stores.conversation.loading.state.changed", // Added this event

  // Action Request Events
  loadSidebarItemsRequest: "stores.conversation.load.sidebar.items.request",
  addConversationRequest: "stores.conversation.add.conversation.request",
  updateConversationRequest: "stores.conversation.update.conversation.request",
  deleteConversationRequest: "stores.conversation.delete.conversation.request",
  selectItemRequest: "stores.conversation.select.item.request",
  importConversationRequest: "stores.conversation.import.conversation.request",
  exportConversationRequest: "stores.conversation.export.conversation.request",
  exportProjectRequest: "stores.conversation.export.project.request",
  exportAllConversationsRequest:
    "stores.conversation.export.all.conversations.request",
  loadSyncReposRequest: "stores.conversation.load.sync.repos.request",
  addSyncRepoRequest: "stores.conversation.add.sync.repo.request",
  updateSyncRepoRequest: "stores.conversation.update.sync.repo.request",
  deleteSyncRepoRequest: "stores.conversation.delete.sync.repo.request",
  linkConversationToRepoRequest:
    "stores.conversation.link.conversation.to.repo.request",
  syncConversationRequest: "stores.conversation.sync.conversation.request",
  initializeOrSyncRepoRequest:
    "stores.conversation.initialize.or.sync.repo.request",
  updateCurrentConversationToolSettingsRequest:
    "stores.conversation.update.current.conversation.tool.settings.request",
} as const;
