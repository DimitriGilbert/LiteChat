// src/types/litechat/events/interaction.events.ts
// FULL FILE
import type { InteractionState } from "@/store/interaction.store";
import type { Interaction } from "@/types/litechat/interaction";
import type { ToolCallPart, ToolResultPart } from "ai";

export const interactionEvent = {
  // State Change Events
  loaded: "interaction.loaded",
  currentConversationIdChanged: "interaction.current.conversation.id.changed",
  added: "interaction.added",
  updated: "interaction.updated",
  streamingIdsChanged: "interaction.streaming.ids.changed",
  activeStreamBuffersChanged: "interaction.active.stream.buffers.changed",
  activeReasoningBuffersChanged: "interaction.active.reasoning.buffers.changed",
  statusChanged: "interaction.status.changed",
  errorChanged: "interaction.error.changed",
  interactionRated: "interaction.rated",

  // Original AI SDK related events
  started: "interaction.sdk.started",
  streamChunk: "interaction.sdk.streamChunk",
  completed: "interaction.sdk.completed",

  // Action Request Events
  loadInteractionsRequest: "interaction.load.interactions.request",
  rateInteractionRequest: "interaction.rate.interaction.request",
  setCurrentConversationIdRequest:
    "interaction.set.current.conversation.id.request",
  clearInteractionsRequest: "interaction.clear.interactions.request",
  setErrorRequest: "interaction.set.error.request",
  setStatusRequest: "interaction.set.status.request",
} as const;

export interface InteractionEventPayloads {
  [interactionEvent.loaded]: {
    conversationId: string;
    interactions: Interaction[];
  };
  [interactionEvent.currentConversationIdChanged]: {
    conversationId: string | null;
  };
  [interactionEvent.added]: { interaction: Interaction };
  [interactionEvent.updated]: {
    interactionId: string;
    updates: Partial<Interaction>;
  };
  [interactionEvent.streamingIdsChanged]: { streamingIds: string[] };
  [interactionEvent.activeStreamBuffersChanged]: {
    buffers: Record<string, string>;
  };
  [interactionEvent.activeReasoningBuffersChanged]: {
    buffers: Record<string, string>;
  };
  [interactionEvent.statusChanged]: { status: InteractionState["status"] };
  [interactionEvent.errorChanged]: { error: string | null };
  [interactionEvent.interactionRated]: {
    interactionId: string;
    rating: number | null;
  };
  [interactionEvent.started]: {
    interactionId: string;
    conversationId: string;
    type: string;
  };
  [interactionEvent.streamChunk]: { interactionId: string; chunk: string };
  [interactionEvent.completed]: {
    interactionId: string;
    status: Interaction["status"];
    error?: string;
    toolCalls?: ToolCallPart[];
    toolResults?: ToolResultPart[];
  };
  [interactionEvent.loadInteractionsRequest]: { conversationId: string };
  [interactionEvent.rateInteractionRequest]: {
    interactionId: string;
    rating: number | null;
  };
  [interactionEvent.setCurrentConversationIdRequest]: { id: string | null };
  [interactionEvent.clearInteractionsRequest]: undefined;
  [interactionEvent.setErrorRequest]: { error: string | null };
  [interactionEvent.setStatusRequest]: { status: InteractionState["status"] };
}
