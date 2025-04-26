// src/store/provider.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbProviderConfig,
  DbApiKey,
  AiProviderConfig,
  AiModelConfig,
  DbProviderType,
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
          modelToSelect = null;
        }

        if (providerToSelect && modelToSelect) {
          const providerConfig =
            savedProviderConfig ??
            configs.find((p) => p.id === providerToSelect);
          if (providerConfig) {
            const providerTypeKey =
              providerConfig.type as keyof typeof DEFAULT_MODELS;
            const availableModels =
              providerConfig.fetchedModels ??
              (DEFAULT_MODELS[providerTypeKey] || []);
            const enabledModelIds = providerConfig.enabledModels ?? [];
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
              modelToSelect = null;
            }
          } else {
            modelToSelect = null;
            providerToSelect = null;
            const firstEnabled = configs.find((p) => p.isEnabled);
            providerToSelect = firstEnabled?.id ?? null;
          }
        }

        if (providerToSelect && modelToSelect === null) {
          const finalProviderConfig = configs.find(
            (p) => p.id === providerToSelect,
          );
          modelToSelect = getDefaultModelIdForProvider(finalProviderConfig);
        }

        set({
          selectedProviderId: providerToSelect,
          selectedModelId: modelToSelect,
          isLoading: false,
        });
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
      const newValue = value;
      value = "";
      const newId = nanoid();
      const now = new Date();
      const newKey: DbApiKey = {
        id: newId,
        name,
        value: newValue,
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
        set((state) => ({
          dbApiKeys: state.dbApiKeys.filter((k) => k.id !== id),
          dbProviderConfigs: state.dbProviderConfigs.map((p) =>
            p.apiKeyId === id ? { ...p, apiKeyId: null } : p,
          ),
        }));
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
        set((state) => {
          state.dbProviderConfigs.push(newConfig);
        });
        toast.success(`Provider "${configData.name}" added.`);
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
      let originalConfig: DbProviderConfig | undefined;
      let configExists = false;

      set((state) => {
        const index = state.dbProviderConfigs.findIndex((p) => p.id === id);
        if (index !== -1) {
          configExists = true;
          originalConfig = { ...state.dbProviderConfigs[index] };
          const currentConfig = state.dbProviderConfigs[index];
          const updatedConfigData: DbProviderConfig = {
            ...currentConfig,
            ...changes,
            updatedAt: new Date(),
          };
          state.dbProviderConfigs[index] = updatedConfigData;
        } else {
          console.warn(`ProviderStore: Config ${id} not found for update.`);
        }
      });

      if (configExists) {
        // Fetch the potentially updated config *after* the set operation
        const updatedConfig = get().dbProviderConfigs.find((p) => p.id === id);

        if (updatedConfig) {
          // Check if it still exists after set
          try {
            await PersistenceService.saveProviderConfig(updatedConfig);
            // Re-validate selection using the confirmed updatedConfig
            if (get().selectedProviderId === id) {
              if (!updatedConfig.isEnabled) {
                const firstEnabled = get().dbProviderConfigs.find(
                  (p) => p.isEnabled,
                );
                get().selectProvider(firstEnabled?.id ?? null);
              } else {
                const currentModelId = get().selectedModelId;
                const defaultModelId =
                  getDefaultModelIdForProvider(updatedConfig);
                const providerTypeKey =
                  updatedConfig.type as keyof typeof DEFAULT_MODELS;
                const availableModels =
                  updatedConfig.fetchedModels ??
                  (DEFAULT_MODELS[providerTypeKey] || []);
                const enabledModelIds = updatedConfig.enabledModels ?? [];
                const modelsToConsider =
                  enabledModelIds.length > 0
                    ? availableModels.filter((m) =>
                        enabledModelIds.includes(m.id),
                      )
                    : availableModels;

                const modelIsValid = modelsToConsider.some(
                  (m) => m.id === currentModelId,
                );

                if (!modelIsValid) {
                  get().selectModel(defaultModelId);
                } else {
                  PersistenceService.saveSetting(LAST_SELECTION_KEY, {
                    providerId: id,
                    modelId: currentModelId,
                  });
                }
              }
            }
          } catch (e) {
            console.error("ProviderStore: Error updating provider config", e);
            toast.error(
              `Failed to update Provider: ${e instanceof Error ? e.message : String(e)}`,
            );
            // Revert state using originalConfig if save failed
            set((state) => {
              const index = state.dbProviderConfigs.findIndex(
                (p) => p.id === id,
              );
              if (index !== -1 && originalConfig) {
                state.dbProviderConfigs[index] = originalConfig;
              }
            });
            throw e;
          }
        } else {
          console.error(
            `ProviderStore: Config ${id} disappeared unexpectedly after update attempt.`,
          );
          // Handle potential race condition or error state if needed
        }
      }
    },

    deleteProviderConfig: async (id) => {
      const configName =
        get().dbProviderConfigs.find((p) => p.id === id)?.name ?? "Unknown";
      const wasSelected = get().selectedProviderId === id;
      const originalConfigs = [...get().dbProviderConfigs];

      set((state) => ({
        dbProviderConfigs: state.dbProviderConfigs.filter((p) => p.id !== id),
      }));

      try {
        await PersistenceService.deleteProviderConfig(id);
        toast.success(`Provider "${configName}" deleted.`);
        if (wasSelected) {
          const firstEnabled = get().dbProviderConfigs.find((p) => p.isEnabled);
          get().selectProvider(firstEnabled?.id ?? null);
        }
      } catch (e) {
        console.error("ProviderStore: Error deleting provider config", e);
        toast.error(
          `Failed to delete Provider: ${e instanceof Error ? e.message : String(e)}`,
        );
        set({ dbProviderConfigs: originalConfigs });
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

      get()._setProviderFetchStatus(providerConfigId, "fetching");
      try {
        const apiKeyId = config.apiKeyId;
        const apiKey = get().dbApiKeys.find((k) => k.id === apiKeyId)?.value;

        const fetched = await fetchModelsForProvider(config, apiKey);

        await get().updateProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get()._setProviderFetchStatus(providerConfigId, "success");
        toast.success(`Models fetched successfully for ${config.name}`);
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get()._setProviderFetchStatus(providerConfigId, "error");
      }
    },

    _setProviderFetchStatus: (providerId, status) => {
      set((state) => ({
        providerFetchStatus: {
          ...state.providerFetchStatus,
          [providerId]: status,
        },
      }));
    },

    // --- Selectors ---
    getSelectedProvider: () => {
      const { selectedProviderId, dbProviderConfigs } = get();
      const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
      if (!config) return undefined;

      const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
      const allAvailable =
        config.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || []);

      const enabledModelIds = new Set(config.enabledModels ?? []);
      let displayModels =
        enabledModelIds.size > 0
          ? allAvailable.filter((m: { id: string }) =>
              enabledModelIds.has(m.id),
            )
          : allAvailable;

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
        const remaining = displayModels
          .filter((m: { id: string }) => !addedIds.has(m.id))
          .sort(
            (
              a: { name?: string; id: string },
              b: { name?: string; id: string },
            ) => (a.name || a.id).localeCompare(b.name || b.id),
          );
        displayModels = [...orderedList, ...remaining];
      } else {
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
        id: config.id,
        name: config.name,
        type: config.type,
        models: aiModels,
        allAvailableModels: allAvailable,
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
          const allAvailable =
            c.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || []);

          const enabledModelIds = new Set(c.enabledModels ?? []);
          let displayModels =
            enabledModelIds.size > 0
              ? allAvailable.filter((m: { id: string }) =>
                  enabledModelIds.has(m.id),
                )
              : allAvailable;

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
            const remaining = displayModels
              .filter((m: { id: string }) => !addedIds.has(m.id))
              .sort(
                (
                  a: { name?: string; id: string },
                  b: { name?: string; id: string },
                ) => (a.name || a.id).localeCompare(b.name || b.id),
              );
            displayModels = [...orderedList, ...remaining];
          } else {
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
            allAvailableModels: allAvailable,
          };
        })
        .filter((p): p is AiProviderConfig => p !== null);
    },
  })),
);
