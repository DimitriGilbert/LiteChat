
import React from "react";
import {
  AiModelConfig,
  AiProviderConfig,
  Message,
  DbMessage,
  CoreMessage,
  ImagePart,
  ReadonlyChatContextSnapshot,
  SidebarItemType,
  DbConversation,
  DbProject,
  DbProviderConfig,
  MessageContent,
} from "@/lib/types";

import type { InputActions } from "@/store/input.store";


export interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
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
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  dbProviderConfigs: DbProviderConfig[];
  dbConversations: DbConversation[];
  dbProjects: DbProject[];
  inputActions: Pick<InputActions, "clearAllInput">;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  stopStreamingCore: (parentMessageId?: string | null) => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  startWorkflowCore: (
    conversationId: string,
    command: string,
    getApiKey: (providerId: string) => string | undefined,
    getProvider: (id: string) => AiProviderConfig | undefined,
    getModel: (
      providerId: string,
      modelId: string,
    ) => AiModelConfig | undefined,
    dbProviderConfigs: DbProviderConfig[],
  ) => Promise<void>;
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
  getApiKeyForProvider: (providerId: string) => string | undefined;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setIsAiStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  addDbMessage: (message: DbMessage) => Promise<string | void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
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
      | "abortControllerRef"
    >,
  ) => Promise<PerformImageGenerationResult>;
  handleFormSubmit: (
    promptValue: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
}
