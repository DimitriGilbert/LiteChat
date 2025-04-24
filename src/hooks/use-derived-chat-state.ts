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
  // --- Active Item Derivation ---
  const activeItemData = useMemo(() => {
    if (!selectedItemId || !selectedItemType) return null;
    if (selectedItemType === "conversation") {
      return dbConversations.find((c) => c.id === selectedItemId) || null;
    } else {
      // Assumes selectedItemType === 'project'
      return dbProjects.find((p) => p.id === selectedItemId) || null;
    }
  }, [selectedItemId, selectedItemType, dbConversations, dbProjects]);

  const activeConversationData = useMemo(() => {
    // Ensure activeItemData is derived first and is of the correct type
    return selectedItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [selectedItemType, activeItemData]);

  // --- API Key Getter ---
  // Memoize the function itself based on its dependencies
  const getApiKeyForProvider = useMemo(() => {
    // The returned function closes over the dbProviderConfigs and apiKeys
    return (providerId: string): string | undefined => {
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    };
  }, [dbProviderConfigs, apiKeys]); // Dependencies for the getter function

  // --- Selected Provider Derivation ---
  const selectedProvider = useMemo((): AiProviderConfig | undefined => {
    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;

    // Determine all available models (fetched or default)
    const allAvailable =
      config.fetchedModels && config.fetchedModels.length > 0
        ? config.fetchedModels
        : DEFAULT_MODELS[config.type] || [];

    // Return the AiProviderConfig structure
    // Note: 'models' field is intentionally empty here as it's populated
    // by useProviderModelSelection or similar logic based on enabled/sorted models.
    // This hook primarily provides the base provider info and all potential models.
    return {
      id: config.id,
      name: config.name,
      type: config.type,
      models: [], // This will be populated by selection logic elsewhere
      allAvailableModels: allAvailable,
    };
  }, [selectedProviderId, dbProviderConfigs]); // Dependencies for selectedProvider

  // --- Selected Model Derivation ---
  const selectedModel = useMemo((): AiModelConfig | undefined => {
    if (!selectedProviderId || !selectedModelId) return undefined;

    const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
    if (!config) return undefined;

    // Get the API key using the memoized getter
    const currentApiKey = getApiKeyForProvider(config.id);

    // Use the utility function to create the AiModelConfig, which handles instantiation
    return createAiModelConfig(config, selectedModelId, currentApiKey);
  }, [
    selectedProviderId,
    selectedModelId,
    dbProviderConfigs,
    getApiKeyForProvider, // Dependency on the memoized getter function
  ]); // Dependencies for selectedModel

  // Return all derived values
  return {
    activeConversationData,
    activeItemData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider,
  };
}
