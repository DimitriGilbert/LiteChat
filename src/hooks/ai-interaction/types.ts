// src/hooks/ai-interaction/types.ts
import React from "react";
import {
  AiModelConfig,
  AiProviderConfig,
  Message,
  DbMessage,
  CoreMessage,
  ImagePart,
  ReadonlyChatContextSnapshot,
} from "@/lib/types";

// --- Interface Definitions ---
export interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: () => string | undefined;
  /** Refresh rate for UI updates during AI response streaming (in milliseconds). */
  streamingRefreshRateMs: number;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setIsAiStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  // abortControllerRef removed from props
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
}

export interface PerformAiStreamParams {
  conversationIdToUse: string;
  messagesToSend: CoreMessage[];
  currentTemperature: number;
  currentMaxTokens: number | null;
  currentTopP: number | null;
  currentTopK: number | null;
  currentPresencePenalty: number | null;
  currentFrequencyPenalty: number | null;
  systemPromptToUse: string | null;
}

export interface PerformImageGenerationParams {
  conversationIdToUse: string;
  prompt: string;
  n?: number;
  size?: string;
  aspectRatio?: string;
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: () => string | undefined;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setIsAiStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  addDbMessage: (message: DbMessage) => Promise<string | void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>; // Keep for image gen
}

export interface PerformImageGenerationResult {
  images?: ImagePart[];
  error?: string;
  warnings?: any[];
}

export interface UseAiInteractionReturn {
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
  performImageGeneration: (
    params: Omit<
      PerformImageGenerationParams,
      | "selectedModel"
      | "selectedProvider"
      | "getApiKeyForProvider"
      | "addMessage"
      | "updateMessage"
      | "setIsAiStreaming"
      | "setError"
      | "addDbMessage"
      | "abortControllerRef" // Removed from Omit
    >,
  ) => Promise<PerformImageGenerationResult>;
}
