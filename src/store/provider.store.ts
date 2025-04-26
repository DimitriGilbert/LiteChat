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
  DEFAULT_MODELS,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { fetchModelsForProvider } from "@/services/model-fetcher";

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "provider:lastModelSelection"; // Combined ID
const GLOBAL_MODEL_SORT_ORDER_KEY = "provider:globalModelSortOrder"; // Combined IDs

// Helper to combine provider and model IDs
const combineModelId = (providerId: string, modelId: string): string =>
  `${providerId}:${modelId}`;

// Helper to split combined ID
const splitModelId = (
  combinedId: string | null,
): { providerId: string | null; modelId: string | null } => {
  if (!combinedId || !combinedId.includes(":")) {
    return { providerId: null, modelId: null };
  }
  const parts = combinedId.split(":");
  // Handle potential cases where modelId itself contains ':'
  const providerId = parts[0];
  const modelId = parts.slice(1).join(":");
  return { providerId, modelId };
};

export interface ProviderState {
  dbProviderConfigs: DbProviderConfig[];
  dbApiKeys: DbApiKey[];
  selectedModelId: string | null; // Combined ID, e.g., "openai:gpt-4o"
  globalModelSortOrder: string[]; // Array of combined IDs
  providerFetchStatus: Record<string, FetchStatus>;
  isLoading: boolean;
  error: string | null;
  enableApiKeyManagement: boolean;
}

export interface ProviderActions {
  loadInitialData: () => Promise<void>;
  selectModel: (combinedId: string | null) => void; // Takes combined ID
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
  getGloballyEnabledAndOrderedModels: () => Omit<AiModelConfig, "instance">[]; // Selector for UI
  getAllAvailableModelDefsForProvider: (
    // Needed for provider edit UI
    providerConfigId: string,
  ) => { id: string; name: string }[];
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

        // Set configs and keys first, so selectors can work
        set({
          dbProviderConfigs: configs,
          dbApiKeys: keys,
          enableApiKeyManagement: enableApiMgmt,
        });

        // Calculate currently enabled models based on loaded configs
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

        set({
          globalModelSortOrder: validSavedOrder, // Use filtered order
        });

        let modelToSelect = lastSelectedModelId;

        // Validate saved selection against currently enabled models
        const isValidSelection = modelToSelect && enabledSet.has(modelToSelect);

        if (!isValidSelection) {
          // If saved selection is invalid, try the first in the (valid) sort order
          modelToSelect = validSavedOrder[0] ?? null;
          // If sort order is empty, try the first overall enabled model
          if (!modelToSelect) {
            modelToSelect = currentGloballyEnabledModels[0] ?? null;
          }
          console.log(
            `[ProviderStore] Saved selection invalid or missing, selecting default: ${modelToSelect}`,
          );
        }

        set({
          selectedModelId: modelToSelect,
          isLoading: false,
        });

        // Save the final validated selection state
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
        // No automatic selection needed
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

        // --- Update Global Sort Order & Selection ---
        const currentOrder = get().globalModelSortOrder;
        const allEnabledModels = get().getGloballyEnabledAndOrderedModels(); // Gets currently valid enabled models
        const allEnabledIdsSet = new Set(allEnabledModels.map((m) => m.id));

        let newOrder = [...currentOrder];
        let selectionNeedsValidation = false;

        // Get the set of combined IDs for *all* models associated with this provider
        const providerModelIds = (
          updatedConfigData.fetchedModels ??
          DEFAULT_MODELS[updatedConfigData.type] ??
          []
        ).map((m) => combineModelId(id, m.id));

        // Get the set of combined IDs for *enabled* models for this provider
        const providerEnabledModelIds = new Set(
          (updatedConfigData.enabledModels ?? []).map((mId) =>
            combineModelId(id, mId),
          ),
        );

        if (changes.isEnabled === false) {
          // Provider disabled: remove all its models from global order
          newOrder = newOrder.filter((mId) => !providerModelIds.includes(mId));
          selectionNeedsValidation = true; // Force re-validation
        } else if (changes.isEnabled === true || changes.enabledModels) {
          // Provider enabled or its enabled models changed
          // 1. Filter out models from this provider that are no longer enabled
          newOrder = newOrder.filter(
            (mId) =>
              !providerModelIds.includes(mId) ||
              providerEnabledModelIds.has(mId),
          );
          // 2. Add newly enabled models (that might not be in the order yet) to the end
          providerEnabledModelIds.forEach((mId) => {
            if (!newOrder.includes(mId)) {
              newOrder.push(mId);
            }
          });
          selectionNeedsValidation = true; // Force re-validation
        }

