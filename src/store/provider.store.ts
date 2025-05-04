// src/store/provider.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbProviderConfig,
  DbApiKey,
  AiProviderConfig,
  AiModelConfig,
  OpenRouterModel, // Import the detailed model type
} from "@/types/litechat/provider";
import { PersistenceService } from "@/services/persistence.service";
import {
  createAiModelConfig,
  DEFAULT_MODELS,
  combineModelId,
  splitModelId,
  DEFAULT_SUPPORTED_PARAMS,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { emitter } from "@/lib/litechat/event-emitter"; // Import emitter
import { ModEvent } from "@/types/litechat/modding"; // Import ModEvent

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "provider:lastModelSelection";
const GLOBAL_MODEL_SORT_ORDER_KEY = "provider:globalModelSortOrder";

export interface ProviderState {
  dbProviderConfigs: DbProviderConfig[];
  dbApiKeys: DbApiKey[];
  selectedModelId: string | null; // Combined ID
  globalModelSortOrder: string[]; // Array of combined IDs
  providerFetchStatus: Record<string, FetchStatus>; // Keyed by providerConfigId
  isLoading: boolean;
  error: string | null;
  enableApiKeyManagement: boolean;
  // Temporary state for model details view
  _selectedModelForDetails: string | null;
}

export interface ProviderActions {
  loadInitialData: () => Promise<void>;
  selectModel: (combinedId: string | null) => void;
  addApiKey: (
    name: string,
    providerId: string, // Changed from providerType to providerId for clarity
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
  // Update return type to use OpenRouterModel
  getAllAvailableModelDefsForProvider: (
    providerConfigId: string,
  ) => OpenRouterModel[];
  _setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  setEnableApiKeyManagement: (enabled: boolean) => void;
  // Action for temporary state
  setSelectedModelForDetails: (combinedId: string | null) => void;
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
    _selectedModelForDetails: null, // Initialize temporary state

    setEnableApiKeyManagement: (enabled) => {
      set({ enableApiKeyManagement: enabled });
      PersistenceService.saveSetting("enableApiKeyManagement", enabled);
      emitter.emit(ModEvent.SETTINGS_CHANGED, {
        key: "enableApiKeyManagement",
        value: enabled,
      });
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

        // --- Recalculate valid order and selection based on loaded configs ---
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

        // Filter saved order to only include currently enabled models
        const validSavedOrder = savedOrder.filter((id) => enabledSet.has(id));

        let modelToSelect = lastSelectedModelId;
        const isValidSelection = modelToSelect && enabledSet.has(modelToSelect);

        // If saved selection is invalid or missing, find a new default
        if (!isValidSelection) {
          // Prioritize the first model from the valid saved order
          modelToSelect = validSavedOrder[0] ?? null;
          // If still no selection, take the first globally enabled model
          if (!modelToSelect) {
            modelToSelect = currentGloballyEnabledModels[0] ?? null;
          }
          console.log(
            `[ProviderStore] Saved selection invalid or missing, selecting default: ${modelToSelect}`,
          );
        }
        // --- End Recalculation ---

        set({
          globalModelSortOrder: validSavedOrder,
          selectedModelId: modelToSelect,
          isLoading: false,
        });

        // Save the potentially updated selection
        await PersistenceService.saveSetting(LAST_SELECTION_KEY, modelToSelect);
        // Emit initial selection event
        console.log(
          `[ProviderStore] Emitting initial ${ModEvent.MODEL_SELECTION_CHANGED} with payload:`,
          { modelId: modelToSelect },
        );
        emitter.emit(ModEvent.MODEL_SELECTION_CHANGED, {
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
      console.log(
        `[ProviderStore] selectModel called. Current: ${currentId}, New: ${combinedId}`,
      ); // Log call
      if (currentId !== combinedId) {
        set({ selectedModelId: combinedId });
        PersistenceService.saveSetting(LAST_SELECTION_KEY, combinedId);
        // Emit event when selection changes
        console.log(
          `[ProviderStore] Emitting ${ModEvent.MODEL_SELECTION_CHANGED} with payload:`,
          { modelId: combinedId },
        ); // Log emission
        emitter.emit(ModEvent.MODEL_SELECTION_CHANGED, {
          modelId: combinedId,
        });
      } else {
        console.log(
          `[ProviderStore] selectModel skipped: ID ${combinedId} already selected.`,
        );
      }
    },

    addApiKey: async (name, providerId, value) => {
      const newId = nanoid();
      const now = new Date();
      const newKey: DbApiKey = {
        id: newId,
        name,
        value: value,
        providerId: providerId, // Store the intended provider ID
        createdAt: now,
        updatedAt: now,
      };
      try {
        await PersistenceService.saveApiKey(newKey);
        set((state) => {
          state.dbApiKeys.push(newKey);
        });
        toast.success(`API Key "${name}" added.`);
        emitter.emit(ModEvent.API_KEY_CHANGED, {
          keyId: newId,
          action: "added",
        });
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
          // Also update provider configs that might have been using this key
          state.dbProviderConfigs = state.dbProviderConfigs.map((p) =>
            p.apiKeyId === id ? { ...p, apiKeyId: null } : p,
          );
        });
        toast.success(`API Key "${keyName}" deleted.`);
        emitter.emit(ModEvent.API_KEY_CHANGED, {
          keyId: id,
          action: "deleted",
        });
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
        emitter.emit(ModEvent.PROVIDER_CONFIG_CHANGED, {
          providerId: newId,
          config: newConfig,
        });
        // Trigger initial fetch after adding
        get()
          .fetchModels(newId)
          .catch((fetchError) => {
            console.warn(
              `[ProviderStore] Initial model fetch failed for new provider ${newId}:`,
              fetchError,
            );
            // Toast handled by fetchModels
          });
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
        emitter.emit(ModEvent.PROVIDER_CONFIG_CHANGED, {
          providerId: id,
          config: updatedConfigData,
        });

        // --- Recalculate valid order and selection after update ---
        const currentOrder = get().globalModelSortOrder;
        const configs = get().dbProviderConfigs; // Get updated configs

        let newOrder = [...currentOrder];

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

        // Filter out models that are no longer enabled
        newOrder = currentOrder.filter((mId) => enabledSet.has(mId));

        // Add any newly enabled models that aren't in the order yet
        enabledSet.forEach((mId) => {
          if (!newOrder.includes(mId)) {
            newOrder.push(mId); // Add to the end for now
          }
        });

        // Update order and potentially the selected model
        await get().setGlobalModelSortOrder(newOrder); // This handles selection validation
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
          // Remove fetch status for the deleted provider
          delete state.providerFetchStatus[id];
        });
        emitter.emit(ModEvent.PROVIDER_CONFIG_CHANGED, {
          providerId: id,
          config: { ...config, isEnabled: false }, // Indicate deletion via event
        });

        // --- Recalculate valid order and selection after delete ---
        const configs = get().dbProviderConfigs; // Get updated configs
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
        // --- End Recalculation ---

        await get().setGlobalModelSortOrder(newOrder); // This handles selection validation

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

        // Update the provider config with the fetched models
        await get().updateProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get()._setProviderFetchStatus(providerConfigId, "success");
        toast.success(`Models fetched successfully for ${config.name}`);
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get()._setProviderFetchStatus(providerConfigId, "error");
        // Toast handled by fetcher
      }
    },

    setGlobalModelSortOrder: async (combinedIds) => {
      const uniqueIds = Array.from(new Set(combinedIds));
      set({ globalModelSortOrder: uniqueIds });
      await PersistenceService.saveSetting(
        GLOBAL_MODEL_SORT_ORDER_KEY,
        uniqueIds,
      );

      // --- Validate Selection After Order Change ---
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

      // If current selection is no longer enabled, or no selection exists, pick a new default
      if (!currentSelected || !enabledIdsSet.has(currentSelected)) {
        // Find the first valid model from the *new* order
        const firstValidInNewOrder = uniqueIds.find((id) =>
          enabledIdsSet.has(id),
        );
        // Fallback to the first enabled model overall if the new order is empty or only contains invalid models
        const firstValidOverall = currentGloballyEnabledModels[0] ?? null;
        const newSelection = firstValidInNewOrder ?? firstValidOverall;

        if (newSelection !== currentSelected) {
          console.log(
            `[ProviderStore] Selection ${currentSelected} invalidated or missing. Selecting ${newSelection}`,
          );
          get().selectModel(newSelection); // This also saves the new selection and emits event
        }
      }
      // --- End Selection Validation ---
    },

    _setProviderFetchStatus: (providerId, status) => {
      set((state) => {
        state.providerFetchStatus[providerId] = status;
      });
    },

    // Action for temporary state
    setSelectedModelForDetails: (combinedId) => {
      set({ _selectedModelForDetails: combinedId });
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
      // Use the updated createAiModelConfig which handles the new metadata structure
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
          // Use getAllAvailableModelDefsForProvider to get consistent model data
          const allAvailable = get().getAllAvailableModelDefsForProvider(c.id);
          return {
            id: c.id,
            name: c.name,
            type: c.type,
            allAvailableModels: allAvailable,
          };
        });
    },

    // Update return type to use OpenRouterModel
    getAllAvailableModelDefsForProvider: (providerConfigId) => {
      const config = get().dbProviderConfigs.find(
        (p) => p.id === providerConfigId,
      );
      if (!config) return [];
      // Return fetchedModels if available, otherwise fallback to defaults (mapped)
      if (config.fetchedModels && config.fetchedModels.length > 0) {
        return [...config.fetchedModels]; // Return a copy
      }
      // Fallback to default models if fetchedModels is null or empty
      const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
      const defaultDefs = DEFAULT_MODELS[providerTypeKey] || [];
      // Map default definitions to OpenRouterModel structure
      return defaultDefs.map((m) => ({
        id: m.id,
        name: m.name,
        // metadata: m.metadata, // Fix: metadata doesn't exist on the simplified default type
        // Add other default fields based on mapToOpenRouterModel logic if needed
        context_length: 4096, // Example default
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
  })),
);
