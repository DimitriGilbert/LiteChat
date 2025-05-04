// src/types/litechat/chat.ts
import type React from "react";
import type { Interaction } from "./interaction";
import type { DbBase } from "./common";
import type { PromptObject } from "./prompt";

// Conversation and SidebarItemType remain the same
export interface Conversation extends DbBase {
  title: string;
  projectId: string | null;
  metadata?: Record<string, any> & {
    // Add specific metadata fields here
    enabledTools?: string[];
    toolMaxStepsOverride?: number | null;
  };
  syncRepoId?: string | null;
  lastSyncedAt?: Date | null;
}
// Updated SidebarItemType
export type SidebarItemType = "conversation" | "project";

// ChatControl remains the same
export type ChatControlStatus = "loading" | "ready" | "error";
type AIPayload = PromptObject;
type AIResponse = Interaction["response"];
export interface ChatControl {
  id: string;
  status: () => ChatControlStatus;
  renderer?: () => React.ReactElement | null;
  iconRenderer?: () => React.ReactElement | null;
  panel?: string;
  show?: () => boolean;
  settingsConfig?: {
    tabId: string;
    title: string;
    icon?: React.ReactElement;
    order?: number; // Keep order for settings tabs specifically
  };
  settingsRenderer?: () => React.ReactElement | null;
  onSettingSubmit?: (settingsData: any) => void | Promise<void>;
  aiInteractionMiddleware?: {
    before?: (payload: AIPayload) => AIPayload | Promise<AIPayload> | false;
    after?: (response: AIResponse) => AIResponse | Promise<AIResponse> | false;
  };
  // order removed - determined by registration sequence
}

// --- Chat Canvas ---
export interface ChatCanvasProps {
  conversationId: string | null;
  interactions: Interaction[];
  interactionRenderer?: (
    interaction: Interaction,
    allInteractions: Interaction[],
  ) => React.ReactElement | null;
  status: "idle" | "loading" | "streaming" | "error";
  className?: string;
  onRegenerateInteraction?: (interactionId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
  onStopInteraction?: (interactionId: string) => void;
}
