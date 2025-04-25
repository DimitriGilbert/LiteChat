import type React from 'react';
import type { Interaction } from './interaction';
import type { DbBase } from './common';
import type { PromptObject } from './prompt'; // Final AI payload type

// Represents a conversation thread in the DB
export interface Conversation extends DbBase {
  title: string;
  metadata?: Record<string, any>;
}

// --- Chat Control ---
export type ChatControlStatus = 'loading' | 'ready' | 'error';
type AIPayload = PromptObject;
type AIResponse = Interaction['response'];
export interface ChatControl {
  id: string;
  status: () => ChatControlStatus;
  renderer?: () => React.ReactElement | null;
  panel?: string;
  show?: () => boolean;
  settingsConfig?: { tabId: string; title: string; icon?: React.ReactElement; order?: number; };
  settingsRenderer?: () => React.ReactElement | null;
  onSettingSubmit?: (settingsData: any) => void | Promise<void>;
  aiInteractionMiddleware?: { // Less common, but possible
    before?: (payload: AIPayload) => AIPayload | Promise<AIPayload> | false;
    after?: (response: AIResponse) => AIResponse | Promise<AIResponse> | false;
  };
  order?: number;
}

// --- Chat Canvas ---
export interface ChatCanvasProps {
  conversationId: string | null;
  interactions: Interaction[];
  interactionRenderer: (interaction: Interaction, allInteractions: Interaction[]) => React.ReactElement | null;
  streamingInteractionsRenderer?: (streamingIds: string[]) => React.ReactElement | null;
  status: 'idle' | 'loading' | 'streaming' | 'error';
  className?: string;
  onRegenerateInteraction?: (interactionId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
}
