// src/store/provider.store.ts
import { create } from "zustand";
import type { DbApiKey, DbProviderConfig, DbProviderType } from "@/lib/types";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { nanoid } from "nanoid";

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
    currentConfigs: DbProviderConfig[], // Keep parameter
  ) => void;
  setSelectedModelId: (id: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string, // Keep providerId for context, though not stored in this store
    value: string,
  ) => Promise<string>; // Action remains, but implementation uses db directly
  deleteApiKey: (id: string) => Promise<void>; // Action remains, but implementation uses db directly
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>; // Action remains, but implementation uses db directly
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>; // Action remains, but implementation uses db directly
  deleteDbProviderConfig: (id: string) => Promise<void>; // Action remains, but implementation uses db directly
  fetchModels: (
    providerConfigId: string,
    currentConfigs: DbProviderConfig[], // Keep parameter
    currentApiKeys: DbApiKey[], // Keep parameter
  ) => Promise<void>; // Action remains
  setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  loadInitialSelection: (
    currentConfigs: DbProviderConfig[], // Add parameter
  ) => Promise<void>; // Renamed from initializeFromDb
  // REMOVED: _setDbProviderConfigs
  // REMOVED: _setApiKeys
  getApiKeyForProvider: (
    providerId: string,
    currentApiKeys: DbApiKey[], // Add parameter
    currentConfigs: DbProviderConfig[], // Add parameter
  ) => string | undefined; // Modified signature
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

// Helper to get default models (copied from original store)
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

export const useProviderStore = create<ProviderState & ProviderActions>()(
  (set, get) => ({
    // Initial State
    enableApiKeyManagement: true,
    selectedProviderId: null,
    selectedModelId: null,
    providerFetchStatus: {},
    // REMOVED: dbProviderConfigs: [],
    // REMOVED: apiKeys: [],

    // Actions
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
            : getDefaultModels(targetProviderConfig.type); // Use helper

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

    // DB Actions now directly modify Dexie and rely on useChatStorage for UI updates
    addApiKey: async (name, providerId, value) => {
      if (!get().enableApiKeyManagement) {
        toast.error("API Key Management is disabled.");
        throw new Error("API Key Management is disabled.");
      }
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
        // No state update here - useChatStorage handles it
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
      const keyToDelete = await db.apiKeys.get(id); // Check if exists before toast
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
        // No state update here - useChatStorage handles it
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
        // No state update here - useChatStorage handles it
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
        // No state update here - useChatStorage handles it
      } catch (error) {
        console.error("Failed to update provider config:", error);
        toast.error(
          `Failed to update Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    deleteDbProviderConfig: async (id) => {
      const configToDelete = await db.providerConfigs.get(id); // Check before toast
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
        // No state update here - useChatStorage handles it
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
        // Find API key from the passed currentApiKeys
        const apiKey = currentApiKeys.find((k) => k.id === apiKeyId)?.value;
        const fetched = await fetchModelsForProvider(config, apiKey);

        // Use updateDbProviderConfig to update Dexie (which triggers useChatStorage update)
        await get().updateDbProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get().setProviderFetchStatus(providerConfigId, "success");
        // Toast is now handled by the updateDbProviderConfig success/failure
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get().setProviderFetchStatus(providerConfigId, "error");
        // Toast is handled by fetchModelsForProvider or updateDbProviderConfig
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
              getDefaultModels(providerConfig.type); // Use helper
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
              getDefaultModels(providerConfig.type); // Use helper
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
        // Fallback selection if DB load fails
        const firstEnabled = currentConfigs.find((c) => c.isEnabled);
        if (firstEnabled) {
          get().setSelectedProviderId(firstEnabled.id, currentConfigs); // This will set default model
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
