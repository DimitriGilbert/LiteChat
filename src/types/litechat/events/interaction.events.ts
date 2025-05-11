// src/types/litechat/events/stores/interaction.events.ts
// NEW FILE
export const interactionStoreEvent = {
  // State Change Events
  loaded: "stores.interaction.loaded", // For when interactions for a conversation are loaded
  currentConversationIdChanged:
    "stores.interaction.current.conversation.id.changed",
  added: "stores.interaction.added", // When a new interaction (placeholder or full) is added
  updated: "stores.interaction.updated", // For any partial update to an interaction
  streamingIdsChanged: "stores.interaction.streaming.ids.changed",
  activeStreamBuffersChanged:
    "stores.interaction.active.stream.buffers.changed",
  activeReasoningBuffersChanged:
    "stores.interaction.active.reasoning.buffers.changed",
  statusChanged: "stores.interaction.status.changed", // e.g., idle, loading, streaming, error
  errorChanged: "stores.interaction.error.changed",
  interactionRated: "stores.interaction.rated", // After a rating is successfully saved

  // Original AI SDK related events (can be re-emitted by InteractionService if needed by mods)
  started: "interaction.started", // From original plan, might be useful
  streamChunk: "interaction.streamChunk", // From original plan
  completed: "interaction.completed", // From original plan

  // Action Request Events
  loadInteractionsRequest: "stores.interaction.load.interactions.request",
  rateInteractionRequest: "stores.interaction.rate.interaction.request",
  setCurrentConversationIdRequest:
    "stores.interaction.set.current.conversation.id.request",
  clearInteractionsRequest: "stores.interaction.clear.interactions.request",
  setErrorRequest: "stores.interaction.set.error.request",
  setStatusRequest: "stores.interaction.set.status.request",
} as const;
