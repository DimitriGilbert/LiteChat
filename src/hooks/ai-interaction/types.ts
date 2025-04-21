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
  streamingThrottleRate: number;
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsAiStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  // DB function passed directly
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // Function to bulk add messages to DB
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
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

// New interface for image generation parameters
export interface PerformImageGenerationParams {
  conversationIdToUse: string;
  prompt: string;
  n?: number;
  size?: string;
  aspectRatio?: string;
  // Add fields passed from useAiInteraction
  selectedModel: AiModelConfig | undefined; // Pass the model object
  selectedProvider: AiProviderConfig | undefined; // Pass the provider object
  getApiKeyForProvider: () => string | undefined;
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  // FIX: Ensure type matches Zustand setter signature
  setIsAiStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  addDbMessage: (message: DbMessage) => Promise<string | void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// New interface for image generation return value
export interface PerformImageGenerationResult {
  images?: ImagePart[]; // Return an array of ImagePart containing base64 data
  error?: string;
  warnings?: any[]; // Include warnings if provided by the SDK
}

export interface UseAiInteractionReturn {
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
  performImageGeneration: (
    params: Omit<
      PerformImageGenerationParams,
      | "selectedModel"
      | "selectedProvider"
      | "getApiKeyForProvider"
      | "setLocalMessages"
      | "setIsAiStreaming"
      | "setError"
      | "addDbMessage"
      | "abortControllerRef"
    >, // Omit props passed internally by the hook
  ) => Promise<PerformImageGenerationResult>;
}
