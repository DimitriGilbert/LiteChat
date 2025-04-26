// src/store/provider.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbProviderConfig,
  DbApiKey,
  AiProviderConfig,
  AiModelConfig,
} from "@/types/litechat/provider";
import { PersistenceService } from "@/services/persistence.service";
import {
  createAiModelConfig,
  getDefaultModelIdForProvider,
  DEFAULT_MODELS,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { fetchModelsForProvider } from "@/services/model-fetcher";

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "provider:lastSelection";

export interface ProviderState {
  dbProviderConfigs: DbProviderConfig[];
  dbApiKeys: DbApiKey[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  providerFetchStatus: Record<string, FetchStatus>;
  isLoading: boolean;
  error: string | null;
  enableApiKeyManagement: boolean;
}

export interface ProviderActions {
  loadInitialData: () => Promise<void>;
  selectProvider: (id: string | null) => void;
  selectModel: (id: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  addProviderConfig: (
    configData: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteProviderConfig: (id: string) => Promise<void>;
  fetchModels: (providerConfigId: string) => Promise<void>;
  getSelectedProvider: () => AiProviderConfig | undefined;
  getSelectedModel: () => AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  getActiveProviders: () => AiProviderConfig[];
  _setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  setEnableApiKeyManagement: (enabled: boolean) => void;
}

export const useProviderStore = create(
  immer<ProviderState & ProviderActions>((set, get) => ({
    // Initial State
    dbProviderConfigs: [],
    dbApiKeys: [],
    selectedProviderId: null,
    selectedModelId: null,
    providerFetchStatus: {},
    isLoading: true,
    error: null,
    enableApiKeyManagement: true,

    setEnableApiKeyManagement: (enabled) => {
      set({ enableApiKeyManagement: enabled });
      PersistenceService.saveSetting("enableApiKeyManagement", enabled);
    },

    loadInitialData: async () => {
      set({ isLoading: true, error: null });
      try {
        const enableApiMgmt = await PersistenceService.loadSetting<boolean>(
          "enableApiKeyManagement",
          true,
        );
        const [configs, keys] = await Promise.all([
          PersistenceService.loadProviderConfigs(),
          PersistenceService.loadApiKeys(),
        ]);
        set({
          dbProviderConfigs: configs,
          dbApiKeys: keys,
          enableApiKeyManagement: enableApiMgmt,
        });

        const lastSelection = await PersistenceService.loadSetting<{
          providerId: string | null;
          modelId: string | null;
        }>(LAST_SELECTION_KEY, { providerId: null, modelId: null });

        let providerToSelect = lastSelection.providerId;
        let modelToSelect = lastSelection.modelId;

        const savedProviderConfig = configs.find(
          (p) => p.id === providerToSelect && p.isEnabled,
        );

        if (!savedProviderConfig) {
          const firstEnabled = configs.find((p) => p.isEnabled);
          providerToSelect = firstEnabled?.id ?? null;
          modelToSelect = null; // Reset model if provider changed
        }

        // Validate the selected model against the selected provider
        if (providerToSelect && modelToSelect) {
          const finalProviderConfig = configs.find(
            (p) => p.id === providerToSelect,
          );
          if (finalProviderConfig) {
            const providerTypeKey =
              finalProviderConfig.type as keyof typeof DEFAULT_MODELS;
            const availableModels =
              finalProviderConfig.fetchedModels ??
              (DEFAULT_MODELS[providerTypeKey] || []);
            const enabledModelIds = finalProviderConfig.enabledModels ?? [];
            const modelsToConsider =
              enabledModelIds.length > 0
                ? availableModels.filter((m) => enabledModelIds.includes(m.id))
                : availableModels;

            const modelIsValid = modelsToConsider.some(
              (m) => m.id === modelToSelect,
            );

            if (!modelIsValid) {
              console.warn(
                `Saved model ${modelToSelect} invalid for provider ${providerToSelect}, resetting.`,
              );
              modelToSelect = null; // Reset model if invalid
            }
          } else {
            // If the saved provider doesn't exist anymore, reset both
            providerToSelect = null;
            modelToSelect = null;
          }
        }

        // If provider is selected but model is not (or was reset), find the default
        if (providerToSelect && modelToSelect === null) {
          const finalProviderConfig = configs.find(
            (p) => p.id === providerToSelect,
          );
          modelToSelect = getDefaultModelIdForProvider(finalProviderConfig);
        }

        // If still no provider, select the first enabled one if available
        if (providerToSelect === null) {
          const firstEnabled = configs.find((p) => p.isEnabled);
          providerToSelect = firstEnabled?.id ?? null;
          if (providerToSelect) {
            modelToSelect = getDefaultModelIdForProvider(firstEnabled);
          }
        }

        set({
          selectedProviderId: providerToSelect,
          selectedModelId: modelToSelect,
          isLoading: false,
        });
        // Save the final selection state
        await PersistenceService.saveSetting(LAST_SELECTION_KEY, {
          providerId: providerToSelect,
          modelId: modelToSelect,
        });
      } catch (e) {
        console.error("ProviderStore: Error loading initial data", e);
        set({
          isLoading: false,
          error: "Failed to load provider data",
        });
        toast.error("Failed to load provider data");
      }
    },

    selectProvider: (id) => {
      const config = get().dbProviderConfigs.find((p) => p.id === id);
      const modelId = getDefaultModelIdForProvider(config);
      set({ selectedProviderId: id, selectedModelId: modelId });
      PersistenceService.saveSetting(LAST_SELECTION_KEY, {
        providerId: id,
        modelId: modelId,
      });
    },

    selectModel: (id) => {
      const currentProviderId = get().selectedProviderId;
      set({ selectedModelId: id });
      PersistenceService.saveSetting(LAST_SELECTION_KEY, {
        providerId: currentProviderId,
        modelId: id,
      });
    },

    addApiKey: async (name, providerId, value) => {
      const newId = nanoid();
      const now = new Date();
      const newKey: DbApiKey = {
        id: newId,
        name,
        value: value,
        providerId: providerId,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await PersistenceService.saveApiKey(newKey);
        set((state) => {
          state.dbApiKeys.push(newKey);
        });
        toast.success(`API Key "${name}" added.`);
        return newId;
      } catch (e) {
        console.error("ProviderStore: Error adding API key", e);
        toast.error(
          `Failed to add API Key: ${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
    },

    deleteApiKey: async (id) => {
      const keyName =
        get().dbApiKeys.find((k) => k.id === id)?.name ?? "Unknown Key";
      try {
        await PersistenceService.deleteApiKey(id);
        // Update state *after* successful deletion
        set((state) => {
          state.dbApiKeys = state.dbApiKeys.filter((k) => k.id !== id);
          // Also update provider configs that might have used this key
          state.dbProviderConfigs = state.dbProviderConfigs.map((p) =>
            p.apiKeyId === id ? { ...p, apiKeyId: null } : p,
          );
        });
        toast.success(`API Key "${keyName}" deleted.`);
      } catch (e) {
        console.error("ProviderStore: Error deleting API key", e);
        toast.error(
          `Failed to delete API Key: ${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
    },

    addProviderConfig: async (configData) => {
      const newId = nanoid();
      const now = new Date();
      const newConfig: DbProviderConfig = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...configData,
        isEnabled: configData.isEnabled ?? true,
        apiKeyId: configData.apiKeyId ?? null,
        baseURL: configData.baseURL ?? null,
        enabledModels: configData.enabledModels ?? null,
        autoFetchModels: configData.autoFetchModels ?? true,
        fetchedModels: configData.fetchedModels ?? null,
        modelsLastFetchedAt: configData.modelsLastFetchedAt ?? null,
        modelSortOrder: configData.modelSortOrder ?? null,
      };
      try {
        await PersistenceService.saveProviderConfig(newConfig);
        // Update state *after* successful save
        set((state) => {
          state.dbProviderConfigs.push(newConfig);
        });
        toast.success(`Provider "${configData.name}" added.`);
        // Select the new provider if none was selected and it's enabled
        if (get().selectedProviderId === null && newConfig.isEnabled) {
          get().selectProvider(newId);
        }
        return newId;
      } catch (e) {
        console.error("ProviderStore: Error adding provider config", e);
        toast.error(
          `Failed to add Provider: ${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
    },

    updateProviderConfig: async (id, changes) => {
      // Get the current config first
      const originalConfig = get().dbProviderConfigs.find((p) => p.id === id);
      if (!originalConfig) {
        console.warn(`ProviderStore: Config ${id} not found for update.`);
        return;
      }

      // Create the updated config data
      const updatedConfigData: DbProviderConfig = {
        ...originalConfig,
        ...changes,
        updatedAt: new Date(),
      };

      try {
        // Save to persistence first
        await PersistenceService.saveProviderConfig(updatedConfigData);

        // Update state *after* successful save
        set((state) => {
          const index = state.dbProviderConfigs.findIndex((p) => p.id === id);
          if (index !== -1) {
            state.dbProviderConfigs[index] = updatedConfigData;
          }
        });

        // Re-validate selection *after* state update
        if (get().selectedProviderId === id) {
          if (!updatedConfigData.isEnabled) {
            // If disabled, select the first available enabled provider
            const firstEnabled = get().dbProviderConfigs.find(
              (p) => p.isEnabled,
            );
            get().selectProvider(firstEnabled?.id ?? null);
          } else {
            // If still enabled, check if the current model is still valid
            const currentModelId = get().selectedModelId;
            const defaultModelId =
              getDefaultModelIdForProvider(updatedConfigData);

            const providerTypeKey =
              updatedConfigData.type as keyof typeof DEFAULT_MODELS;
            const availableModels =
              updatedConfigData.fetchedModels ??
              (DEFAULT_MODELS[providerTypeKey] || []);
            const enabledModelIds = updatedConfigData.enabledModels ?? [];
            const modelsToConsider =
              enabledModelIds.length > 0
                ? availableModels.filter((m) => enabledModelIds.includes(m.id))
                : availableModels;

            const modelIsValid = modelsToConsider.some(
              (m) => m.id === currentModelId,
            );

            if (!modelIsValid) {
              // If current model is no longer valid, select the default
              get().selectModel(defaultModelId);
            } else {
              // If model is still valid, ensure the selection is persisted
              PersistenceService.saveSetting(LAST_SELECTION_KEY, {
                providerId: id,
                modelId: currentModelId,
              });
            }
          }
        }
        // Don't toast success here, let the caller (e.g., Settings UI) handle it
      } catch (e) {
        console.error("ProviderStore: Error updating provider config", e);
        toast.error(
          `Failed to update Provider: ${e instanceof Error ? e.message : String(e)}`,
        );
        // No state revert needed as the update failed before setting state
        throw e;
      }
    },

    deleteProviderConfig: async (id) => {
      const configName =
        get().dbProviderConfigs.find((p) => p.id === id)?.name ?? "Unknown";
      const wasSelected = get().selectedProviderId === id;

      try {
        await PersistenceService.deleteProviderConfig(id);
        // Update state *after* successful deletion
        set((state) => {
          state.dbProviderConfigs = state.dbProviderConfigs.filter(
            (p) => p.id !== id,
          );
        });
        toast.success(`Provider "${configName}" deleted.`);
        // If the deleted provider was selected, select the first enabled one
        if (wasSelected) {
          const firstEnabled = get().dbProviderConfigs.find((p) => p.isEnabled);
          get().selectProvider(firstEnabled?.id ?? null);
        }
      } catch (e) {
        console.error("ProviderStore: Error deleting provider config", e);
        toast.error(
          `Failed to delete Provider: ${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
    },

    fetchModels: async (providerConfigId) => {
      const config = get().dbProviderConfigs.find(
        (p) => p.id === providerConfigId,
      );
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

      // Set status immediately before await
      get()._setProviderFetchStatus(providerConfigId, "fetching");

      try {
        const apiKeyId = config.apiKeyId;
        // Get latest API key value *before* the await
        const apiKey = get().dbApiKeys.find((k) => k.id === apiKeyId)?.value;

        const fetched = await fetchModelsForProvider(config, apiKey);

        // Update the provider config *after* the await
        // Use the updateProviderConfig action to handle state update and persistence
        await get().updateProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        // Set status *after* successful update
        get()._setProviderFetchStatus(providerConfigId, "success");
        toast.success(`Models fetched successfully for ${config.name}`);
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        // Set status *after* error
        get()._setProviderFetchStatus(providerConfigId, "error");
        // Toast is handled by fetchModelsForProvider or updateProviderConfig
      }
    },

    _setProviderFetchStatus: (providerId, status) => {
      set((state) => {
        state.providerFetchStatus[providerId] = status;
      });
    },

    // --- Selectors ---
    getSelectedProvider: () => {
      const { selectedProviderId, dbProviderConfigs } = get();
      const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
      if (!config) return undefined;

      const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
      const allAvailable = [
        ...(config.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || [])),
      ]; // Create copy

      const enabledModelIds = new Set(config.enabledModels ?? []);
      let displayModels =
        enabledModelIds.size > 0
          ? allAvailable.filter((m: { id: string }) =>
              enabledModelIds.has(m.id),
            )
          : [...allAvailable]; // Create copy

      const sortOrder = config.modelSortOrder ?? [];
      if (sortOrder.length > 0 && displayModels.length > 0) {
        const orderedList: { id: string; name: string }[] = [];
        const addedIds = new Set<string>();
        const displayModelMap = new Map(
          displayModels.map((m: { id: string; name: string }) => [m.id, m]),
        );

        for (const modelId of sortOrder) {
          const model = displayModelMap.get(modelId);
          if (model && !addedIds.has(modelId)) {
            orderedList.push(model);
            addedIds.add(modelId);
          }
        }
        // Create copy before sorting remaining
        const remaining = [...displayModels]
          .filter((m: { id: string }) => !addedIds.has(m.id))
          .sort(
            (
              a: { name?: string; id: string },
              b: { name?: string; id: string },
            ) => (a.name || a.id).localeCompare(b.name || b.id),
          );
        displayModels = [...orderedList, ...remaining];
      } else {
        // Sort the copy
        displayModels.sort(
          (
            a: { name?: string; id: string },
            b: { name?: string; id: string },
          ) => (a.name || a.id).localeCompare(b.name || b.id),
        );
      }

      const aiModels = displayModels.map(
        (m: { id: string; name: string }): AiModelConfig => ({
          id: m.id,
          name: m.name,
          instance: null, // Instance is fetched on demand by getSelectedModel
        }),
      );

      return {
        id: config.id,
        name: config.name,
        type: config.type,
        models: aiModels,
        allAvailableModels: allAvailable, // Return the copy
      };
    },

    getSelectedModel: () => {
      const {
        selectedProviderId,
        selectedModelId,
        dbProviderConfigs,
        dbApiKeys,
      } = get();
      const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
      if (!config || !selectedModelId) return undefined;
      const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
      return createAiModelConfig(config, selectedModelId, apiKeyRecord?.value);
    },

    getApiKeyForProvider: (providerId) => {
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      return get().dbApiKeys.find((k) => k.id === config?.apiKeyId)?.value;
    },

    getActiveProviders: () => {
      return get()
        .dbProviderConfigs.filter((p: DbProviderConfig) => p.isEnabled)
        .map((c: DbProviderConfig): AiProviderConfig | null => {
          const providerTypeKey = c.type as keyof typeof DEFAULT_MODELS;
          // Create copy
          const allAvailable = [
            ...(c.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || [])),
          ];

          const enabledModelIds = new Set(c.enabledModels ?? []);
          // Create copy
          let displayModels =
            enabledModelIds.size > 0
              ? allAvailable.filter((m: { id: string }) =>
                  enabledModelIds.has(m.id),
                )
              : [...allAvailable];

          const sortOrder = c.modelSortOrder ?? [];
          if (sortOrder.length > 0 && displayModels.length > 0) {
            const orderedList: { id: string; name: string }[] = [];
            const addedIds = new Set<string>();
            const displayModelMap = new Map(
              displayModels.map((m: { id: string; name: string }) => [m.id, m]),
            );
            for (const modelId of sortOrder) {
              const model = displayModelMap.get(modelId);
              if (model && !addedIds.has(modelId)) {
                orderedList.push(model);
                addedIds.add(modelId);
              }
            }
            // Create copy before sorting remaining
            const remaining = [...displayModels]
              .filter((m: { id: string }) => !addedIds.has(m.id))
              .sort(
                (
                  a: { name?: string; id: string },
                  b: { name?: string; id: string },
                ) => (a.name || a.id).localeCompare(b.name || b.id),
              );
            displayModels = [...orderedList, ...remaining];
          } else {
            // Sort the copy
            displayModels.sort(
              (
                a: { name?: string; id: string },
                b: { name?: string; id: string },
              ) => (a.name || a.id).localeCompare(b.name || b.id),
            );
          }

          const aiModels = displayModels.map(
            (m: { id: string; name: string }): AiModelConfig => ({
              id: m.id,
              name: m.name,
              instance: null,
            }),
          );

          return {
            id: c.id,
            name: c.name,
            type: c.type,
            models: aiModels,
            allAvailableModels: allAvailable, // Return the copy
          };
        })
        .filter((p): p is AiProviderConfig => p !== null);
    },
  })),
);
