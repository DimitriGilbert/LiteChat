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
import { fetchModelsForProvider } from "@/services/model-fetcher";

// --- Constants, Helpers, Interfaces (remain the same) ---
const EMPTY_API_KEYS: DbApiKey[] = [];
const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];
const EMPTY_ACTIVE_PROVIDERS: AiProviderConfig[] = [];
const DEFAULT_MODELS: Record<DbProviderType, { id: string; name: string }[]> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }],
  google: [
    { id: "gemini-1.5-pro-latest", name: "Gemini 1.5 Pro" },
    { id: "gemini-1.5-flash-latest", name: "Gemini 1.5 Flash" },
    { id: "gemini-1.0-pro", name: "Gemini 1.0 Pro" },
  ],
  openrouter: [],
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }],
  "openai-compatible": [],
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
// --- End Constants, Helpers, Interfaces ---

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

  // --- Internal Fetch Logic (Unchanged from previous fix) ---
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
      }
    },
    [storage, apiKeys, providerFetchStatus],
  );

  // --- Auto-fetching on Load (Unchanged from previous fix) ---
  useEffect(() => {
    const configsToFetch = dbProviderConfigs.filter(
      (c) =>
        c.isEnabled &&
        c.autoFetchModels &&
        !c.fetchedModels &&
        providerFetchStatus[c.id] !== "fetching" &&
        providerFetchStatus[c.id] !== "success",
    );
    if (configsToFetch.length > 0) {
      console.log(
        `[ProviderMgmt] Triggering initial auto-fetch for ${configsToFetch.length} providers.`,
      );
      Promise.allSettled(
        configsToFetch.map((config) => fetchAndUpdateModelsInternal(config)),
      );
    }
  }, [dbProviderConfigs, fetchAndUpdateModelsInternal, providerFetchStatus]);

  // --- Manual Fetch Trigger (Unchanged from previous fix) ---
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

  // --- Helper to get model definitions (Unchanged from previous fix) ---
  const getAllAvailableModelDefs = useCallback(
    (providerConfigId: string): { id: string; name: string }[] => {
      const config = dbProviderConfigs.find((p) => p.id === providerConfigId);
      if (!config) return [];
      if (config.fetchedModels && config.fetchedModels.length > 0) {
        return config.fetchedModels;
      }
      return DEFAULT_MODELS[config.type] || [];
    },
    [dbProviderConfigs],
  );

  // --- Generate Active Providers (UPDATED LOGIC) ---
  const activeProviders = useMemo<AiProviderConfig[]>(() => {
    console.log("[ProviderMgmt] Recalculating activeProviders...");
    const enabledConfigs = dbProviderConfigs.filter((c) => c.isEnabled);
    if (enabledConfigs.length === 0) return EMPTY_ACTIVE_PROVIDERS;

    const generatedProviders: AiProviderConfig[] = [];

    for (const config of enabledConfigs) {
      try {
        let providerInstance: any;
        let currentApiKey: string | undefined;
        // (API Key check logic remains the same)
        if (config.apiKeyId) {
          currentApiKey = apiKeys.find((k) => k.id === config.apiKeyId)?.value;
          if (!currentApiKey && requiresApiKey(config.type)) {
            console.warn(
              `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): API Key ID ${config.apiKeyId} configured but key not found.`,
            );
            continue;
          }
        } else if (requiresApiKey(config.type)) {
          console.warn(
            `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): API Key required but none linked.`,
          );
          continue;
        }

        // (Provider instantiation logic remains the same)
        switch (config.type) {
          case "openai":
            providerInstance = createOpenAI({ apiKey: currentApiKey });
            break;
          case "google":
            providerInstance = createGoogleGenerativeAI({
              apiKey: currentApiKey,
            });
            break;
          case "openrouter":
            providerInstance = createOpenRouter({ apiKey: currentApiKey });
            break;
          case "ollama":
            providerInstance = createOllama({
              baseURL: config.baseURL ?? undefined,
            });
            break;
          case "openai-compatible":
            if (!config.baseURL) {
              console.warn(
                `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): Base URL required.`,
              );
              continue;
            }
            providerInstance = createOpenAICompatible({
              name: config.name ?? "OpenAI-Compatible",
              baseURL: config.baseURL,
              apiKey: currentApiKey,
            });
            break;
          default:
            console.warn(
              `[ProviderMgmt] Skipping provider "${config.name}" (ID: ${config.id}): Unsupported type.`,
            );
            continue;
        }

        // --- Get ALL available models for search ---
        const allAvailableModelDefs = getAllAvailableModelDefs(config.id);
        if (allAvailableModelDefs.length === 0) {
          console.warn(
            `[ProviderMgmt] No models found (fetched/default) for provider "${config.name}". Skipping.`,
          );
          continue; // Skip provider if no models are available at all
        }
        // const allAvailableModelMap = new Map(
        //   allAvailableModelDefs.map((m) => [m.id, m]),
        // );

        // --- Determine the list for the dropdown ---
        let modelsForDropdownList: { id: string; name: string }[] = [];
        const enabledModelIds = config.enabledModels ?? []; // Use enabled list or empty array

        if (enabledModelIds.length > 0) {
          // Filter all available models to get only the enabled ones
          const enabledModelDefs = allAvailableModelDefs.filter((m) =>
            enabledModelIds.includes(m.id),
          );

          // Sort this *enabled subset* based on modelSortOrder
          const sortOrder = config.modelSortOrder ?? [];
          const orderedEnabledList: { id: string; name: string }[] = [];
          const addedIds = new Set<string>();

          // Add models based on the sort order
          for (const modelId of sortOrder) {
            // Only add if it's actually in the enabled subset
            const model = enabledModelDefs.find((m) => m.id === modelId);
            if (model && !addedIds.has(modelId)) {
              orderedEnabledList.push(model);
              addedIds.add(modelId);
            }
          }

          // Add any remaining *enabled* models that weren't in the sort order (alphabetically)
          const remainingEnabled = enabledModelDefs
            .filter((m) => !addedIds.has(m.id))
            .sort((a, b) => a.name.localeCompare(b.name));

          modelsForDropdownList = [...orderedEnabledList, ...remainingEnabled];
        } else {
          // If NO models are explicitly enabled, show ALL available models in dropdown (sorted alphabetically)
          modelsForDropdownList = [...allAvailableModelDefs].sort((a, b) =>
            a.name.localeCompare(b.name),
          );
          console.log(
            `[ProviderMgmt] No models explicitly enabled for "${config.name}". Displaying all ${modelsForDropdownList.length} available models in dropdown.`,
          );
        }

        // --- Instantiate AiModelConfig for the final dropdown list ---
        const finalModelsForDropdown: AiModelConfig[] = modelsForDropdownList
          .map((modelDef) => {
            try {
              return {
                id: modelDef.id,
                name: modelDef.name,
                instance: providerInstance(modelDef.id),
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

        // Add the provider config
        generatedProviders.push({
          id: config.id,
          name: config.name,
          type: config.type,
          models: finalModelsForDropdown, // Correctly ordered/filtered list for dropdown
          allAvailableModels: allAvailableModelDefs, // Full list for search
        });
      } catch (err) {
        console.error(
          `[ProviderMgmt] Failed to instantiate provider ${config.name}:`,
          err,
        );
        toast.error(
          `Failed to load provider "${config.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return generatedProviders;
  }, [dbProviderConfigs, apiKeys, getAllAvailableModelDefs]); // Depend on live data

  // --- Model Selection Hook (Unchanged) ---
  const providerModel = useProviderModelSelection({
    providers: activeProviders,
    initialProviderId,
    initialModelId,
  });

  // --- API Key Management (Unchanged) ---
  const realApiKeysMgmt = useApiKeysManagement({
    addDbApiKey: storage.addApiKey,
    deleteDbApiKey: storage.deleteApiKey,
  });
  const apiKeysMgmt: UseApiKeysManagementReturn = useMemo(() => {
    return enableApiKeyManagement ? realApiKeysMgmt : dummyApiKeysMgmt;
  }, [enableApiKeyManagement, realApiKeysMgmt]);

  // --- Helper to get API Key Value (Unchanged) ---
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

  // --- Context Value (Unchanged) ---
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
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
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
      apiKeysMgmt.addApiKey,
      apiKeysMgmt.deleteApiKey,
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

// --- Hook Export (Unchanged) ---
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
