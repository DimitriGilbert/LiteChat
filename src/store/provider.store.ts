// src/store/provider.store.ts
import { create } from "zustand";
import type { DbApiKey, DbProviderConfig, DbProviderType } from "@/lib/types";
import { toast } from "sonner";
import { db } from "@/lib/db"; // Import db
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { nanoid } from "nanoid";

// Default models remain the same
const DEFAULT_MODELS: Record<DbProviderType, { id: string; name: string }[]> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }],
  google: [
    { id: "gemini-2.5-pro-exp-03-25", name: "Gemini 2.5 Pro exp (Free)" },
    {
      id: "gemini-2.0-flash-thinking-exp-01-21",
      name: "Gemini 2.0 Flash exp (Free)",
    },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "emini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro Preview" },
    { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash Preview" },
  ],
  openrouter: [],
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }],
  "openai-compatible": [],
};

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "lastProviderSelection"; // Key for storing selection in DB

export interface ProviderState {
  enableApiKeyManagement: boolean;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  providerFetchStatus: Record<string, FetchStatus>;
  // Add dbProviderConfigs and apiKeys to the state
  dbProviderConfigs: DbProviderConfig[];
  apiKeys: DbApiKey[];
}

export interface ProviderActions {
  setEnableApiKeyManagement: (enabled: boolean) => void;
  setSelectedProviderId: (
    id: string | null,
    currentConfigs: DbProviderConfig[], // Keep this parameter
  ) => void;
  setSelectedModelId: (id: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  fetchModels: (
    providerConfigId: string,
    currentConfigs: DbProviderConfig[], // Keep this parameter
    currentApiKeys: DbApiKey[], // Keep this parameter
  ) => Promise<void>;
  setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  initializeFromDb: (currentConfigs: DbProviderConfig[]) => Promise<void>;
  // Add internal actions to update state from storage
  _setDbProviderConfigs: (configs: DbProviderConfig[]) => void;
  _setApiKeys: (keys: DbApiKey[]) => void;
  // Add getter for API key (useful for components)
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

// Helper function to save selection
const saveSelectionToDb = async (
  providerId: string | null,
  modelId: string | null,
) => {
  try {
    await db.appState.put({
      key: LAST_SELECTION_KEY,
      value: { providerId, modelId },
    });
  } catch (error) {
    console.error("Failed to save selection state to DB:", error);
  }
};

export const useProviderStore = create<ProviderState & ProviderActions>()(
  (set, get) => ({
    // Initial State
    enableApiKeyManagement: true,
    selectedProviderId: null,
    selectedModelId: null,
    providerFetchStatus: {},
    dbProviderConfigs: [], // Initialize as empty
    apiKeys: [], // Initialize as empty

    // Actions
    _setDbProviderConfigs: (dbProviderConfigs) => set({ dbProviderConfigs }),
    _setApiKeys: (apiKeys) => set({ apiKeys }),

    setEnableApiKeyManagement: (enableApiKeyManagement) =>
      set({ enableApiKeyManagement }),

    setSelectedProviderId: (id, currentConfigs) => {
      const targetProviderConfig = currentConfigs.find((p) => p.id === id);
      let defaultModelId: string | null = null;

      if (targetProviderConfig) {
        const availableModels =
          targetProviderConfig.fetchedModels &&
          targetProviderConfig.fetchedModels.length > 0
            ? targetProviderConfig.fetchedModels
            : DEFAULT_MODELS[targetProviderConfig.type] || [];

        const enabledModelIds = targetProviderConfig.enabledModels ?? [];
        let potentialModels = availableModels;
        if (enabledModelIds.length > 0) {
          const filteredByEnabled = availableModels.filter((m) =>
            enabledModelIds.includes(m.id),
          );
          if (filteredByEnabled.length > 0) {
            potentialModels = filteredByEnabled;
          }
        }

        const sortOrder = targetProviderConfig.modelSortOrder ?? [];
        if (sortOrder.length > 0 && potentialModels.length > 0) {
          const orderedList: { id: string; name: string }[] = [];
          const addedIds = new Set<string>();
          const potentialModelMap = new Map(
            potentialModels.map((m) => [m.id, m]),
          );

          for (const modelId of sortOrder) {
            const model = potentialModelMap.get(modelId);
            if (model && !addedIds.has(modelId)) {
              orderedList.push(model);
              addedIds.add(modelId);
            }
          }
          const remaining = potentialModels
            .filter((m) => !addedIds.has(m.id))
            .sort((a, b) => a.name.localeCompare(b.name));
          potentialModels = [...orderedList, ...remaining];
        } else {
          potentialModels.sort((a, b) => a.name.localeCompare(b.name));
        }

        defaultModelId = potentialModels[0]?.id ?? null;
      }

      set({ selectedProviderId: id, selectedModelId: defaultModelId });
      // Save the new selection
      saveSelectionToDb(id, defaultModelId);
    },

    setSelectedModelId: (selectedModelId) => {
      set({ selectedModelId });
      // Save the new selection
      saveSelectionToDb(get().selectedProviderId, selectedModelId);
    },

    addApiKey: async (name, providerId, value) => {
      const keyToAdd = value;
      value = ""; // Clear sensitive data immediately
      try {
        const newId = nanoid();
        const newKey: DbApiKey = {
          id: newId,
          name,
          providerId,
          value: keyToAdd,
          createdAt: new Date(),
        };
        await db.apiKeys.add(newKey);
        // Update state after DB operation
        const updatedKeys = await db.apiKeys.toArray();
        set({ apiKeys: updatedKeys });
        toast.success(`API Key "${name}" added.`);
        return newId;
      } catch (error) {
        console.error("Failed to add API key:", error);
        toast.error(
          `Failed to add API Key: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    deleteApiKey: async (id) => {
      const keyToDelete = await db.apiKeys.get(id);
      if (!keyToDelete) {
        toast.error("API Key not found.");
        return;
      }
      try {
        await db.transaction("rw", db.apiKeys, db.providerConfigs, async () => {
          await db.apiKeys.delete(id);
          const configsToUpdate = await db.providerConfigs
            .where("apiKeyId")
            .equals(id)
            .toArray();
          if (configsToUpdate.length > 0) {
            const updates = configsToUpdate.map((config) =>
              db.providerConfigs.update(config.id, { apiKeyId: null }),
            );
            await Promise.all(updates);
          }
        });
        // Update state after DB operation
        const updatedKeys = await db.apiKeys.toArray();
        set({ apiKeys: updatedKeys });
        toast.success(`API Key "${keyToDelete.name}" deleted.`);
      } catch (error) {
        console.error("Failed to delete API key:", error);
        toast.error(
          `Failed to delete API Key: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    addDbProviderConfig: async (config) => {
      try {
        const newId = nanoid();
        const now = new Date();
        const newConfig: DbProviderConfig = {
          ...config,
          id: newId,
          createdAt: now,
          updatedAt: now,
        };
        await db.providerConfigs.add(newConfig);
        // Update state after DB operation
        const updatedConfigs = await db.providerConfigs.toArray();
        set({ dbProviderConfigs: updatedConfigs });
        toast.success(`Provider "${config.name}" added.`);
        return newId;
      } catch (error) {
        console.error("Failed to add provider config:", error);
        toast.error(
          `Failed to add Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    updateDbProviderConfig: async (id, changes) => {
      try {
        await db.providerConfigs.update(id, {
          ...changes,
          updatedAt: new Date(),
        });
        // Update state after DB operation
        const updatedConfigs = await db.providerConfigs.toArray();
        set({ dbProviderConfigs: updatedConfigs });
      } catch (error) {
        console.error("Failed to update provider config:", error);
        toast.error(
          `Failed to update Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    deleteDbProviderConfig: async (id) => {
      const configToDelete = await db.providerConfigs.get(id);
      if (!configToDelete) {
        toast.error("Provider configuration not found.");
        return;
      }

      if (get().selectedProviderId === id) {
        set({ selectedProviderId: null, selectedModelId: null });
        await saveSelectionToDb(null, null); // Save cleared selection
      }

      try {
        await db.providerConfigs.delete(id);
        // Update state after DB operation
        const updatedConfigs = await db.providerConfigs.toArray();
        set({ dbProviderConfigs: updatedConfigs });
        toast.success(`Provider "${configToDelete.name}" deleted.`);
      } catch (error) {
        console.error("Failed to delete provider config:", error);
        toast.error(
          `Failed to delete Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    fetchModels: async (providerConfigId, currentConfigs, currentApiKeys) => {
      const config = currentConfigs.find((p) => p.id === providerConfigId);
      if (!config) {
        toast.error("Provider configuration not found for fetching models.");
        return;
      }
      if (get().providerFetchStatus[providerConfigId] === "fetching") {
        console.log(
          `[ProviderStore] Fetch already in progress for ${config.name}`,
        );
        return;
      }

      get().setProviderFetchStatus(providerConfigId, "fetching");
      try {
        const apiKeyId = config.apiKeyId;
        const apiKey = currentApiKeys.find((k) => k.id === apiKeyId)?.value;
        const fetched = await fetchModelsForProvider(config, apiKey);

        // Use updateDbProviderConfig to update Dexie and trigger state update
        await get().updateDbProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get().setProviderFetchStatus(providerConfigId, "success");
        toast.success(
          `Successfully fetched ${fetched.length} models for ${config.name}`,
        );
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get().setProviderFetchStatus(providerConfigId, "error");
        toast.error(
          `Failed to fetch models for ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },

    setProviderFetchStatus: (providerId, status) => {
      set((state) => ({
        providerFetchStatus: {
          ...state.providerFetchStatus,
          [providerId]: status,
        },
      }));
    },

    initializeFromDb: async (currentConfigs) => {
      try {
        // Load initial data from DB
        const [initialApiKeys, lastSelectionState] = await Promise.all([
          db.apiKeys.toArray(),
          db.appState.get(LAST_SELECTION_KEY),
        ]);

        // Set initial DB data into state
        set({
          dbProviderConfigs: currentConfigs,
          apiKeys: initialApiKeys,
        });

        let initialProviderId: string | null = null;
        let initialModelId: string | null = null;

        // Validate loaded selection
        if (lastSelectionState?.value) {
          const loadedProviderId = lastSelectionState.value.providerId ?? null;
          const loadedModelId = lastSelectionState.value.modelId ?? null;

          const providerConfig = currentConfigs.find(
            (p) => p.id === loadedProviderId && p.isEnabled,
          );

          if (providerConfig) {
            initialProviderId = loadedProviderId;
            const availableModels =
              providerConfig.fetchedModels ??
              DEFAULT_MODELS[providerConfig.type] ??
              [];
            const modelExists = availableModels.some(
              (m) => m.id === loadedModelId,
            );
            if (modelExists) {
              initialModelId = loadedModelId;
            }
          }
        }

        // Fallback logic if no valid selection loaded
        if (!initialProviderId) {
          const firstEnabled = currentConfigs.find((c) => c.isEnabled);
          if (firstEnabled) {
            initialProviderId = firstEnabled.id;
          }
        }

        // Determine default model if needed
        if (initialProviderId && !initialModelId) {
          const providerConfig = currentConfigs.find(
            (p) => p.id === initialProviderId,
          );
          if (providerConfig) {
            const availableModels =
              providerConfig.fetchedModels ??
              DEFAULT_MODELS[providerConfig.type] ??
              [];
            const enabledModelIds = providerConfig.enabledModels ?? [];
            let potentialModels = availableModels;

            if (enabledModelIds.length > 0) {
              const filteredByEnabled = availableModels.filter((m) =>
                enabledModelIds.includes(m.id),
              );
              if (filteredByEnabled.length > 0) {
                potentialModels = filteredByEnabled;
              }
            }

            const sortOrder = providerConfig.modelSortOrder ?? [];
            if (sortOrder.length > 0 && potentialModels.length > 0) {
              const orderedList: { id: string; name: string }[] = [];
              const addedIds = new Set<string>();
              const potentialModelMap = new Map(
                potentialModels.map((m) => [m.id, m]),
              );

              for (const modelId of sortOrder) {
                const model = potentialModelMap.get(modelId);
                if (model && !addedIds.has(modelId)) {
                  orderedList.push(model);
                  addedIds.add(modelId);
                }
              }
              const remaining = potentialModels
                .filter((m) => !addedIds.has(m.id))
                .sort((a, b) => a.name.localeCompare(b.name));
              potentialModels = [...orderedList, ...remaining];
            } else {
              potentialModels.sort((a, b) => a.name.localeCompare(b.name));
            }

            initialModelId = potentialModels[0]?.id ?? null;
          }
        }

        // Set the final state
        set({
          selectedProviderId: initialProviderId,
          selectedModelId: initialModelId,
        });
        console.log(
          `[ProviderStore] Initialized selection. Provider: ${initialProviderId}, Model: ${initialModelId}`,
        );
      } catch (error) {
        console.error(
          "[ProviderStore] Failed to initialize selection from DB:",
          error,
        );
        toast.error("Failed to load last provider selection.");
        const firstEnabled = currentConfigs.find((c) => c.isEnabled);
        if (firstEnabled) {
          get().setSelectedProviderId(firstEnabled.id, currentConfigs);
        } else {
          set({ selectedProviderId: null, selectedModelId: null });
        }
      }
    },

    // Getter for API key
    getApiKeyForProvider: (providerId) => {
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return get().apiKeys.find((k) => k.id === config.apiKeyId)?.value;
    },
  }),
);
