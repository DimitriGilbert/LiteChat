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
  DEFAULT_MODELS,
  combineModelId,
  splitModelId,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { fetchModelsForProvider } from "@/services/model-fetcher";

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "provider:lastModelSelection";
const GLOBAL_MODEL_SORT_ORDER_KEY = "provider:globalModelSortOrder";

// Helper functions combineModelId and splitModelId are REMOVED from here

export interface ProviderState {
  dbProviderConfigs: DbProviderConfig[];
  dbApiKeys: DbApiKey[];
  selectedModelId: string | null;
  globalModelSortOrder: string[];
  providerFetchStatus: Record<string, FetchStatus>;
  isLoading: boolean;
  error: string | null;
  enableApiKeyManagement: boolean;
}

export interface ProviderActions {
  loadInitialData: () => Promise<void>;
  selectModel: (combinedId: string | null) => void;
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
  setGlobalModelSortOrder: (combinedIds: string[]) => Promise<void>;
  getSelectedModel: () => AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  getActiveProviders: () => AiProviderConfig[];
  getAllAvailableModelDefsForProvider: (
    providerConfigId: string,
  ) => { id: string; name: string; metadata?: Record<string, any> }[];
  _setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  setEnableApiKeyManagement: (enabled: boolean) => void;
}

export const useProviderStore = create(
  immer<ProviderState & ProviderActions>((set, get) => ({
    // Initial State
    dbProviderConfigs: [],
    dbApiKeys: [],
    selectedModelId: null,
    globalModelSortOrder: [],
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
        const [configs, keys, savedOrder, lastSelectedModelId] =
          await Promise.all([
            PersistenceService.loadProviderConfigs(),
            PersistenceService.loadApiKeys(),
            PersistenceService.loadSetting<string[]>(
              GLOBAL_MODEL_SORT_ORDER_KEY,
              [],
            ),
            PersistenceService.loadSetting<string | null>(
              LAST_SELECTION_KEY,
              null,
            ),
          ]);

        set({
          dbProviderConfigs: configs,
          dbApiKeys: keys,
          enableApiKeyManagement: enableApiMgmt,
        });

        const currentGloballyEnabledModels = configs.reduce(
          (acc: string[], provider) => {
            if (provider.isEnabled && provider.enabledModels) {
              provider.enabledModels.forEach((modelId) => {
                acc.push(combineModelId(provider.id, modelId));
              });
            }
            return acc;
          },
          [],
        );
        const enabledSet = new Set(currentGloballyEnabledModels);
        const validSavedOrder = savedOrder.filter((id) => enabledSet.has(id));

        let modelToSelect = lastSelectedModelId;
        const isValidSelection = modelToSelect && enabledSet.has(modelToSelect);

        if (!isValidSelection) {
          modelToSelect = validSavedOrder[0] ?? null;
          if (!modelToSelect) {
            modelToSelect = currentGloballyEnabledModels[0] ?? null;
          }
          console.log(
            `[ProviderStore] Saved selection invalid or missing, selecting default: ${modelToSelect}`,
          );
        }

        set({
          globalModelSortOrder: validSavedOrder,
          selectedModelId: modelToSelect,
          isLoading: false,
        });

        await PersistenceService.saveSetting(LAST_SELECTION_KEY, modelToSelect);
      } catch (e) {
        console.error("ProviderStore: Error loading initial data", e);
        set({
          isLoading: false,
          error: "Failed to load provider data",
        });
        toast.error("Failed to load provider data");
      }
    },

    selectModel: (combinedId) => {
      set({ selectedModelId: combinedId });
      PersistenceService.saveSetting(LAST_SELECTION_KEY, combinedId);
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
        set((state) => {
          state.dbApiKeys = state.dbApiKeys.filter((k) => k.id !== id);
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
        name: configData.name,
        type: configData.type,
        isEnabled: configData.isEnabled ?? true,
        apiKeyId: configData.apiKeyId ?? null,
        baseURL: configData.baseURL ?? null,
        enabledModels: configData.enabledModels ?? null,
        autoFetchModels: configData.autoFetchModels ?? true,
        fetchedModels: configData.fetchedModels ?? null,
        modelsLastFetchedAt: configData.modelsLastFetchedAt ?? null,
      };
      try {
        await PersistenceService.saveProviderConfig(newConfig);
        set((state) => {
          state.dbProviderConfigs.push(newConfig);
        });
        toast.success(`Provider "${configData.name}" added.`);
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
      const originalConfig = get().dbProviderConfigs.find((p) => p.id === id);
      if (!originalConfig) {
        console.warn(`ProviderStore: Config ${id} not found for update.`);
        return;
      }

      const updatedConfigData: DbProviderConfig = {
        ...originalConfig,
        ...changes,
        updatedAt: new Date(),
      };

      try {
        await PersistenceService.saveProviderConfig(updatedConfigData);
        set((state) => {
          const index = state.dbProviderConfigs.findIndex((p) => p.id === id);
          if (index !== -1) {
            state.dbProviderConfigs[index] = updatedConfigData;
          }
        });

        const currentOrder = get().globalModelSortOrder;
        const configs = get().dbProviderConfigs;

        let newOrder = [...currentOrder];
        let selectionNeedsValidation = false;

        const currentGloballyEnabledModels = configs.reduce(
          (acc: string[], provider) => {
            if (provider.isEnabled && provider.enabledModels) {
              provider.enabledModels.forEach((modelId) => {
                acc.push(combineModelId(provider.id, modelId));
              });
            }
            return acc;
          },
          [],
        );
        const enabledSet = new Set(currentGloballyEnabledModels);
        newOrder = currentOrder.filter((mId) => enabledSet.has(mId));

        enabledSet.forEach((mId) => {
          if (!newOrder.includes(mId)) {
            newOrder.push(mId);
          }
        });

        selectionNeedsValidation = true;

        if (
          JSON.stringify(newOrder) !== JSON.stringify(currentOrder) ||
          selectionNeedsValidation
        ) {
          await get().setGlobalModelSortOrder(newOrder);
        }
      } catch (e) {
        console.error("ProviderStore: Error updating provider config", e);
        toast.error(
          `Failed to update Provider: ${e instanceof Error ? e.message : String(e)}`,
        );
        throw e;
      }
    },

    deleteProviderConfig: async (id) => {
      const config = get().dbProviderConfigs.find((p) => p.id === id);
      if (!config) return;
      const configName = config.name;

      try {
        await PersistenceService.deleteProviderConfig(id);

        set((state) => {
          state.dbProviderConfigs = state.dbProviderConfigs.filter(
            (p) => p.id !== id,
          );
        });

        const configs = get().dbProviderConfigs;
        const currentGloballyEnabledModels = configs.reduce(
          (acc: string[], provider) => {
            if (provider.isEnabled && provider.enabledModels) {
              provider.enabledModels.forEach((modelId) => {
                acc.push(combineModelId(provider.id, modelId));
              });
            }
            return acc;
          },
          [],
        );
        const enabledSet = new Set(currentGloballyEnabledModels);
        const currentOrder = get().globalModelSortOrder;
        const newOrder = currentOrder.filter((mId) => enabledSet.has(mId));

        await get().setGlobalModelSortOrder(newOrder);

        toast.success(`Provider "${configName}" deleted.`);
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

    setGlobalModelSortOrder: async (combinedIds) => {
      const uniqueIds = Array.from(new Set(combinedIds));
      set({ globalModelSortOrder: uniqueIds });
      await PersistenceService.saveSetting(
        GLOBAL_MODEL_SORT_ORDER_KEY,
        uniqueIds,
      );

      const currentSelected = get().selectedModelId;
      const configs = get().dbProviderConfigs;
      const currentGloballyEnabledModels = configs.reduce(
        (acc: string[], provider) => {
          if (provider.isEnabled && provider.enabledModels) {
            provider.enabledModels.forEach((modelId) => {
              acc.push(combineModelId(provider.id, modelId));
            });
          }
          return acc;
        },
        [],
      );
      const enabledIdsSet = new Set(currentGloballyEnabledModels);

      if (currentSelected && !enabledIdsSet.has(currentSelected)) {
        const firstValid =
          uniqueIds.find((id) => enabledIdsSet.has(id)) ??
          currentGloballyEnabledModels.find((id) => uniqueIds.includes(id)) ??
          currentGloballyEnabledModels[0] ??
          null;
        console.log(
          `[ProviderStore] Selection ${currentSelected} invalidated by order change. Selecting ${firstValid}`,
        );
        get().selectModel(firstValid);
      } else if (!currentSelected && uniqueIds.length > 0) {
        const firstValid =
          uniqueIds.find((id) => enabledIdsSet.has(id)) ??
          currentGloballyEnabledModels[0] ??
          null;
        console.log(
          `[ProviderStore] No selection, selecting first from new order: ${firstValid}`,
        );
        get().selectModel(firstValid);
      }
    },

    _setProviderFetchStatus: (providerId, status) => {
      set((state) => {
        state.providerFetchStatus[providerId] = status;
      });
    },

    // --- Selectors ---
    getSelectedModel: () => {
      const { selectedModelId, dbProviderConfigs, dbApiKeys } = get();
      if (!selectedModelId) return undefined;

      const { providerId, modelId } = splitModelId(selectedModelId);
      if (!providerId || !modelId) return undefined;

      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config) return undefined;

      const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
      return createAiModelConfig(config, modelId, apiKeyRecord?.value);
    },

    getApiKeyForProvider: (providerId) => {
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      return get().dbApiKeys.find((k) => k.id === config?.apiKeyId)?.value;
    },

    getActiveProviders: () => {
      return get()
        .dbProviderConfigs.filter((p: DbProviderConfig) => p.isEnabled)
        .map((c: DbProviderConfig): AiProviderConfig => {
          const providerTypeKey = c.type as keyof typeof DEFAULT_MODELS;
          const allAvailable = [
            ...(c.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || [])),
          ];
          return {
            id: c.id,
            name: c.name,
            type: c.type,
            allAvailableModels: allAvailable,
          };
        });
    },

    getAllAvailableModelDefsForProvider: (providerConfigId) => {
      const config = get().dbProviderConfigs.find(
        (p) => p.id === providerConfigId,
      );
      if (!config) return [];
      const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
      return [
        ...(config.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || [])),
      ].map((m) => ({ ...m }));
    },
  })),
);
