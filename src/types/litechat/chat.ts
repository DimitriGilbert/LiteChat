// src/types/litechat/chat.ts
import type React from "react";
import type { Interaction } from "./interaction";
import type { DbBase } from "./common";
import type { PromptObject } from "./prompt";

// Conversation and SidebarItemType remain the same
export interface Conversation extends DbBase {
  title: string;
  metadata?: Record<string, any>;
  syncRepoId?: string | null; // ID of the SyncRepo this convo is linked to
  lastSyncedAt?: Date | null; // Timestamp of the last successful sync
}
export type SidebarItemType = "conversation" | "project" | "folder";

// ChatControl remains the same
export type ChatControlStatus = "loading" | "ready" | "error";
type AIPayload = PromptObject;
type AIResponse = Interaction["response"];
export interface ChatControl {
  id: string;
  status: () => ChatControlStatus;
  renderer?: () => React.ReactElement | null;
  iconRenderer?: () => React.ReactElement | null; // Added icon renderer
  panel?: string;
  show?: () => boolean;
  settingsConfig?: {
    tabId: string;
    title: string;
    icon?: React.ReactElement;
    order?: number;
  };
  settingsRenderer?: () => React.ReactElement | null;
  onSettingSubmit?: (settingsData: any) => void | Promise<void>;
  aiInteractionMiddleware?: {
    before?: (payload: AIPayload) => AIPayload | Promise<AIPayload> | false;
    after?: (response: AIResponse) => AIResponse | Promise<AIResponse> | false;
  };
  order?: number;
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
  onStopInteraction?: (interactionId: string) => void; // Add this prop
}
