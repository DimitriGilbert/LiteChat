// src/hooks/ai-interaction/types.ts
import React from "react";
// Use the aliased/re-exported CoreMessage from our types
import {
  AiModelConfig,
  AiProviderConfig,
  Message,
  DbMessage,
  CoreMessage, // Use the type defined in src/lib/types.ts
} from "@/lib/types";

// --- Interface Definitions ---
export interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined; // Runtime provider config
  getApiKeyForProvider: () => string | undefined; // Modified signature: gets key for *selected* provider
  streamingThrottleRate: number;
  // Core state/setters passed directly
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (error: string | null) => void;
  // DB function passed directly
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  // Abort controller ref passed directly
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export interface PerformAiStreamParams {
  conversationIdToUse: string;
  messagesToSend: CoreMessage[]; // Use CoreMessage from types.ts
  currentTemperature: number;
  currentMaxTokens: number | null;
  currentTopP: number | null;
  currentTopK: number | null;
  currentPresencePenalty: number | null;
  currentFrequencyPenalty: number | null;
  systemPromptToUse: string | null;
}

export interface UseAiInteractionReturn {
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
}
