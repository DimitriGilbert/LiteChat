// src/types/litechat/events/conversation.events.ts
// FULL FILE
import type { Conversation, SidebarItemType } from "@/types/litechat/chat";
import type { SyncRepo, SyncStatus } from "@/types/litechat/sync";

export const conversationEvent = {
  // State Change Events
  conversationsLoaded: "conversation.conversations.loaded", // Renamed from sidebarItemsLoaded
  selectedItemChanged: "conversation.selected.item.changed",
  conversationAdded: "conversation.added",
  conversationUpdated: "conversation.updated",
  conversationDeleted: "conversation.deleted",
  conversationsCleared: "conversation.conversations.cleared",
  conversationSyncStatusChanged: "conversation.sync.status.changed",
  syncReposLoaded: "conversation.sync.repos.loaded",
  syncRepoChanged: "conversation.sync.repo.changed",
  syncRepoInitStatusChanged: "conversation.sync.repo.init.status.changed",
  loadingStateChanged: "conversation.loading.state.changed",

  // Action Request Events
  loadConversationsRequest: "conversation.load.conversations.request", // Renamed
  addConversationRequest: "conversation.add.conversation.request",
  updateConversationRequest: "conversation.update.conversation.request",
  deleteConversationRequest: "conversation.delete.conversation.request",
  selectItemRequest: "conversation.select.item.request",
  importConversationRequest: "conversation.import.conversation.request",
  exportConversationRequest: "conversation.export.conversation.request",
  exportProjectRequest: "conversation.export.project.request",
  exportAllConversationsRequest:
    "conversation.export.all.conversations.request",
  loadSyncReposRequest: "conversation.load.sync.repos.request",
  addSyncRepoRequest: "conversation.add.sync.repo.request",
  updateSyncRepoRequest: "conversation.update.sync.repo.request",
  deleteSyncRepoRequest: "conversation.delete.sync.repo.request",
  linkConversationToRepoRequest:
    "conversation.link.conversation.to.repo.request",
  syncConversationRequest: "conversation.sync.conversation.request",
  initializeOrSyncRepoRequest: "conversation.initialize.or.sync.repo.request",
  updateCurrentConversationToolSettingsRequest:
    "conversation.update.current.conversation.tool.settings.request",
} as const;

export interface ConversationEventPayloads {
  [conversationEvent.conversationsLoaded]: {
    conversations: Conversation[];
  };
  [conversationEvent.selectedItemChanged]: {
    itemId: string | null;
    itemType: SidebarItemType | null;
  };
  [conversationEvent.conversationAdded]: { conversation: Conversation };
  [conversationEvent.conversationUpdated]: {
    conversationId: string;
    updates: Partial<Conversation>;
  };
  [conversationEvent.conversationDeleted]: { conversationId: string };
  [conversationEvent.conversationsCleared]: undefined;
  [conversationEvent.conversationSyncStatusChanged]: {
    conversationId: string;
    status: SyncStatus;
  };
  [conversationEvent.syncReposLoaded]: { repos: SyncRepo[] };
  [conversationEvent.syncRepoChanged]: {
    repoId: string;
    action: "added" | "updated" | "deleted";
  };
  [conversationEvent.syncRepoInitStatusChanged]: {
    repoId: string;
    status: SyncStatus;
  };
  [conversationEvent.loadingStateChanged]: {
    isLoading: boolean;
    error: string | null;
  };
  [conversationEvent.loadConversationsRequest]: undefined;
  [conversationEvent.addConversationRequest]: Partial<
    Omit<Conversation, "id" | "createdAt">
  > & { title: string; projectId?: string | null };
  [conversationEvent.updateConversationRequest]: {
    id: string;
    updates: Partial<Omit<Conversation, "id" | "createdAt">>;
  };
  [conversationEvent.deleteConversationRequest]: { id: string };
  [conversationEvent.selectItemRequest]: {
    id: string | null;
    type: SidebarItemType | null;
  };
  [conversationEvent.importConversationRequest]: { file: File };
  [conversationEvent.exportConversationRequest]: {
    conversationId: string;
    format: "json" | "md";
  };
  [conversationEvent.exportProjectRequest]: { projectId: string };
  [conversationEvent.exportAllConversationsRequest]: undefined;
  [conversationEvent.loadSyncReposRequest]: undefined;
  [conversationEvent.addSyncRepoRequest]: Omit<
    SyncRepo,
    "id" | "createdAt" | "updatedAt"
  >;
  [conversationEvent.updateSyncRepoRequest]: {
    id: string;
    updates: Partial<Omit<SyncRepo, "id" | "createdAt">>;
  };
  [conversationEvent.deleteSyncRepoRequest]: { id: string };
  [conversationEvent.linkConversationToRepoRequest]: {
    conversationId: string;
    repoId: string | null;
  };
  [conversationEvent.syncConversationRequest]: { conversationId: string };
  [conversationEvent.initializeOrSyncRepoRequest]: { repoId: string };
  [conversationEvent.updateCurrentConversationToolSettingsRequest]: {
    enabledTools?: string[];
    toolMaxStepsOverride?: number | null;
  };
}
