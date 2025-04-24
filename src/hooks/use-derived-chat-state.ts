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
import { DEFAULT_MODELS } from "@/lib/litechat";
import { createAiModelConfig } from "@/utils/chat-utils";

interface UseDerivedChatStateProps {
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  dbConversations: DbConversation[];
  dbProjects: DbProject[];
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
  dbProjects,
  dbProviderConfigs,
  apiKeys,
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
  const getApiKeyForProvider = useMemo(() => {
    return (providerId: string): string | undefined => {
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    };
  }, [dbProviderConfigs, apiKeys]);

  // Selected Provider derivation uses passed props
  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;
    const allAvailable =
      config.fetchedModels && config.fetchedModels.length > 0
        ? config.fetchedModels
        : DEFAULT_MODELS[config.type] || [];
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      models: [],
      allAvailableModels: allAvailable,
    };
  }, [selectedProviderId, dbProviderConfigs]);

  // Selected Model derivation uses passed props and local getter
  const selectedModel = useMemo((): AiModelConfig | undefined => {
    if (!selectedProviderId || !selectedModelId) return undefined;
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;

    const currentApiKey = getApiKeyForProvider(config.id);

    // Use the utility function to create the AiModelConfig
    return createAiModelConfig(config, selectedModelId, currentApiKey);
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
