// src/store/provider.store.ts
import { create } from "zustand";
import type { DbApiKey, DbProviderConfig } from "@/lib/types";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { nanoid } from "nanoid";
import { DEFAULT_MODELS } from "@/lib/litechat";

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "lastProviderSelection";

export interface ProviderState {
  enableApiKeyManagement: boolean;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  providerFetchStatus: Record<string, FetchStatus>;
}

export interface ProviderActions {
  setEnableApiKeyManagement: (enabled: boolean) => void;
  setSelectedProviderId: (
    id: string | null,
    currentConfigs: DbProviderConfig[],
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
    currentConfigs: DbProviderConfig[],
    currentApiKeys: DbApiKey[],
  ) => Promise<void>;
  setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  loadInitialSelection: (
    currentConfigs: DbProviderConfig[],
  ) => Promise<void>;
  // REMOVED: _setDbProviderConfigs
  // REMOVED: _setApiKeys
  getApiKeyForProvider: (
    providerId: string,
    currentApiKeys: DbApiKey[],
    currentConfigs: DbProviderConfig[],
  ) => string | undefined;
}

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
    // REMOVED: apiKeys: [],
    setEnableApiKeyManagement: (enableApiKeyManagement) =>
      set({ enableApiKeyManagement }),

    setSelectedProviderId: (id, currentConfigs) => {
      // This logic now relies entirely on the passed currentConfigs
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
      saveSelectionToDb(id, defaultModelId);
    },

    setSelectedModelId: (selectedModelId) => {
      set({ selectedModelId });
      saveSelectionToDb(get().selectedProviderId, selectedModelId);
    },
    addApiKey: async (name, providerId, value) => {
      if (!get().enableApiKeyManagement) {
        toast.error("API Key Management is disabled.");
        throw new Error("API Key Management is disabled.");
      }
      const keyToAdd = value;
      value = "";
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
      if (!get().enableApiKeyManagement) {
        toast.error("API Key Management is disabled.");
        throw new Error("API Key Management is disabled.");
      }
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

      // If the deleted provider was selected, clear selection
      if (get().selectedProviderId === id) {
        set({ selectedProviderId: null, selectedModelId: null });
        await saveSelectionToDb(null, null);
      }

      try {
        await db.providerConfigs.delete(id);
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
        await get().updateDbProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get().setProviderFetchStatus(providerConfigId, "success");
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get().setProviderFetchStatus(providerConfigId, "error");
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

    loadInitialSelection: async (currentConfigs) => {
      // This action now only loads the *selection* state
      try {
        const lastSelectionState = await db.appState.get(LAST_SELECTION_KEY);

        let initialProviderId: string | null = null;
        let initialModelId: string | null = null;

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
              (DEFAULT_MODELS[providerConfig.type] || []);
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
              (DEFAULT_MODELS[providerConfig.type] || []);
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

    getApiKeyForProvider: (providerId, currentApiKeys, currentConfigs) => {
      // This function now requires the current keys/configs to be passed in
      const config = currentConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return currentApiKeys.find((k) => k.id === config.apiKeyId)?.value;
    },
  }),
);
