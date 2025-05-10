// src/store/provider.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbProviderConfig,
  DbApiKey,
  AiProviderConfig,
  AiModelConfig,
  OpenRouterModel,
  ModelListItem,
} from "@/types/litechat/provider";
import { PersistenceService } from "@/services/persistence.service";
import {
  DEFAULT_MODELS,
  combineModelId,
  splitModelId,
  DEFAULT_SUPPORTED_PARAMS,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { emitter } from "@/lib/litechat/event-emitter";
import { providerEvent, settingsEvent } from "@/types/litechat/modding"; // Updated import
import { instantiateModelInstance } from "@/lib/litechat/provider-helpers";

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "provider:lastModelSelection";
const GLOBAL_MODEL_SORT_ORDER_KEY = "provider:globalModelSortOrder";

export interface ProviderState {
  dbProviderConfigs: DbProviderConfig[];
  dbApiKeys: DbApiKey[];
  selectedModelId: string | null;
  globalModelSortOrder: string[];
  providerFetchStatus: Record<string, FetchStatus>;
  isLoading: boolean;
  error: string | null;
  enableApiKeyManagement: boolean;
  _selectedModelForDetails: string | null;
  globallyEnabledModelDefinitions: ModelListItem[];
}

export interface ProviderActions {
  loadInitialData: () => Promise<void>;
  selectModel: (combinedId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  addProviderConfig: (
    configData: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">
  ) => Promise<string>;
  updateProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>
  ) => Promise<void>;
  deleteProviderConfig: (id: string) => Promise<void>;
  fetchModels: (providerConfigId: string) => Promise<void>;
  setGlobalModelSortOrder: (combinedIds: string[]) => Promise<void>;
  getSelectedModel: () => AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  getActiveProviders: () => AiProviderConfig[];
  getAllAvailableModelDefsForProvider: (
    providerConfigId: string
  ) => OpenRouterModel[];
  getAvailableModelListItems: () => ModelListItem[];
  _setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  setEnableApiKeyManagement: (enabled: boolean) => void;
  setSelectedModelForDetails: (combinedId: string | null) => void;
  createAiModelConfig: (
    config: DbProviderConfig,
    modelId: string,
    apiKey?: string
  ) => AiModelConfig | undefined;
  _updateGloballyEnabledModelDefinitions: () => void;
  getGloballyEnabledModelDefinitions: () => ModelListItem[];
}

export const useProviderStore = create(
  immer<ProviderState & ProviderActions>((set, get) => ({
    dbProviderConfigs: [],
    dbApiKeys: [],
    selectedModelId: null,
    globalModelSortOrder: [],
    providerFetchStatus: {},
    isLoading: true,
    error: null,
    enableApiKeyManagement: true,
    _selectedModelForDetails: null,
    globallyEnabledModelDefinitions: [],

    _updateGloballyEnabledModelDefinitions: () => {
      const {
        dbProviderConfigs,
        globalModelSortOrder,
        getAvailableModelListItems,
      } = get();
      const allModelListItems = getAvailableModelListItems();
      const modelItemsMap = new Map(allModelListItems.map((m) => [m.id, m]));
      const globallyEnabledCombinedIds = new Set<string>();

      dbProviderConfigs.forEach((config) => {
        if (config.isEnabled && config.enabledModels) {
          config.enabledModels.forEach((modelId) => {
            globallyEnabledCombinedIds.add(combineModelId(config.id, modelId));
          });
        }
      });

      const sortedEnabledModels: ModelListItem[] = [];
      const addedIds = new Set<string>();

      globalModelSortOrder.forEach((combinedId) => {
        if (globallyEnabledCombinedIds.has(combinedId)) {
          const details = modelItemsMap.get(combinedId);
          if (details && !addedIds.has(combinedId)) {
            sortedEnabledModels.push(details);
            addedIds.add(combinedId);
          }
        }
      });

      allModelListItems.forEach((item) => {
        if (globallyEnabledCombinedIds.has(item.id) && !addedIds.has(item.id)) {
          sortedEnabledModels.push(item);
        }
      });
      set({ globallyEnabledModelDefinitions: sortedEnabledModels });
    },

    getGloballyEnabledModelDefinitions: () => {
      return get().globallyEnabledModelDefinitions;
    },

    createAiModelConfig: (config, modelId, apiKey) => {
      const allAvailable = get().getAllAvailableModelDefsForProvider(config.id);
      const modelInfo = allAvailable.find((m) => m.id === modelId);
      if (!modelInfo) {
        console.warn(
          `Model definition not found for ${modelId} in provider ${config.name}`
        );
        return undefined;
      }
      const instance = instantiateModelInstance(config, modelId, apiKey);
      if (!instance) {
        console.warn(
          `Failed to instantiate AI SDK instance for ${modelId} from provider ${config.name}`
        );
        return undefined;
      }
      return {
        id: combineModelId(config.id, modelId),
        name: modelInfo.name,
        providerId: config.id,
        providerName: config.name,
        instance,
        metadata: modelInfo,
      };
    },

    setEnableApiKeyManagement: (enabled) => {
      set({ enableApiKeyManagement: enabled });
      PersistenceService.saveSetting("enableApiKeyManagement", enabled);
      emitter.emit(settingsEvent.enableApiKeyManagementChanged, {
        enabled,
      });
    },

    loadInitialData: async () => {
      set({ isLoading: true, error: null });
      try {
        const enableApiMgmt = await PersistenceService.loadSetting<boolean>(
          "enableApiKeyManagement",
          true
        );
        const [configs, keys, savedOrder, lastSelectedModelId] =
          await Promise.all([
            PersistenceService.loadProviderConfigs(),
            PersistenceService.loadApiKeys(),
            PersistenceService.loadSetting<string[]>(
              GLOBAL_MODEL_SORT_ORDER_KEY,
              []
            ),
            PersistenceService.loadSetting<string | null>(
              LAST_SELECTION_KEY,
              null
            ),
          ]);

        set({
          dbProviderConfigs: configs,
          dbApiKeys: keys,
          enableApiKeyManagement: enableApiMgmt,
        });

        get()._updateGloballyEnabledModelDefinitions();
        const currentGloballyEnabledModels =
          get().globallyEnabledModelDefinitions.map((m) => m.id);
        const enabledSet = new Set(currentGloballyEnabledModels);

        const validSavedOrder = savedOrder.filter((id) => enabledSet.has(id));
        let modelToSelect = lastSelectedModelId;
        const isValidSelection = modelToSelect && enabledSet.has(modelToSelect);

        if (!isValidSelection) {
          modelToSelect = validSavedOrder[0] ?? null;
          if (!modelToSelect) {
            modelToSelect = currentGloballyEnabledModels[0] ?? null;
          }
        }

        set({
          globalModelSortOrder: validSavedOrder,
          selectedModelId: modelToSelect,
          isLoading: false,
        });

        await PersistenceService.saveSetting(LAST_SELECTION_KEY, modelToSelect);
        emitter.emit(providerEvent.modelSelectionChanged, {
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

    selectModel: (combinedId) => {
      const currentId = get().selectedModelId;
      if (currentId !== combinedId) {
        set({ selectedModelId: combinedId });
        PersistenceService.saveSetting(LAST_SELECTION_KEY, combinedId);
        emitter.emit(providerEvent.modelSelectionChanged, {
          modelId: combinedId,
        });
      }
    },

    addApiKey: async (name, providerId, value) => {
      const newId = nanoid();
      const now = new Date();
      const newKey: DbApiKey = {
        id: newId,
        name,
        value,
        providerId,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await PersistenceService.saveApiKey(newKey);
        set((state) => {
          state.dbApiKeys.push(newKey);
        });
        toast.success(`API Key "${name}" added.`);
        emitter.emit(providerEvent.apiKeyChanged, {
          keyId: newId,
          action: "added",
        });
        return newId;
      } catch (e) {
        console.error("ProviderStore: Error adding API key", e);
        toast.error(
          `Failed to add API Key: ${e instanceof Error ? e.message : String(e)}`
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
            p.apiKeyId === id ? { ...p, apiKeyId: null } : p
          );
        });
        toast.success(`API Key "${keyName}" deleted.`);
        emitter.emit(providerEvent.apiKeyChanged, {
          keyId: id,
          action: "deleted",
        });
      } catch (e) {
        console.error("ProviderStore: Error deleting API key", e);
        toast.error(
          `Failed to delete API Key: ${
            e instanceof Error ? e.message : String(e)
          }`
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
        get()._updateGloballyEnabledModelDefinitions();
        toast.success(`Provider "${configData.name}" added.`);
        emitter.emit(providerEvent.configChanged, {
          providerId: newId,
          config: newConfig,
        });
        get()
          .fetchModels(newId)
          .catch((fetchError) => {
            console.warn(
              `[ProviderStore] Initial model fetch failed for new provider ${newId}:`,
              fetchError
            );
          });
        return newId;
      } catch (e) {
        console.error("ProviderStore: Error adding provider config", e);
        toast.error(
          `Failed to add Provider: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
        throw e;
      }
    },

    updateProviderConfig: async (id, changes) => {
      const originalConfig = get().dbProviderConfigs.find((p) => p.id === id);
      if (!originalConfig) return;

      const updatedConfigData: DbProviderConfig = {
        ...originalConfig,
        ...changes,
        fetchedModels:
          changes.fetchedModels !== undefined
            ? changes.fetchedModels
            : originalConfig.fetchedModels,
        modelsLastFetchedAt:
          changes.modelsLastFetchedAt !== undefined
            ? changes.modelsLastFetchedAt
            : originalConfig.modelsLastFetchedAt,
        updatedAt: new Date(),
      };

      try {
        await PersistenceService.saveProviderConfig(updatedConfigData);
        set((state) => {
          const index = state.dbProviderConfigs.findIndex((p) => p.id === id);
          if (index !== -1) state.dbProviderConfigs[index] = updatedConfigData;
        });
        get()._updateGloballyEnabledModelDefinitions();
        emitter.emit(providerEvent.configChanged, {
          providerId: id,
          config: updatedConfigData,
        });
        const currentOrder = get().globalModelSortOrder;
        const currentGloballyEnabledModels =
          get().globallyEnabledModelDefinitions.map((m) => m.id);
        const enabledSet = new Set(currentGloballyEnabledModels);
        let newOrder = currentOrder.filter((mId) => enabledSet.has(mId));
        enabledSet.forEach((mId) => {
          if (!newOrder.includes(mId)) newOrder.push(mId);
        });
        await get().setGlobalModelSortOrder(newOrder);
      } catch (e) {
        console.error("ProviderStore: Error updating provider config", e);
        toast.error(
          `Failed to update Provider: ${
            e instanceof Error ? e.message : String(e)
          }`
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
            (p) => p.id !== id
          );
          delete state.providerFetchStatus[id];
        });
        get()._updateGloballyEnabledModelDefinitions();
        emitter.emit(providerEvent.configChanged, {
          providerId: id,
          config: { ...config, isEnabled: false },
        });
        const currentGloballyEnabledModels =
          get().globallyEnabledModelDefinitions.map((m) => m.id);
        const enabledSet = new Set(currentGloballyEnabledModels);
        const currentOrder = get().globalModelSortOrder;
        const newOrder = currentOrder.filter((mId) => enabledSet.has(mId));
        await get().setGlobalModelSortOrder(newOrder);
        toast.success(`Provider "${configName}" deleted.`);
      } catch (e) {
        console.error("ProviderStore: Error deleting provider config", e);
        toast.error(
          `Failed to delete Provider: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
        throw e;
      }
    },

    fetchModels: async (providerConfigId) => {
      const config = get().dbProviderConfigs.find(
        (p) => p.id === providerConfigId
      );
      if (!config) {
        toast.error("Provider configuration not found for fetching models.");
        return;
      }
      if (get().providerFetchStatus[providerConfigId] === "fetching") return;
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
        uniqueIds
      );
      get()._updateGloballyEnabledModelDefinitions();

      const currentSelected = get().selectedModelId;
      const enabledIdsSet = new Set(
        get().globallyEnabledModelDefinitions.map((m) => m.id)
      );

      if (!currentSelected || !enabledIdsSet.has(currentSelected)) {
        const firstValidInNewOrder = uniqueIds.find((id) =>
          enabledIdsSet.has(id)
        );
        const firstValidOverall =
          get().globallyEnabledModelDefinitions[0]?.id ?? null;
        const newSelection = firstValidInNewOrder ?? firstValidOverall;
        if (newSelection !== currentSelected) {
          get().selectModel(newSelection);
        }
      }
    },

    _setProviderFetchStatus: (providerId, status) => {
      set((state) => {
        state.providerFetchStatus[providerId] = status;
      });
    },

    setSelectedModelForDetails: (combinedId) => {
      set({ _selectedModelForDetails: combinedId });
    },

    getSelectedModel: () => {
      const { selectedModelId } = get();
      if (!selectedModelId) return undefined;
      const { providerId, modelId } = splitModelId(selectedModelId);
      if (!providerId || !modelId) return undefined;
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      if (!config) return undefined;
      const apiKeyRecord = get().dbApiKeys.find(
        (k) => k.id === config.apiKeyId
      );
      return get().createAiModelConfig(config, modelId, apiKeyRecord?.value);
    },

    getApiKeyForProvider: (providerId) => {
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      return get().dbApiKeys.find((k) => k.id === config?.apiKeyId)?.value;
    },

    getActiveProviders: () => {
      return get()
        .dbProviderConfigs.filter((p) => p.isEnabled)
        .map((c) => {
          const allAvailable = get().getAllAvailableModelDefsForProvider(c.id);
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
        (p) => p.id === providerConfigId
      );
      if (!config) return [];
      if (config.fetchedModels && config.fetchedModels.length > 0) {
        return [...config.fetchedModels];
      }
      const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
      const defaultDefs = DEFAULT_MODELS[providerTypeKey] || [];
      return defaultDefs.map((m) => ({
        id: m.id,
        name: m.name,
        context_length: 4096,
        architecture: {
          modality: "text->text",
          input_modalities: ["text"],
          output_modalities: ["text"],
        },
        pricing: { prompt: "0", completion: "0" },
        top_provider: { context_length: 4096 },
        supported_parameters: DEFAULT_SUPPORTED_PARAMS[config.type] ?? [],
      }));
    },

    getAvailableModelListItems: (): ModelListItem[] => {
      const { dbProviderConfigs } = get();
      const listItems: ModelListItem[] = [];
      dbProviderConfigs.forEach((config) => {
        const fullModelDefs = get().getAllAvailableModelDefsForProvider(
          config.id
        );
        fullModelDefs.forEach((modelDef) => {
          listItems.push({
            id: combineModelId(config.id, modelDef.id),
            name: modelDef.name,
            providerId: config.id,
            providerName: config.name,
            metadataSummary: {
              context_length:
                modelDef.top_provider?.context_length ??
                modelDef.context_length,
              supported_parameters: modelDef.supported_parameters,
              input_modalities: modelDef.architecture?.input_modalities,
              pricing: modelDef.pricing,
              description: modelDef.description,
            },
          });
        });
      });
      return listItems;
    },
  }))
);
