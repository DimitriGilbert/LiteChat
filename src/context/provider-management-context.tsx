// src/context/provider-management-context.tsx
import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useEffect,
} from "react";
import type {
  AiProviderConfig,
  AiModelConfig,
  DbApiKey,
  DbProviderConfig,
} from "@/lib/types";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";

import { toast } from "sonner";
// Removed direct SDK imports
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { DEFAULT_MODELS, requiresApiKey } from "@/lib/litechat"; // Import DEFAULT_MODELS
import { createAiModelConfig } from "@/utils/chat-utils"; // Import the new utility

const EMPTY_API_KEYS: DbApiKey[] = [];
const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];
const EMPTY_ACTIVE_PROVIDERS: AiProviderConfig[] = [];

const dummyAddApiKey = async (): Promise<string> => {
  console.warn("API Key Management is disabled.");
  toast.error("API Key Management is disabled in configuration.");
  throw new Error("API Key Management is disabled.");
};
const dummyDeleteApiKey = async (): Promise<void> => {
  console.warn("API Key Management is disabled.");
  toast.error("API Key Management is disabled in configuration.");
  throw new Error("API Key Management is disabled.");
};

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
  fetchModels: (providerConfigId: string) => Promise<void>;
  providerFetchStatus: Record<string, FetchStatus>;
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
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
  const dbProviderConfigs =
    storage.providerConfigs || EMPTY_DB_PROVIDER_CONFIGS;
  const apiKeys = storage.apiKeys || EMPTY_API_KEYS;
  const [providerFetchStatus, setProviderFetchStatus] = useState<
    Record<string, FetchStatus>
  >({});

  // --- Internal Fetch Logic ---
  const fetchAndUpdateModelsInternal = useCallback(
    async (config: DbProviderConfig) => {
      if (providerFetchStatus[config.id] === "fetching") {
        console.log(
          `[ProviderMgmt] Fetch already in progress for ${config.name}`,
        );
        return;
      }
      setProviderFetchStatus((prev) => ({ ...prev, [config.id]: "fetching" }));
      try {
        const apiKey = apiKeys.find((k) => k.id === config.apiKeyId)?.value;
        const fetched = await fetchModelsForProvider(config, apiKey);
        await storage.updateProviderConfig(config.id, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });
        setProviderFetchStatus((prev) => ({ ...prev, [config.id]: "success" }));
        toast.success(
          `Successfully fetched ${fetched.length} models for ${config.name}`,
        );
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        setProviderFetchStatus((prev) => ({ ...prev, [config.id]: "error" }));
        toast.error(
          `Failed to fetch models for ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [storage, apiKeys, providerFetchStatus],
  );

  // --- Auto-fetching on Load ---
  useEffect(() => {
    const configsToFetch = dbProviderConfigs.filter(
      (c) =>
        c.isEnabled &&
        c.autoFetchModels &&
        !c.fetchedModels && // Only fetch if not already fetched
        providerFetchStatus[c.id] !== "fetching" &&
        providerFetchStatus[c.id] !== "success", // Avoid re-fetching if successful
    );
    if (configsToFetch.length > 0) {
      console.log(
        `[ProviderMgmt] Triggering initial auto-fetch for ${configsToFetch.length} providers.`,
      );
      Promise.allSettled(
        configsToFetch.map((config) => fetchAndUpdateModelsInternal(config)),
      );
    }
    // This effect should run primarily when the list of provider configs changes
    // (e.g., added, removed, enabled/disabled) or when fetch status changes.
    // The dependency on dbProviderConfigs (from useLiveQuery) handles config changes.
    // The dependency on providerFetchStatus prevents re-triggering fetches that are ongoing or completed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbProviderConfigs, providerFetchStatus]);

  // --- Manual Fetch Trigger ---
  const fetchModels = useCallback(
    async (providerConfigId: string) => {
      const config = dbProviderConfigs.find((p) => p.id === providerConfigId);
      if (config) {
        await fetchAndUpdateModelsInternal(config);
      } else {
        toast.error("Provider configuration not found.");
      }
    },
    [dbProviderConfigs, fetchAndUpdateModelsInternal],
  );

  // --- Helper to get model definitions ---
  const getAllAvailableModelDefs = useCallback(
    (providerConfigId: string): { id: string; name: string }[] => {
      const config = dbProviderConfigs.find((p) => p.id === providerConfigId);
      if (!config) return [];
      // Prioritize fetched models, then fall back to defaults
      if (config.fetchedModels && config.fetchedModels.length > 0) {
        return config.fetchedModels;
      }
      return DEFAULT_MODELS[config.type] || []; // Use imported DEFAULT_MODELS
    },
    [dbProviderConfigs],
  );

  // --- Helper to get API Key Value ---
  const getApiKeyForProvider = useCallback(
    (providerConfigId: string): string | undefined => {
      const selectedDbConfig = dbProviderConfigs.find(
        (p) => p.id === providerConfigId,
      );
      if (!selectedDbConfig?.apiKeyId) return undefined;
      return apiKeys.find((k) => k.id === selectedDbConfig.apiKeyId)?.value;
    },
    [dbProviderConfigs, apiKeys],
  );

  // --- Generate Active Providers (UPDATED LOGIC) ---
  const activeProviders = useMemo<AiProviderConfig[]>(() => {
    console.log("[ProviderMgmt] Recalculating activeProviders...");
    const enabledConfigs = dbProviderConfigs.filter((c) => c.isEnabled);
    if (enabledConfigs.length === 0) return EMPTY_ACTIVE_PROVIDERS;

    const generatedProviders: AiProviderConfig[] = [];

    for (const config of enabledConfigs) {
      const currentApiKey = getApiKeyForProvider(config.id);

      if (requiresApiKey(config.type) && !currentApiKey) {
        console.warn(
          `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): API Key required but not found or not linked.`,
        );
        continue;
      }

      const allAvailableModelDefs = getAllAvailableModelDefs(config.id);
      if (allAvailableModelDefs.length === 0) {
        console.warn(
          `[ProviderMgmt] No models found (fetched/default) for provider "${config.name}". Skipping.`,
        );
        continue;
      }

      let modelsForDropdownList: { id: string; name: string }[] = [];
      const enabledModelIds = config.enabledModels ?? [];
      const sortOrder = config.modelSortOrder ?? [];

      if (enabledModelIds.length > 0) {
        const enabledModelDefs = allAvailableModelDefs.filter((m) =>
          enabledModelIds.includes(m.id),
        );

        const orderedEnabledList: { id: string; name: string }[] = [];
        const addedIds = new Set<string>();

        for (const modelId of sortOrder) {
          const model = enabledModelDefs.find((m) => m.id === modelId);
          if (model && !addedIds.has(modelId)) {
            orderedEnabledList.push(model);
            addedIds.add(modelId);
          }
        }

        const remainingEnabled = enabledModelDefs
          .filter((m) => !addedIds.has(m.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        modelsForDropdownList = [...orderedEnabledList, ...remainingEnabled];

        if (modelsForDropdownList.length === 0) {
          console.warn(
            `[ProviderMgmt] Enabled models configured for "${config.name}", but none matched available models. Falling back to all available models.`,
          );
          modelsForDropdownList = [...allAvailableModelDefs].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
        }
      } else {
        modelsForDropdownList = [...allAvailableModelDefs].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        console.log(
          `[ProviderMgmt] No models explicitly enabled for "${config.name}". Displaying all ${modelsForDropdownList.length} available models in dropdown.`,
        );
      }

      // Instantiate models using the utility function
      const finalModelsForDropdown: AiModelConfig[] = modelsForDropdownList
        .map((modelDef) =>
          createAiModelConfig(config, modelDef.id, currentApiKey),
        )
        .filter((m): m is AiModelConfig => m !== null); // Filter out failed instantiations

      // Add the provider config if it has models to show
      if (finalModelsForDropdown.length > 0) {
        generatedProviders.push({
          id: config.id,
          name: config.name,
          type: config.type,
          models: finalModelsForDropdown,
          allAvailableModels: allAvailableModelDefs, // Keep original list for settings UI
        });
      } else {
        console.warn(
          `[ProviderMgmt] No valid models could be instantiated for provider "${config.name}" after filtering/sorting. Skipping.`,
        );
      }
    }
    return generatedProviders;
  }, [dbProviderConfigs, getAllAvailableModelDefs, getApiKeyForProvider]); // Depend on live data

  // --- Model Selection Hook ---
  const providerModel = useProviderModelSelection({
    providers: activeProviders,
    initialProviderId,
    initialModelId,
  });

  // --- API Key Management Actions ---
  // Use storage functions directly, conditionally based on enableApiKeyManagement
  const addApiKeyAction = useCallback(
    async (
      name: string,
      providerId: string,
      value: string,
    ): Promise<string> => {
      if (!enableApiKeyManagement) return dummyAddApiKey();
      // Add any validation or pre-processing if needed
      return storage.addApiKey(name, providerId, value);
    },
    [enableApiKeyManagement, storage],
  );

  const deleteApiKeyAction = useCallback(
    async (id: string): Promise<void> => {
      if (!enableApiKeyManagement) return dummyDeleteApiKey();
      // Add any confirmation logic if needed
      return storage.deleteApiKey(id);
    },
    [enableApiKeyManagement, storage],
  );

  // --- Context Value ---
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
      apiKeys,
      addApiKey: addApiKeyAction, // Use the conditional action
      deleteApiKey: deleteApiKeyAction, // Use the conditional action
      getApiKeyForProvider,
      dbProviderConfigs,
      addDbProviderConfig: storage.addProviderConfig,
      updateDbProviderConfig: storage.updateProviderConfig,
      deleteDbProviderConfig: storage.deleteProviderConfig,
      fetchModels,
      providerFetchStatus,
      getAllAvailableModelDefs,
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
      apiKeys,
      addApiKeyAction, // Dependency on the action itself
      deleteApiKeyAction, // Dependency on the action itself
      getApiKeyForProvider,
      dbProviderConfigs,
      storage.addProviderConfig,
      storage.updateProviderConfig,
      storage.deleteProviderConfig,
      fetchModels,
      providerFetchStatus,
      getAllAvailableModelDefs,
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
