// src/hooks/ai-interaction/types.ts
import React from "react";
// Use the aliased/re-exported CoreMessage from our types
import {
  AiModelConfig,
  AiProviderConfig,
  Message,
  DbMessage,
  CoreMessage, // Use the type defined in src/lib/types.ts (already updated)
  ImagePart, // Import ImagePart for return type
  ChatContextProps, // Import ChatContextProps
} from "@/lib/types";

// --- Interface Definitions ---
export interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined; // Runtime provider config
  getApiKeyForProvider: () => string | undefined; // Modified signature: gets key for *selected* provider
  streamingThrottleRate: number;
  // Core state/setters passed directly
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  // FIX: Type matches Zustand setter
  setIsAiStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  // DB function passed directly
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  // Abort controller ref passed directly
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  // Function to get context snapshot for tool execution
  getContextSnapshotForMod: () => Readonly<
    Pick<
      ChatContextProps, // Use imported ChatContextProps
      | "selectedItemId"
      | "selectedItemType"
      | "messages"
      | "isStreaming"
      | "selectedProviderId"
      | "selectedModelId"
      | "activeSystemPrompt"
      | "temperature"
      | "maxTokens"
      | "theme"
      | "isVfsEnabledForItem"
      | "getApiKeyForProvider"
    >
  >;
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
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>; // Keep React setter type for internal use? No, use store setter.
  // FIX: Change type to match Zustand setter
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
