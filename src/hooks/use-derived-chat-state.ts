// src/hooks/use-derived-chat-state.ts
import { useMemo } from "react";
import type {
  DbConversation,
  DbProject,
  DbProviderConfig,
  DbApiKey,
  SidebarItemType,
  AiProviderConfig,
  AiModelConfig,
} from "@/lib/types";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ensureV1Path } from "@/utils/chat-utils";

interface UseDerivedChatStateProps {
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  dbConversations: DbConversation[];
  dbProjects: DbProject[]; // Needed to find parent project for VFS key inheritance
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
}

interface UseDerivedChatStateReturn {
  activeConversationData: DbConversation | null;
  activeItemData: DbConversation | DbProject | null;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

export function useDerivedChatState({
  selectedItemId,
  selectedItemType,
  dbConversations,
  dbProjects, // Destructure
  dbProviderConfigs,
  apiKeys,
  selectedProviderId,
  selectedModelId,
}: UseDerivedChatStateProps): UseDerivedChatStateReturn {
  const activeItemData = useMemo(() => {
    if (!selectedItemId || !selectedItemType) return null;
    if (selectedItemType === "conversation") {
      return dbConversations.find((c) => c.id === selectedItemId) || null;
    } else {
      return dbProjects.find((p) => p.id === selectedItemId) || null;
    }
  }, [selectedItemId, selectedItemType, dbConversations, dbProjects]);

  const activeConversationData = useMemo(() => {
    return selectedItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [selectedItemType, activeItemData]);

  const getApiKeyForProvider = useMemo(() => {
    // Memoize the function itself
    return (providerId: string): string | undefined => {
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    };
  }, [dbProviderConfigs, apiKeys]);

  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;
    // Note: Models array is empty here, as instances are created in selectedModel
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      models: [],
      allAvailableModels: config.fetchedModels || [],
    };
  }, [selectedProviderId, dbProviderConfigs]);

  const selectedModel = useMemo((): AiModelConfig | undefined => {
    if (!selectedProviderId || !selectedModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;
    const modelInfo = (config.fetchedModels ?? []).find(
      (m: { id: string }) => m.id === selectedModelId,
    );
    if (!modelInfo) return undefined;

    let modelInstance: any = null;
    const currentApiKey = getApiKeyForProvider(config.id);

    try {
      switch (config.type) {
        case "openai":
          modelInstance = createOpenAI({ apiKey: currentApiKey })(modelInfo.id);
          break;
        case "google":
          modelInstance = createGoogleGenerativeAI({ apiKey: currentApiKey })(
            modelInfo.id,
          );
          break;
        case "openrouter":
          modelInstance = createOpenRouter({ apiKey: currentApiKey })(
            modelInfo.id,
          );
          break;
        case "ollama":
          modelInstance = createOllama({
            baseURL: config.baseURL ?? undefined,
          })(modelInfo.id);
          break;
        case "openai-compatible":
          if (!config.baseURL) {
            throw new Error("Base URL required for openai-compatible");
          }
          modelInstance = createOpenAICompatible({
            baseURL: ensureV1Path(config.baseURL),
            apiKey: currentApiKey,
            name: config.name || "Custom API",
          })(modelInfo.id);
          break;
        default:
          throw new Error(`Unsupported provider type: ${config.type}`);
      }
    } catch (e) {
      console.error(
        `Failed to instantiate model ${modelInfo.id} for provider ${config.name}:`,
        e,
      );
    }

    // Determine capabilities (basic example)
    const supportsImageGen = config.type === "openai"; // Simplified
    const supportsTools = ["openai", "google", "openrouter"].includes(
      config.type,
    ); // Simplified

    return {
      id: modelInfo.id,
      name: modelInfo.name,
      instance: modelInstance,
      supportsImageGeneration: supportsImageGen,
      supportsToolCalling: supportsTools,
    };
  }, [
    selectedProviderId,
    selectedModelId,
    dbProviderConfigs,
    getApiKeyForProvider,
  ]);

  return {
    activeConversationData,
    activeItemData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider,
  };
}
