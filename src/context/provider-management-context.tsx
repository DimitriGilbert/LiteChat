// src/context/provider-management-context.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState, // Import useState
  useEffect, // Import useEffect
} from "react";
import type {
  AiProviderConfig,
  AiModelConfig,
  DbApiKey,
  DbProviderConfig,
  DbProviderType,
} from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import {
  useApiKeysManagement,
  type UseApiKeysManagementReturn,
} from "@/hooks/use-api-keys-management";
import { toast } from "sonner";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { fetchModelsForProvider } from "@/services/model-fetcher"; // Import the fetcher

const EMPTY_API_KEYS: DbApiKey[] = [];
const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];
const EMPTY_ACTIVE_PROVIDERS: AiProviderConfig[] = [];

// Minimize DEFAULT_MODELS - keep only essential fallbacks or for non-fetchable types
const DEFAULT_MODELS: Record<DbProviderType, { id: string; name: string }[]> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }], // Keep one popular as fallback
  google: [
    // Google GenAI SDK uses specific names, keep these
    { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
    { id: "gemini-1.0-pro", name: "Gemini 1.0 Pro" },
  ],
  openrouter: [], // Let fetch handle these
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }], // Keep one popular as fallback
  "openai-compatible": [], // Let fetch handle these
};

const requiresApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai" || type === "openrouter" || type === "google";
};

const dummyApiKeysMgmt: UseApiKeysManagementReturn = {
  addApiKey: async () => {
    console.warn("API Key Management is disabled.");
    toast.error("API Key Management is disabled in configuration.");
    throw new Error("API Key Management is disabled.");
  },
  deleteApiKey: async () => {
    console.warn("API Key Management is disabled.");
    toast.error("API Key Management is disabled in configuration.");
    throw new Error("API Key Management is disabled.");
  },
};

// --- NEW Fetching Status Type ---
type FetchStatus = "idle" | "fetching" | "error" | "success";

interface ProviderManagementContextProps {
  enableApiKeyManagement: boolean;
  activeProviders: AiProviderConfig[];
  selectedProviderId: string | null;
  setSelectedProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedModelId: string | null;
  setSelectedModelId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  apiKeys: DbApiKey[];
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  getApiKeyForProvider: (providerConfigId: string) => string | undefined;
  dbProviderConfigs: DbProviderConfig[];
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  // --- NEW ---
  fetchModels: (providerConfigId: string) => Promise<void>;
  providerFetchStatus: Record<string, FetchStatus>;
}

const ProviderManagementContext = createContext<
  ProviderManagementContextProps | undefined
>(undefined);

interface ProviderManagementProviderProps {
  children: React.ReactNode;
  initialProviderId?: string | null;
  initialModelId?: string | null;
  enableApiKeyManagement?: boolean;
}

export const ProviderManagementProvider: React.FC<
  ProviderManagementProviderProps
