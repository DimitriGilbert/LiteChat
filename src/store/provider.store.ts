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
    currentConfigs: DbProviderConfig[], // Pass current configs for validation
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
    currentConfigs: DbProviderConfig[], // Pass current configs
    currentApiKeys: DbApiKey[], // Pass current keys
  ) => Promise<void>;
  setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  loadInitialSelection: (currentConfigs: DbProviderConfig[]) => Promise<void>;
  getApiKeyForProvider: (
    providerId: string,
    currentApiKeys: DbApiKey[], // Pass current keys
    currentConfigs: DbProviderConfig[], // Pass current configs
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

// Helper to determine the default model for a provider config
const getDefaultModelIdForProvider = (
  providerConfig: DbProviderConfig | undefined,
): string | null => {
  if (!providerConfig) return null;

  const availableModels =
    providerConfig.fetchedModels && providerConfig.fetchedModels.length > 0
      ? providerConfig.fetchedModels
      : DEFAULT_MODELS[providerConfig.type] || [];

  if (availableModels.length === 0) return null;

  const enabledModelIds = providerConfig.enabledModels ?? [];
  let potentialModels = availableModels;

  // Filter by enabled models if any are specified
  if (enabledModelIds.length > 0) {
    const filteredByEnabled = availableModels.filter((m) =>
      enabledModelIds.includes(m.id),
    );
    // Only use the filtered list if it's not empty
    if (filteredByEnabled.length > 0) {
      potentialModels = filteredByEnabled;
    } else {
      // If enabledModels is set but filters out everything, maybe warn or fallback?
      // For now, we'll proceed with all available models if the filter yields nothing.
      console.warn(
        `Provider ${providerConfig.id}: enabledModels filter resulted in empty list. Considering all available models.`,
      );
    }
  }

  // Apply sort order if available
  const sortOrder = providerConfig.modelSortOrder ?? [];
  if (sortOrder.length > 0 && potentialModels.length > 0) {
    const orderedList: { id: string; name: string }[] = [];
    const addedIds = new Set<string>();
    const potentialModelMap = new Map(potentialModels.map((m) => [m.id, m]));

    for (const modelId of sortOrder) {
      const model = potentialModelMap.get(modelId);
      // Ensure the model is actually in the potential list before adding
      if (model && !addedIds.has(modelId)) {
        orderedList.push(model);
        addedIds.add(modelId);
      }
    }
    // Add remaining potential models (that weren't in sortOrder) sorted by name
    const remaining = potentialModels
      .filter((m) => !addedIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    potentialModels = [...orderedList, ...remaining];
  } else {
    // Default sort by name if no sort order or no potential models after filtering
    potentialModels.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Return the ID of the first model in the final sorted list
  return potentialModels[0]?.id ?? null;
};

export const useProviderStore = create<ProviderState & ProviderActions>()(
  (set, get) => ({
    // Initial State
    enableApiKeyManagement: true,
    selectedProviderId: null,
    selectedModelId: null,
    providerFetchStatus: {},

    setEnableApiKeyManagement: (enableApiKeyManagement) =>
      set({ enableApiKeyManagement }),

    setSelectedProviderId: (id, currentConfigs) => {
      // Find the config using the *passed* currentConfigs
      const targetProviderConfig = currentConfigs.find((p) => p.id === id);
      // Determine default model based on the *found* config
      const defaultModelId = getDefaultModelIdForProvider(targetProviderConfig);

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
      value = ""; // Clear sensitive data immediately
      try {
        const newId = nanoid();
        const newKey: DbApiKey = {
          id: newId,
          name,
          providerId, // Keep for potential future use or context
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
          // Ensure defaults are set if not provided
          isEnabled: config.isEnabled ?? true,
          apiKeyId: config.apiKeyId ?? null,
          baseURL: config.baseURL ?? null,
          enabledModels: config.enabledModels ?? null,
          autoFetchModels: config.autoFetchModels ?? true,
          fetchedModels: config.fetchedModels ?? null,
          modelsLastFetchedAt: config.modelsLastFetchedAt ?? null,
          modelSortOrder: config.modelSortOrder ?? null,
        };
        await db.providerConfigs.add(newConfig);
        toast.success(`Provider "${config.name}" added.`);
        // After adding, if no provider is selected, select the new one
        if (get().selectedProviderId === null && newConfig.isEnabled) {
          const allConfigs = await db.providerConfigs.toArray(); // Fetch fresh list
          get().setSelectedProviderId(newId, allConfigs);
        }
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
        // If the currently selected provider was updated, re-evaluate selection
        if (get().selectedProviderId === id) {
          const updatedConfig = await db.providerConfigs.get(id);
          if (!updatedConfig) {
            // Config was deleted concurrently? Select fallback.
            console.warn(
              `Selected provider ${id} disappeared after update, finding fallback.`,
            );
            const allConfigs = await db.providerConfigs.toArray();
            const firstEnabled = allConfigs.find((c) => c.isEnabled);
            get().setSelectedProviderId(firstEnabled?.id ?? null, allConfigs);
          } else if (!updatedConfig.isEnabled) {
            // Config was disabled
            console.log(
              `Selected provider ${id} was disabled, finding fallback.`,
            );
            const allConfigs = await db.providerConfigs.toArray();
            const firstEnabled = allConfigs.find((c) => c.isEnabled);
            get().setSelectedProviderId(firstEnabled?.id ?? null, allConfigs);
          } else {
            // Config still enabled, check if current model is still valid
            const currentModelId = get().selectedModelId;
            const defaultModelId = getDefaultModelIdForProvider(updatedConfig);
            const availableModels =
              updatedConfig.fetchedModels ??
              DEFAULT_MODELS[updatedConfig.type] ??
              [];
            const enabledModelIds = updatedConfig.enabledModels ?? [];
            const modelsToConsider =
              enabledModelIds.length > 0
                ? availableModels.filter((m) => enabledModelIds.includes(m.id))
                : availableModels;

            const currentModelStillValid = modelsToConsider.some(
              (m) => m.id === currentModelId,
            );

            if (!currentModelStillValid) {
              console.log(
                `Selected model ${currentModelId} no longer valid/enabled for ${id}, selecting default: ${defaultModelId}`,
              );
              get().setSelectedModelId(defaultModelId);
            } else {
              // Model is still valid, but maybe sort order changed?
              // Re-calculate the default based on the *updated* config
              // If the current selection isn't the *new* default, maybe update?
              // For now, let's keep the user's selection if it's still valid.
              console.log(
                `Selected model ${currentModelId} still valid for ${id}.`,
              );
            }
          }
        }
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

      const wasSelected = get().selectedProviderId === id;

      try {
        await db.providerConfigs.delete(id);
        toast.success(`Provider "${configToDelete.name}" deleted.`);

        // If the deleted provider was selected, find a new one
        if (wasSelected) {
          console.log(`Selected provider ${id} was deleted, finding fallback.`);
          const allConfigs = await db.providerConfigs.toArray(); // Fetch remaining
          const firstEnabled = allConfigs.find((c) => c.isEnabled);
          get().setSelectedProviderId(firstEnabled?.id ?? null, allConfigs);
        }
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
        // Use the passed currentApiKeys
        const apiKey = currentApiKeys.find((k) => k.id === apiKeyId)?.value;
        const fetched = await fetchModelsForProvider(config, apiKey);
        // Use updateDbProviderConfig to save fetched models
        await get().updateDbProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get().setProviderFetchStatus(providerConfigId, "success");
        // Success toast is handled by fetchModelsForProvider now
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get().setProviderFetchStatus(providerConfigId, "error");
        // Error toast is handled by fetchModelsForProvider now
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
      try {
        const lastSelectionState = await db.appState.get(LAST_SELECTION_KEY);
        let providerToSelectId: string | null = null;
        let modelToSelectId: string | null = null;
        const enabledConfigs = currentConfigs.filter((c) => c.isEnabled);

        // 1. Try loading saved selection
        if (lastSelectionState?.value) {
          const savedProviderId = lastSelectionState.value.providerId ?? null;
          const savedModelId = lastSelectionState.value.modelId ?? null;
          const savedProviderConfig = enabledConfigs.find(
            (p) => p.id === savedProviderId,
          );

          if (savedProviderConfig) {
            providerToSelectId = savedProviderId;
            // Check if saved model exists for this provider
            const availableModels =
              savedProviderConfig.fetchedModels ??
              (DEFAULT_MODELS[savedProviderConfig.type] || []);
            const modelExists = availableModels.some(
              (m) => m.id === savedModelId,
            );
            if (modelExists) {
              modelToSelectId = savedModelId;
            } else {
              // Saved model invalid, get default for the saved provider
              modelToSelectId =
                getDefaultModelIdForProvider(savedProviderConfig);
            }
          }
        }

        // 2. If no valid saved selection, find the first enabled provider
        if (!providerToSelectId && enabledConfigs.length > 0) {
          const firstEnabledProvider = enabledConfigs[0];
          providerToSelectId = firstEnabledProvider.id;
          modelToSelectId = getDefaultModelIdForProvider(firstEnabledProvider);
        }

        // 3. Set the final state
        set({
          selectedProviderId: providerToSelectId,
          selectedModelId: modelToSelectId,
        });
        console.log(
          `[ProviderStore] Initialized selection. Provider: ${providerToSelectId}, Model: ${modelToSelectId}`,
        );
        // Save the potentially updated selection back
        await saveSelectionToDb(providerToSelectId, modelToSelectId);
      } catch (error) {
        console.error(
          "[ProviderStore] Failed to initialize selection from DB:",
          error,
        );
        toast.error("Failed to load last provider selection.");
        // Fallback: select first enabled if any, otherwise null
        const enabledConfigs = currentConfigs.filter((c) => c.isEnabled);
        enabledConfigs.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
        );
        const firstEnabled = enabledConfigs[0];
        const fallbackProviderId = firstEnabled?.id ?? null;
        const fallbackModelId = getDefaultModelIdForProvider(firstEnabled);
        set({
          selectedProviderId: fallbackProviderId,
          selectedModelId: fallbackModelId,
        });
        await saveSelectionToDb(fallbackProviderId, fallbackModelId);
      }
    },

    getApiKeyForProvider: (providerId, currentApiKeys, currentConfigs) => {
      const config = currentConfigs.find((p) => p.id === providerId);
      if (!config || !config.apiKeyId) return undefined;
      return currentApiKeys.find((k) => k.id === config.apiKeyId)?.value;
    },
  }),
);
