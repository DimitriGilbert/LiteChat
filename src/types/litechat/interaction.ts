import type { PromptTurnObject } from "./prompt"; // Input turn data snapshot
import type { Metadata } from "./common";

export type InteractionType =
  | "message.user_assistant"
  | "message.assistant_regen"
  | "message.user_edit"
  | "conversation.title_generation"
  | "tool.execution"
  | "system.info"
  | "system.error";

export type InteractionStatus =
  | "PENDING"
  | "STREAMING"
  | "COMPLETED"
  | "ERROR"
  | "CANCELLED";

// Represents one logical unit in the conversation flow
export interface Interaction {
  id: string;
  conversationId: string;
  type: InteractionType;
  index: number;
  parentId: string | null; // ID of the interaction this follows/revises
  prompt: Readonly<PromptTurnObject> | null; // Snapshot of the user input turn data
  response: any | null; // Result content
  status: InteractionStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  metadata: Metadata; // Tokens, timings, model, feedback, control data, errors
}
