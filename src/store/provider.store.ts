// src/store/provider.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbProviderConfig,
  DbApiKey,
  AiProviderConfig,
  AiModelConfig,
} from "@/types/litechat/provider"; // Removed DbProviderType import
import { PersistenceService } from "@/services/persistence.service";
import {
  createAiModelConfig,
  getDefaultModelIdForProvider,
  DEFAULT_MODELS,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";

type FetchStatus = "idle" | "fetching" | "error" | "success";

// Export ProviderState for use in components
export interface ProviderState {
  dbProviderConfigs: DbProviderConfig[];
  dbApiKeys: DbApiKey[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  providerFetchStatus: Record<string, FetchStatus>;
  isLoading: boolean;
  error: string | null;
  enableApiKeyManagement: boolean; // Added property
}

interface ProviderActions {
  loadInitialData: () => Promise<void>;
  selectProvider: (id: string | null) => void;
  selectModel: (id: string | null) => void;
  // Updated addApiKey signature
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
  // Action to set the flag (optional, could be loaded from env/config)
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
    enableApiKeyManagement: true, // Default value, load from settings/env if needed

    // Action to set the flag
    setEnableApiKeyManagement: (enabled) => {
      set({ enableApiKeyManagement: enabled });
      // Optionally persist this setting if it's user-configurable
      // PersistenceService.saveSetting('enableApiKeyManagement', enabled);
    },

    // Actions
    loadInitialData: async () => {
      set({ isLoading: true, error: null });
      try {
        // Load API key management setting if persisted
        const enableApiMgmt = await PersistenceService.loadSetting<boolean>(
          "enableApiKeyManagement",
          true,
        ); // Load setting or use default

        const [configs, keys] = await Promise.all([
          PersistenceService.loadProviderConfigs(),
          PersistenceService.loadApiKeys(),
        ]);
        set({
          dbProviderConfigs: configs,
          dbApiKeys: keys,
          enableApiKeyManagement: enableApiMgmt,
        }); // Set loaded value

        const lastSelection = await PersistenceService.loadSetting<{
          providerId: string | null;
          modelId: string | null;
        }>("providerLastSelection", { providerId: null, modelId: null });

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
          const providerTypeKey =
            providerConfig?.type as keyof typeof DEFAULT_MODELS;
          const availableModels =
            providerConfig?.fetchedModels ??
            (providerConfig ? DEFAULT_MODELS[providerTypeKey] || [] : []);
          const enabledModelIds = providerConfig?.enabledModels ?? [];
          const modelsToConsider =
            enabledModelIds.length > 0
              ? availableModels.filter((m) => enabledModelIds.includes(m.id))
              : availableModels;

          const modelIsValid = modelsToConsider.some(
            (m) => m.id === modelToSelect,
          );

          if (!modelIsValid) {
            modelToSelect = null;
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
        PersistenceService.saveSetting("providerLastSelection", {
          providerId: providerToSelect,
          modelId: modelToSelect,
        });
      } catch (e) {
        console.error("ProviderStore: Error loading initial data", e);
        set({
          isLoading: false,
          error: "Failed to load provider data",
        });
      }
    },

    selectProvider: (id) => {
      const config = get().dbProviderConfigs.find((p) => p.id === id);
      const modelId = getDefaultModelIdForProvider(config);
      set({ selectedProviderId: id, selectedModelId: modelId });
      PersistenceService.saveSetting("providerLastSelection", {
        providerId: id,
        modelId: modelId,
      });
    },

    selectModel: (id) => {
      set({ selectedModelId: id });
      PersistenceService.saveSetting("providerLastSelection", {
        providerId: get().selectedProviderId,
        modelId: id,
      });
    },

    // Updated addApiKey implementation
    addApiKey: async (name, providerId, value) => {
      const newValue = value;
      value = ""; // Clear original variable for safety
      const newId = nanoid();
      const newKey: DbApiKey = {
        id: newId,
        name,
        value: newValue,
        providerId: providerId, // Store the intended provider type/ID
        createdAt: new Date(),
        updatedAt: new Date(),
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
      let configToSave: DbProviderConfig | null = null;
      let originalConfig: DbProviderConfig | undefined;

      set((state) => {
        const index = state.dbProviderConfigs.findIndex((p) => p.id === id);
        if (index !== -1) {
          originalConfig = { ...state.dbProviderConfigs[index] };
          Object.assign(state.dbProviderConfigs[index], {
            ...changes,
            updatedAt: new Date(),
          });
          configToSave = state.dbProviderConfigs[index];
        } else {
          console.warn(`ProviderStore: Config ${id} not found for update.`);
        }
      });

      if (configToSave) {
        try {
          await PersistenceService.saveProviderConfig(configToSave);
          if (get().selectedProviderId === id) {
            if (!configToSave.isEnabled) {
              const firstEnabled = get().dbProviderConfigs.find(
                (p) => p.isEnabled,
              );
              get().selectProvider(firstEnabled?.id ?? null);
            } else {
              const currentModelId = get().selectedModelId;
              const defaultModelId = getDefaultModelIdForProvider(configToSave);
              const providerTypeKey =
                configToSave.type as keyof typeof DEFAULT_MODELS;
              const availableModels =
                configToSave.fetchedModels ??
                (DEFAULT_MODELS[providerTypeKey] || []);
              const enabledModelIds = configToSave.enabledModels ?? [];
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
              }
            }
          }
        } catch (e) {
          console.error("ProviderStore: Error updating provider config", e);
          toast.error(
            `Failed to update Provider: ${e instanceof Error ? e.message : String(e)}`,
          );
          set((state) => {
            const index = state.dbProviderConfigs.findIndex((p) => p.id === id);
            if (index !== -1 && originalConfig) {
              state.dbProviderConfigs[index] = originalConfig;
            }
          });
          throw e;
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
        toast.error("Provider not found for fetching models.");
        return;
      }
      if (get().providerFetchStatus[providerConfigId] === "fetching") return;

      get()._setProviderFetchStatus(providerConfigId, "fetching");
      try {
        const apiKey = get().getApiKeyForProvider(providerConfigId);
        console.log(
          `[ProviderStore] TODO: Implement actual fetchModelsForProvider service call for ${config.name}`,
        );
        // Placeholder fetch logic
        const fetched: { id: string; name: string }[] = [
          {
            id: `fetched-${config.type}-${Date.now() % 100}`,
            name: `Fetched ${config.type} ${Date.now() % 100}`,
          },
          {
            id: `fetched-${config.type}-other`,
            name: `Fetched ${config.type} Other`,
          },
          ...(DEFAULT_MODELS[config.type as keyof typeof DEFAULT_MODELS] || []),
        ];
        await get().updateProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });
        get()._setProviderFetchStatus(providerConfigId, "success");
        toast.success(`Models fetched successfully for ${config.name}`);
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get()._setProviderFetchStatus(providerConfigId, "error");
        toast.error(
          `Failed to fetch models for ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
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
            ) // Added type
          : allAvailable;

      const sortOrder = config.modelSortOrder ?? [];
      if (sortOrder.length > 0 && displayModels.length > 0) {
        const orderedList: { id: string; name: string }[] = [];
        const addedIds = new Set<string>();
        const displayModelMap = new Map(
          displayModels.map((m: { id: string; name: string }) => [m.id, m]), // Added type
        );

        for (const modelId of sortOrder) {
          const model = displayModelMap.get(modelId);
          if (model && !addedIds.has(modelId)) {
            orderedList.push(model);
            addedIds.add(modelId);
          }
        }
        const remaining = displayModels
          .filter((m: { id: string }) => !addedIds.has(m.id)) // Added type
          .sort((a: { name: string }, b: { name: string }) =>
            a.name.localeCompare(b.name),
          ); // Added type
        displayModels = [...orderedList, ...remaining];
      } else {
        displayModels.sort((a: { name: string }, b: { name: string }) =>
          a.name.localeCompare(b.name),
        ); // Added type
      }

      const aiModels = displayModels.map((m: { id: string; name: string }) => ({
        // Added type
        id: m.id,
        name: m.name,
        instance: null,
      }));

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
      const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId); // Removed unused apiKey variable
      return createAiModelConfig(config, selectedModelId, apiKeyRecord?.value); // Pass value directly
    },

    getApiKeyForProvider: (providerId) => {
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      return get().dbApiKeys.find((k) => k.id === config?.apiKeyId)?.value;
    },

    getActiveProviders: () => {
      return get()
        .dbProviderConfigs.filter((p: DbProviderConfig) => p.isEnabled) // Added type
        .map((c: DbProviderConfig) => {
          // Added type
          const providerTypeKey = c.type as keyof typeof DEFAULT_MODELS;
          const allAvailable =
            c.fetchedModels ?? (DEFAULT_MODELS[providerTypeKey] || []);

          const enabledModelIds = new Set(c.enabledModels ?? []);
          let displayModels =
            enabledModelIds.size > 0
              ? allAvailable.filter((m: { id: string }) =>
                  enabledModelIds.has(m.id),
                ) // Added type
              : allAvailable;

          const sortOrder = c.modelSortOrder ?? [];
          if (sortOrder.length > 0 && displayModels.length > 0) {
            const orderedList: { id: string; name: string }[] = [];
            const addedIds = new Set<string>();
            const displayModelMap = new Map(
              displayModels.map((m: { id: string; name: string }) => [m.id, m]), // Added type
            );
            for (const modelId of sortOrder) {
              const model = displayModelMap.get(modelId);
              if (model && !addedIds.has(modelId)) {
                orderedList.push(model);
                addedIds.add(modelId);
              }
            }
            const remaining = displayModels
              .filter((m: { id: string }) => !addedIds.has(m.id)) // Added type
              .sort((a: { name: string }, b: { name: string }) =>
                a.name.localeCompare(b.name),
              ); // Added type
            displayModels = [...orderedList, ...remaining];
          } else {
            displayModels.sort((a: { name: string }, b: { name: string }) =>
              a.name.localeCompare(b.name),
            ); // Added type
          }

          const aiModels = displayModels.map(
            (m: { id: string; name: string }) => ({
              // Added type
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
        });
    },
  })),
);