> = ({
  children,
  initialProviderId = null,
  initialModelId = null,
  enableApiKeyManagement = true,
}) => {
  const storage = useChatStorage();
  // --- NEW State for Fetching Status ---
  const [providerFetchStatus, setProviderFetchStatus] = useState<
    Record<string, FetchStatus>
  >({});

  // --- Function to trigger fetch and update DB ---
  const fetchAndUpdateModels = useCallback(
    async (config: DbProviderConfig) => {
      if (!config.autoFetchModels) return; // Skip if disabled

      setProviderFetchStatus((prev) => ({ ...prev, [config.id]: "fetching" }));
      try {
        const apiKey = (storage.apiKeys || EMPTY_API_KEYS).find(
          (k) => k.id === config.apiKeyId,
        )?.value;
        const fetched = await fetchModelsForProvider(config, apiKey);
        await storage.updateProviderConfig(config.id, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });
        setProviderFetchStatus((prev) => ({
          ...prev,
          [config.id]: "success",
        }));
        toast.success(
          `Successfully fetched ${fetched.length} models for ${config.name}`,
        );
      } catch (error) {
        console.error(error);
        setProviderFetchStatus((prev) => ({ ...prev, [config.id]: "error" }));
        // Error toast is handled within fetchModelsForProvider
      }
    },
    [storage],
  );

  // --- Effect to trigger initial fetches ---
  useEffect(() => {
    const configsToFetch = (
      storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS
    ).filter(
      (c) =>
        c.isEnabled &&
        c.autoFetchModels &&
        !c.fetchedModels && // Only fetch if not already fetched
        providerFetchStatus[c.id] !== "fetching" && // Avoid re-fetching if already in progress
        providerFetchStatus[c.id] !== "success", // Avoid re-fetching if successful this session
    );

    if (configsToFetch.length > 0) {
      console.log(
        `[ProviderMgmt] Triggering initial fetch for ${configsToFetch.length} providers.`,
      );
      configsToFetch.forEach(fetchAndUpdateModels);
    }
  }, [storage.providerConfigs, fetchAndUpdateModels, providerFetchStatus]);

  // --- Manual Fetch Trigger ---
  const fetchModels = useCallback(
    async (providerConfigId: string) => {
      const config = (
        storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS
      ).find((p) => p.id === providerConfigId);
      if (config) {
        await fetchAndUpdateModels(config);
      } else {
        toast.error("Provider configuration not found.");
      }
    },
    [storage.providerConfigs, fetchAndUpdateModels],
  );

  // --- Active Providers Generation (Modified) ---
  const activeProviders = useMemo<AiProviderConfig[]>(() => {
    const enabledConfigs = (
      storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS
    ).filter((c) => c.isEnabled);
    const availableApiKeys = storage.apiKeys || EMPTY_API_KEYS;

    if (enabledConfigs.length === 0) {
      return EMPTY_ACTIVE_PROVIDERS;
    }

    const generatedProviders: AiProviderConfig[] = [];

    for (const config of enabledConfigs) {
      try {
        let providerInstance: any;
        let apiKey: string | undefined;

        if (config.apiKeyId) {
          apiKey = availableApiKeys.find(
            (k) => k.id === config.apiKeyId,
          )?.value;
          if (!apiKey && requiresApiKey(config.type)) {
            console.warn(
              `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): API Key ID ${config.apiKeyId} configured but key not found or value missing.`,
            );
            continue;
          }
        } else if (requiresApiKey(config.type)) {
          console.warn(
            `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): API Key is required but none is linked in the provider configuration.`,
          );
          continue;
        }

        // Instantiate the base provider SDK object
        switch (config.type) {
          case "openai":
            providerInstance = createOpenAI({ apiKey });
            break;
          case "google":
            providerInstance = createGoogleGenerativeAI({ apiKey });
            break;
          case "openrouter":
            providerInstance = createOpenRouter({ apiKey });
            break;
          case "ollama":
            providerInstance = createOllama({
              baseURL: config.baseURL ?? undefined,
            });
            break;
          case "openai-compatible":
            if (!config.baseURL) {
              console.warn(
                `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): Base URL required for OpenAI-Compatible.`,
              );
              continue;
            }
            providerInstance = createOpenAICompatible({
              name: config.name ?? "OpenAI-Compatible",
              baseURL: config.baseURL,
              apiKey: apiKey,
            });
            break;
          default:
            console.warn(
              `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): Unsupported provider type: ${config.type}`,
            );
            continue;
        }

        // --- Determine available models ---
        let availableModelDefs: { id: string; name: string }[] = [];
        if (config.fetchedModels && config.fetchedModels.length > 0) {
          // 1. Prioritize fetched models
          availableModelDefs = config.fetchedModels;
        } else {
          // 2. Fallback to DEFAULT_MODELS for the type
          availableModelDefs = DEFAULT_MODELS[config.type] || [];
        }

        // --- Filter models based on enabledModels if specified ---
        const modelIdsToUse =
          config.enabledModels && config.enabledModels.length > 0
            ? config.enabledModels // Use user's explicit list
            : availableModelDefs.map((m) => m.id); // Use all available (fetched or default)

        // --- Instantiate AiModelConfig for active models ---
        const models: AiModelConfig[] = modelIdsToUse
          .map((modelId) => {
            // Find the definition (either fetched or default)
            const modelDef = availableModelDefs.find((m) => m.id === modelId);
            if (!modelDef) {
              // This can happen if enabledModels contains IDs not in fetched/default lists
              console.warn(
                `[ProviderMgmt] Model ID "${modelId}" enabled for "${config.name}" but not found in available definitions. Skipping.`,
              );
              return null;
            }
            try {
              // Instantiate the specific model using the base provider instance
              return {
                id: modelDef.id,
                name: modelDef.name, // Use name from definition
                instance: providerInstance(modelDef.id), // Call base instance with model ID
              };
            } catch (modelErr) {
              console.error(
                `[ProviderMgmt] Failed to instantiate model "${modelDef.name}" (ID: ${modelDef.id}) for provider "${config.name}":`,
                modelErr,
              );
              return null;
            }
          })
          .filter((m): m is AiModelConfig => m !== null);

        if (models.length > 0) {
          generatedProviders.push({
            id: config.id,
            name: config.name,
            type: config.type,
            models: models,
          });
        } else {
          console.warn(
            `[ProviderMgmt] No valid models could be instantiated for provider "${config.name}" (ID: ${config.id}). Skipping provider.`,
          );
        }
      } catch (err) {
        console.error(
          `[ProviderMgmt] Failed to instantiate provider ${config.name} (ID: ${config.id}, Type: ${config.type}):`,
          err,
        );
        toast.error(
          `Failed to load provider "${config.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return generatedProviders;
  }, [storage.providerConfigs, storage.apiKeys]); // Re-run when DB changes

  const providerModel = useProviderModelSelection({
    providers: activeProviders,
    initialProviderId,
    initialModelId,
  });

  const realApiKeysMgmt = useApiKeysManagement({
    addDbApiKey: storage.addApiKey,
    deleteDbApiKey: storage.deleteApiKey,
  });
  const apiKeysMgmt: UseApiKeysManagementReturn = useMemo(() => {
    return enableApiKeyManagement ? realApiKeysMgmt : dummyApiKeysMgmt;
  }, [enableApiKeyManagement, realApiKeysMgmt]);

  const getApiKeyForProvider = useCallback(
    (providerConfigId: string): string | undefined => {
      const selectedDbConfig = (
        storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS
      ).find((p) => p.id === providerConfigId);
      if (!selectedDbConfig?.apiKeyId) return undefined;
      return (storage.apiKeys || EMPTY_API_KEYS).find(
        (k) => k.id === selectedDbConfig.apiKeyId,
      )?.value;
    },
    [storage.providerConfigs, storage.apiKeys],
  );

  const value = useMemo(
    () => ({
      enableApiKeyManagement: enableApiKeyManagement ?? true,
      activeProviders,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      selectedProvider: providerModel.selectedProvider,
      selectedModel: providerModel.selectedModel,
      apiKeys: storage.apiKeys || EMPTY_API_KEYS,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider,
      dbProviderConfigs: storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS,
      addDbProviderConfig: storage.addProviderConfig,
      updateDbProviderConfig: storage.updateProviderConfig,
      deleteDbProviderConfig: storage.deleteProviderConfig,
      // --- NEW ---
      fetchModels,
      providerFetchStatus,
    }),
    [
      enableApiKeyManagement,
      activeProviders,
      providerModel.selectedProviderId,
      providerModel.setSelectedProviderId,
      providerModel.selectedModelId,
      providerModel.setSelectedModelId,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      storage.apiKeys,
      apiKeysMgmt.addApiKey,
      apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider,
      storage.providerConfigs,
      storage.addProviderConfig,
      storage.updateProviderConfig,
      storage.deleteProviderConfig,
      fetchModels, // Add new function
      providerFetchStatus, // Add new state
    ],
  );

  return (
    <ProviderManagementContext.Provider value={value}>
      {children}
    </ProviderManagementContext.Provider>
  );
};

export const useProviderManagementContext =
  (): ProviderManagementContextProps => {
    const context = useContext(ProviderManagementContext);
    if (context === undefined) {
      throw new Error(
        "useProviderManagementContext must be used within a ProviderManagementProvider",
      );
    }
    return context;
  };
