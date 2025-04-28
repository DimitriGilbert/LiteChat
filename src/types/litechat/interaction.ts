// src/types/litechat/interaction.ts
import type { PromptTurnObject } from "./prompt"; // Input turn data snapshot
import type { Metadata } from "./common";
// Remove direct import of ToolCallPart/ToolResultPart from here

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
  | "WARNING"
  | "CANCELLED";

// Represents one logical unit in the conversation flow
export interface Interaction {
  id: string;
  conversationId: string;
  type: InteractionType;
  index: number;
  parentId: string | null; // ID of the interaction this follows/revises
  prompt: Readonly<PromptTurnObject> | null; // Snapshot of the user input turn data
  response: any | null; // Result content (usually string, but could be other for non-assistant)
  status: InteractionStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  metadata: Metadata & {
    // Add specific metadata fields
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    modelId?: string; // Combined ID
    providerId?: string;
    error?: string;
    regeneratedFromId?: string;
    // Store tool calls/results as JSON strings
    toolCalls?: string[]; // Array of JSON strings representing ToolCallPart
    toolResults?: string[]; // Array of JSON strings representing ToolResultPart
    // Basic file info (no content) for display/reference
    attachedFiles?: {
      id: string;
      source: "direct" | "vfs";
      name: string;
      type: string;
      size: number;
      path?: string;
    }[];
  };
}
