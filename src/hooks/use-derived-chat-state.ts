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
  DbProviderType, // Added
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
  dbProjects: DbProject[];
  dbProviderConfigs: DbProviderConfig[]; // Now passed directly
  apiKeys: DbApiKey[]; // Now passed directly
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

// Helper to get default models (copied from provider store)
const getDefaultModels = (
  type: DbProviderType,
): { id: string; name: string }[] => {
  const defaults: Record<DbProviderType, { id: string; name: string }[]> = {
    openai: [{ id: "gpt-4o", name: "GPT-4o" }],
    google: [
      { id: "gemini-2.5-pro-exp-03-25", name: "Gemini 2.5 Pro exp (Free)" },
      {
        id: "gemini-2.0-flash-thinking-exp-01-21",
        name: "Gemini 2.0 Flash exp (Free)",
      },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "emini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro Preview" },
      {
        id: "gemini-2.5-flash-preview-04-17",
        name: "Gemini 2.5 Flash Preview",
      },
    ],
    openrouter: [],
    ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }],
    "openai-compatible": [],
  };
  return defaults[type] || [];
};

export function useDerivedChatState({
  selectedItemId,
  selectedItemType,
  dbConversations,
  dbProjects,
  dbProviderConfigs, // Use passed prop
  apiKeys, // Use passed prop
  selectedProviderId,
  selectedModelId,
}: UseDerivedChatStateProps): UseDerivedChatStateReturn {
  // Derivations for active item remain the same
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

  // API Key getter uses passed props
  const getApiKeyForProvider = useMemo(() => {
    return (providerId: string): string | undefined => {
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    };
  }, [dbProviderConfigs, apiKeys]); // Depend on passed props

  // Selected Provider derivation uses passed props
  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;
    const allAvailable =
      config.fetchedModels && config.fetchedModels.length > 0
        ? config.fetchedModels
        : getDefaultModels(config.type);
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      models: [], // Instances created in selectedModel
      allAvailableModels: allAvailable,
    };
  }, [selectedProviderId, dbProviderConfigs]); // Depend on passed props

  // Selected Model derivation uses passed props and local getter
  const selectedModel = useMemo((): AiModelConfig | undefined => {
    if (!selectedProviderId || !selectedModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;

    const allAvailable =
      config.fetchedModels && config.fetchedModels.length > 0
        ? config.fetchedModels
        : getDefaultModels(config.type);

    const modelInfo = allAvailable.find((m) => m.id === selectedModelId);
    if (!modelInfo) return undefined;

    let modelInstance: any = null;
    const currentApiKey = getApiKeyForProvider(config.id); // Use local getter

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

    const supportsImageGen = config.type === "openai";
    const supportsTools = ["openai", "google", "openrouter"].includes(
      config.type,
    );

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
    dbProviderConfigs, // Depend on passed prop
    getApiKeyForProvider, // Depend on local getter
  ]);

  return {
    activeConversationData,
    activeItemData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider, // Return the local getter
  };
}
