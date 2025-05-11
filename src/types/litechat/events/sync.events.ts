// src/types/litechat/events/stores/sync.events.ts
// This file might be merged into conversation.events.ts if sync is tightly coupled,
// but for now, keeping it separate as per the plan.
// If it's purely for SyncRepo CRUD and init status, it's fine.
// Conversation-specific sync status is in conversation.events.ts.
export const syncStoreEvent = {
  // Renamed from syncEvent to syncStoreEvent
  // State Change Events
  repoChanged: "stores.sync.repo.changed", // For SyncRepo CRUD
  repoInitStatusChanged: "stores.sync.repo.init.status.changed", // For a specific repo's clone/pull status

  // Action Request Events (if SyncStore were to manage these directly)
  // For now, these are part of ConversationStore's domain.
  // loadSyncReposRequest: "stores.sync.load.repos.request",
  // addSyncRepoRequest: "stores.sync.add.repo.request",
  // updateSyncRepoRequest: "stores.sync.update.repo.request",
  // deleteSyncRepoRequest: "stores.sync.delete.repo.request",
  // initializeOrSyncRepoRequest: "stores.sync.initialize.or.sync.repo.request",
} as const;
