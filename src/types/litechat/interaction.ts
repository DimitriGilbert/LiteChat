// src/types/litechat/interaction.ts
// FULL FILE
import type { PromptTurnObject } from "./prompt";
import type { Metadata } from "./common";

export type InteractionType =
  | "message.user_assistant"
  | "message.assistant_regen"
  | "message.user_edit"
  | "conversation.title_generation" // Added new type
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
  index: number; // Title generation might have index -1 or similar? Or just not be displayed.
  parentId: string | null;
  prompt: Readonly<PromptTurnObject> | null; // Title generation might have a simplified prompt
  response: any | null; // Title generation response is the title string
  status: InteractionStatus;
  startedAt: Date | null;
  endedAt: Date | null;
  metadata: Metadata & {
    // Add specific metadata fields
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    modelId?: string;
    providerId?: string;
    error?: string;
    regeneratedFromId?: string;
    // Store tool calls/results as JSON strings
    toolCalls?: string[];
    toolResults?: string[];
    // Basic file info (no content) for display/reference
    attachedFiles?: {
      id: string;
      source: "direct" | "vfs";
      name: string;
      type: string;
      size: number;
      path?: string;
    }[];
    // Add reasoning field
    reasoning?: string;
    // Store raw provider metadata if needed
    providerMetadata?: Record<string, any>;
    // Add timing metadata
    timeToFirstToken?: number; // Milliseconds
    generationTime?: number; // Milliseconds
    // Flag for title generation interaction
    isTitleGeneration?: boolean;
  };
}
