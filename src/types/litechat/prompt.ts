// src/types/litechat/prompt.ts
import type React from "react";
import type { CoreMessage, ToolDefinition } from "ai"; // Import ToolDefinition

// Represents the data collected from the user input turn by PromptWrapper
export interface PromptTurnObject {
  id: string; // Unique ID for this input turn data
  content: string | object; // Content from the InputArea (object for potential multi-modal)
  parameters: Record<string, any>; // AI parameters from controls
  metadata: Record<string, any>; // Other data (selected model/provider, file refs, etc.)
}

// Represents the final data structure passed to the AI Service (aligned with AI SDK)
export interface PromptObject {
  system: string | null;
  messages: CoreMessage[]; // Constructed history + current user message
  tools?: ToolDefinition[]; // Use SDK type for tool definitions
  toolChoice?: "auto" | "none" | { type: "tool"; name: string }; // Example based on common patterns
  parameters: Record<string, any>; // Final AI params
  metadata: Record<string, any>; // Final metadata
}

// --- Input Area ---
export interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}
export interface InputAreaRenderer {
  (props: InputAreaProps): React.ReactElement;
}

// --- Prompt Control ---
export type PromptControlStatus = "loading" | "ready" | "error";
export interface PromptControl {
  id: string;
  status: () => PromptControlStatus;
  trigger?: () => React.ReactElement | null;
  renderer?: () => React.ReactElement | null;
  show?: () => boolean;
  // Returns data for the *current turn* to be merged into PromptTurnObject
  getParameters?: () =>
    | Record<string, any>
    | null
    | Promise<Record<string, any> | null>;
  getMetadata?: () =>
    | Record<string, any>
    | null
    | Promise<Record<string, any> | null>;
  // Middleware modifies the PromptTurnObject before it's finalized by PromptWrapper
  middleware?: (
    turnData: PromptTurnObject,
  ) => PromptTurnObject | Promise<PromptTurnObject>;
  onClick?: () => void;
  order?: number;
  clearOnSubmit?: () => void;
}
