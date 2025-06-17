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
  instantiateModelInstance,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { emitter } from "@/lib/litechat/event-emitter";
import {
  providerEvent,
  ProviderEventPayloads,
} from "@/types/litechat/events/provider.events";
import type { RegisteredActionHandler } from "@/types/litechat/control";

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
  getModelConfigById: (combinedId: string) => AiModelConfig | undefined;
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
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
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
      const { dbProviderConfigs, globalModelSortOrder } = get();
      // getAvailableModelListItems already provides all models with provider info
      const allModelListItems = get().getAvailableModelListItems();
      const modelItemsMap = new Map(allModelListItems.map((m) => [m.id, m]));

      // Determine which models are actually enabled across all provider configs
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

      // First, add models that are in globalModelSortOrder and are enabled
      globalModelSortOrder.forEach((combinedId) => {
        if (globallyEnabledCombinedIds.has(combinedId)) {
          const details = modelItemsMap.get(combinedId);
          if (details && !addedIds.has(combinedId)) {
            sortedEnabledModels.push(details);
            addedIds.add(combinedId);
          }
        }
      });

      // Then, add any remaining globally enabled models that weren't in the sort order
      // These can be appended, perhaps alphabetically by name for consistent fallback order
      const remainingEnabledModels = allModelListItems
        .filter(
          (item) =>
            globallyEnabledCombinedIds.has(item.id) && !addedIds.has(item.id)
        )
        .sort((a, b) => a.name.localeCompare(b.name)); // Fallback sort

      sortedEnabledModels.push(...remainingEnabledModels);

      set({ globallyEnabledModelDefinitions: sortedEnabledModels });
      emitter.emit(providerEvent.globallyEnabledModelsUpdated, {
        models: sortedEnabledModels,
      });
    },

    getGloballyEnabledModelDefinitions: () => {
      // This function should simply return the already processed and sorted list
      return get().globallyEnabledModelDefinitions;
    },

    getModelConfigById: (combinedId: string) => {
      const { dbProviderConfigs, dbApiKeys } = get();
      const { providerId, modelId } = splitModelId(combinedId);

      if (!providerId || !modelId) {
        console.warn(`[ProviderStore] Invalid combined ID for getModelConfigById: ${combinedId}`);
        return undefined;
      }

      const providerConfig = dbProviderConfigs.find(p => p.id === providerId);
      if (!providerConfig) {
        console.warn(`[ProviderStore] Could not find provider config for ID: ${providerId}`);
        return undefined;
      }

      const apiKey = dbApiKeys.find(k => k.id === providerConfig.apiKeyId)?.value;
      return get().createAiModelConfig(providerConfig, modelId, apiKey);
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
      emitter.emit(providerEvent.enableApiKeyManagementChanged, {
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
          globalModelSortOrder: savedOrder, // Set the raw sort order first
        });

        // Now, update the derived sorted list of enabled models
        get()._updateGloballyEnabledModelDefinitions();

        // Determine the model to select after the list is sorted
        const currentGloballyEnabledModels =
          get().globallyEnabledModelDefinitions.map((m) => m.id);
        const enabledSet = new Set(currentGloballyEnabledModels);

        let modelToSelect = lastSelectedModelId;
        const isValidSelection = modelToSelect && enabledSet.has(modelToSelect);

        if (!isValidSelection) {
          // If last selection is invalid, try first from current sorted list
          modelToSelect = currentGloballyEnabledModels[0] ?? null;
        }

        set({
          selectedModelId: modelToSelect,
          isLoading: false,
        });

        await PersistenceService.saveSetting(LAST_SELECTION_KEY, modelToSelect);
        emitter.emit(providerEvent.initialDataLoaded, {
          configs,
          apiKeys: keys,
          selectedModelId: modelToSelect,
          globalSortOrder: get().globalModelSortOrder, // Emit the raw sort order
        });
        // selectedModelChanged will be emitted by selectModel if it's different
        if (get().selectedModelId !== modelToSelect) {
          get().selectModel(modelToSelect);
        } else {
          // If it's the same, still emit to ensure prompt store syncs
          emitter.emit(providerEvent.selectedModelChanged, {
            modelId: modelToSelect,
          });
        }
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
        emitter.emit(providerEvent.selectedModelChanged, {
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
        emitter.emit(providerEvent.apiKeysChanged, {
          apiKeys: get().dbApiKeys,
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
        emitter.emit(providerEvent.apiKeysChanged, {
          apiKeys: get().dbApiKeys,
        });
        emitter.emit(providerEvent.configsChanged, {
          providerConfigs: get().dbProviderConfigs,
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
        emitter.emit(providerEvent.configsChanged, {
          providerConfigs: get().dbProviderConfigs,
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
        get()._updateGloballyEnabledModelDefinitions(); // This will re-sort and emit
        emitter.emit(providerEvent.configsChanged, {
          // Emit that configs changed
          providerConfigs: get().dbProviderConfigs,
        });
        // No need to call setGlobalModelSortOrder here, _updateGloballyEnabledModelDefinitions handles it
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
        get()._updateGloballyEnabledModelDefinitions(); // This will re-sort and emit
        emitter.emit(providerEvent.configsChanged, {
          // Emit that configs changed
          providerConfigs: get().dbProviderConfigs,
        });
        // No need to call setGlobalModelSortOrder here
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
        // updateProviderConfig will call _updateGloballyEnabledModelDefinitions
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
      // This will re-sort the globallyEnabledModelDefinitions and emit the update
      get()._updateGloballyEnabledModelDefinitions();
      emitter.emit(providerEvent.globalModelSortOrderChanged, {
        // Emit that the raw sort order changed
        ids: uniqueIds,
      });

      // Re-evaluate selected model
      const currentSelected = get().selectedModelId;
      const currentGloballyEnabledModels =
        get().globallyEnabledModelDefinitions.map((m) => m.id);
      const enabledIdsSet = new Set(currentGloballyEnabledModels);

      if (!currentSelected || !enabledIdsSet.has(currentSelected)) {
        const newSelection = currentGloballyEnabledModels[0] ?? null;
        if (newSelection !== currentSelected) {
          get().selectModel(newSelection);
        }
      }
    },

    _setProviderFetchStatus: (providerId, status) => {
      set((state) => {
        state.providerFetchStatus[providerId] = status;
      });
      emitter.emit(providerEvent.fetchStatusChanged, {
        providerId,
        status,
      });
    },

    setSelectedModelForDetails: (combinedId) => {
      set({ _selectedModelForDetails: combinedId });
      emitter.emit(providerEvent.selectedModelForDetailsChanged, {
        modelId: combinedId,
      });
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
      return defaultDefs.map((m) => {
        // Determine modalities based on model type
        let modality = "text->text";
        let input_modalities = ["text"];
        let output_modalities = ["text"];
        
        // Check if this is an image generation model
        if (m.id.includes("dall-e") || m.id.includes("imagen") || m.id.includes("flux") || m.id.includes("stable-diffusion")) {
          modality = "text->image";
          input_modalities = ["text"];
          output_modalities = ["image"];
        }
        
        return {
          id: m.id,
          name: m.name,
          context_length: 4096, // Default placeholder
          architecture: {
            modality,
            input_modalities,
            output_modalities,
          },
          pricing: { prompt: "0", completion: "0" }, // Default placeholder
          top_provider: { context_length: 4096 }, // Default placeholder
          supported_parameters: DEFAULT_SUPPORTED_PARAMS[config.type] ?? [],
        };
      });
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
              output_modalities: modelDef.architecture?.output_modalities,
              pricing: modelDef.pricing,
              description: modelDef.description,
            },
          });
        });
      });
      return listItems;
    },
    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "providerStore";
      const actions = get();

      return [
        {
          eventName: providerEvent.loadInitialDataRequest,
          handler: actions.loadInitialData,
          storeId,
        },
        {
          eventName: providerEvent.selectModelRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.selectModelRequest]
          ) => actions.selectModel(p.modelId),
          storeId,
        },
        {
          eventName: providerEvent.addApiKeyRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.addApiKeyRequest]
          ) => actions.addApiKey(p.name, p.providerId, p.value).then(() => {}),
          storeId,
        },
        {
          eventName: providerEvent.deleteApiKeyRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.deleteApiKeyRequest]
          ) => actions.deleteApiKey(p.id),
          storeId,
        },
        {
          eventName: providerEvent.addProviderConfigRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.addProviderConfigRequest]
          ) => actions.addProviderConfig(p).then(() => {}),
          storeId,
        },
        {
          eventName: providerEvent.updateProviderConfigRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.updateProviderConfigRequest]
          ) => actions.updateProviderConfig(p.id, p.changes),
          storeId,
        },
        {
          eventName: providerEvent.deleteProviderConfigRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.deleteProviderConfigRequest]
          ) => actions.deleteProviderConfig(p.id),
          storeId,
        },
        {
          eventName: providerEvent.fetchModelsRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.fetchModelsRequest]
          ) => actions.fetchModels(p.providerConfigId),
          storeId,
        },
        {
          eventName: providerEvent.setGlobalModelSortOrderRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.setGlobalModelSortOrderRequest]
          ) => actions.setGlobalModelSortOrder(p.ids),
          storeId,
        },
        {
          eventName: providerEvent.setEnableApiKeyManagementRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.setEnableApiKeyManagementRequest]
          ) => actions.setEnableApiKeyManagement(p.enabled),
          storeId,
        },
        {
          eventName: providerEvent.setSelectedModelForDetailsRequest,
          handler: (
            p: ProviderEventPayloads[typeof providerEvent.setSelectedModelForDetailsRequest]
          ) => actions.setSelectedModelForDetails(p.modelId),
          storeId,
        },
      ];
    },
  }))
);