        // Persist the potentially updated global order and re-validate selection
        if (
          JSON.stringify(newOrder) !== JSON.stringify(currentOrder) ||
          selectionNeedsValidation
        ) {
          await get().setGlobalModelSortOrder(newOrder); // This handles persistence and selection validation
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

        // Remove provider's models from global sort order
        const modelsToRemove = (
          config.fetchedModels ??
          DEFAULT_MODELS[config.type] ??
          []
        ).map((m) => combineModelId(id, m.id));
        const currentOrder = get().globalModelSortOrder;
        const newOrder = currentOrder.filter(
          (mId) => !modelsToRemove.includes(mId),
        );

        // Update provider list state FIRST
        set((state) => {
          state.dbProviderConfigs = state.dbProviderConfigs.filter(
            (p) => p.id !== id,
          );
        });

        // Persist the new order and re-validate selection
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

        // Update fetchedModels, keep existing enabledModels
        await get().updateProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get()._setProviderFetchStatus(providerConfigId, "success");
        toast.success(`Models fetched successfully for ${config.name}`);
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get()._setProviderFetchStatus(providerConfigId, "error");
        // FetchModelsForProvider already shows a toast on error
      }
    },

    setGlobalModelSortOrder: async (combinedIds) => {
      const uniqueIds = Array.from(new Set(combinedIds));
      set({ globalModelSortOrder: uniqueIds });
      await PersistenceService.saveSetting(
        GLOBAL_MODEL_SORT_ORDER_KEY,
        uniqueIds,
      );

      // Re-validate selection
      const currentSelected = get().selectedModelId;
      const enabledModels = get().getGloballyEnabledAndOrderedModels(); // Gets currently valid enabled models
      const enabledIdsSet = new Set(enabledModels.map((m) => m.id));

      if (currentSelected && !enabledIdsSet.has(currentSelected)) {
        // If current selection is no longer enabled OR not in the new valid order, select a new default
        const firstValid =
          uniqueIds.find((id) => enabledIdsSet.has(id)) ??
          enabledModels[0]?.id ?? // Fallback to first overall enabled if order is empty/invalid
          null;
        console.log(
          `[ProviderStore] Selection ${currentSelected} invalidated by order change. Selecting ${firstValid}`,
        );
        get().selectModel(firstValid);
      } else if (!currentSelected && uniqueIds.length > 0) {
        // If nothing was selected, select the first valid model from the new order
        const firstValid =
          uniqueIds.find((id) => enabledIdsSet.has(id)) ??
          enabledModels[0]?.id ?? // Fallback
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
      // Pass the simple modelId to createAiModelConfig
      return createAiModelConfig(config, modelId, apiKeyRecord?.value);
    },

    getApiKeyForProvider: (providerId) => {
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      return get().dbApiKeys.find((k) => k.id === config?.apiKeyId)?.value;
    },

    getActiveProviders: () => {
      // Returns basic provider info, mainly for settings UI
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

    getGloballyEnabledAndOrderedModels: () => {
      const { dbProviderConfigs, globalModelSortOrder } = get();

      const globallyEnabledModelsMap = new Map<
        string,
        Omit<AiModelConfig, "instance">
      >();
      const enabledCombinedIds = new Set<string>();

      // First pass: collect all enabled models from enabled providers
      dbProviderConfigs.forEach((config) => {
        if (!config.isEnabled || !config.enabledModels) return;

        const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
        const allProviderModels =
          config.fetchedModels ?? DEFAULT_MODELS[providerTypeKey] ?? [];
        const providerModelsMap = new Map(
          allProviderModels.map((m) => [m.id, m]),
        );

        config.enabledModels.forEach((modelId) => {
          const combinedId = combineModelId(config.id, modelId);
          const modelDef = providerModelsMap.get(modelId);
          if (modelDef) {
            enabledCombinedIds.add(combinedId);
            globallyEnabledModelsMap.set(combinedId, {
              id: combinedId,
              name: modelDef.name || modelId,
              providerId: config.id,
              providerName: config.name,
              // Add other non-instance properties if needed later
            });
          }
        });
      });

      // Second pass: sort according to globalModelSortOrder
      const sortedModels: Omit<AiModelConfig, "instance">[] = [];
      const addedIds = new Set<string>();

      globalModelSortOrder.forEach((combinedId) => {
        if (enabledCombinedIds.has(combinedId)) {
          const details = globallyEnabledModelsMap.get(combinedId);
          if (details && !addedIds.has(combinedId)) {
            sortedModels.push(details);
            addedIds.add(combinedId);
          }
        }
      });

      // Add any remaining enabled models not present in the sort order (alphabetical)
      const remainingEnabled = Array.from(enabledCombinedIds)
        .filter((combinedId) => !addedIds.has(combinedId))
        .map((combinedId) => globallyEnabledModelsMap.get(combinedId))
        .filter((details): details is Omit<AiModelConfig, "instance"> =>
          Boolean(details),
        )
        .sort((a, b) => a.name.localeCompare(b.name));

      return [...sortedModels, ...remainingEnabled];
    },

    getAllAvailableModelDefsForProvider: (providerConfigId) => {
      const config = get().dbProviderConfigs.find(
        (p) => p.id === providerConfigId,
      );
      if (!config) return [];
      const providerTypeKey = config.type as keyof typeof DEFAULT_MODELS;
      // Ensure a copy is returned
      return [
        ...(config.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || [])),
      ];
    },
  })),
);
