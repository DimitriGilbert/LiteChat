// src/store/provider.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  DbProviderConfig,
  DbApiKey,
  AiProviderConfig,
  AiModelConfig,
} from "@/types/litechat/provider.types";
import { PersistenceService } from "@/services/persistence.service";
// REMOVE: import { createAiModelConfig, getDefaultModelIdForProvider } from '@/utils/chat-utils';
// ADD: Import from the new location
import {
  createAiModelConfig,
  getDefaultModelIdForProvider,
} from "@/lib/litechat/provider-helpers";
import { nanoid } from "nanoid";
import { toast } from "sonner";
// import { fetchModelsForProvider } from '@/services/model-fetcher';

type FetchStatus = "idle" | "fetching" | "error" | "success";

interface ProviderState {
  dbProviderConfigs: DbProviderConfig[];
  dbApiKeys: DbApiKey[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  providerFetchStatus: Record<string, FetchStatus>;
  isLoading: boolean;
}
interface ProviderActions {
  loadInitialData: () => Promise<void>;
  selectProvider: (id: string | null) => void;
  selectModel: (id: string | null) => void;
  addApiKey: (name: string, value: string) => Promise<string>;
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
}

export const useProviderStore = create(
  immer<ProviderState & ProviderActions>((set, get) => ({
    dbProviderConfigs: [],
    dbApiKeys: [],
    selectedProviderId: null,
    selectedModelId: null,
    providerFetchStatus: {},
    isLoading: true,

    loadInitialData: async () => {
      set({ isLoading: true });
      try {
        const [configs, keys] = await Promise.all([
          PersistenceService.loadProviderConfigs(),
          PersistenceService.loadApiKeys(),
        ]);
        set({ dbProviderConfigs: configs, dbApiKeys: keys, isLoading: false });
        const lastSelection = await PersistenceService.loadSetting(
          "providerLastSelection",
          { providerId: null, modelId: null },
        );
        get().selectProvider(lastSelection.providerId);
        if (lastSelection.providerId && lastSelection.modelId) {
          const provider = configs.find(
            (p) => p.id === lastSelection.providerId,
          );
          // Use helper function to check model validity
          const defaultModelForProvider =
            getDefaultModelIdForProvider(provider);
          const allModels = provider?.fetchedModels ?? []; // Use fetched or default logic if needed
          const enabledModels = provider?.enabledModels ?? [];
          const modelsToConsider =
            enabledModels.length > 0
              ? allModels.filter((m) => enabledModels.includes(m.id))
              : allModels;
          const modelIsValid = modelsToConsider.some(
            (m) => m.id === lastSelection.modelId,
          );

          if (modelIsValid) {
            set({ selectedModelId: lastSelection.modelId });
          } else if (defaultModelForProvider) {
            // If saved model invalid, but provider has a default, use that
            set({ selectedModelId: defaultModelForProvider });
            // Update saved selection if model changed
            PersistenceService.saveSetting("providerLastSelection", {
              providerId: lastSelection.providerId,
              modelId: defaultModelForProvider,
            });
          }
          // If no valid model found (neither saved nor default), selectedModelId remains null from selectProvider call
        }
      } catch (e) {
        set({ isLoading: false, error: "Failed load provider data" });
      }
    },
    selectProvider: (id) => {
      const config = get().dbProviderConfigs.find((p) => p.id === id);
      const modelId = getDefaultModelIdForProvider(config); // Use helper
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
    addApiKey: async (name, value) => {
      const newValue = value;
      value = "";
      const newId = nanoid();
      const newKey: DbApiKey = {
        id: newId,
        name,
        value: newValue,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await PersistenceService.saveApiKey(newKey);
      set((state) => {
        state.dbApiKeys.push(newKey);
      });
      toast.success(`API Key "${name}" added.`);
      return newId;
    },
    deleteApiKey: async (id) => {
      const keyName =
        get().dbApiKeys.find((k) => k.id === id)?.name ?? "Unknown Key";
      await PersistenceService.deleteApiKey(id);
      set((state) => ({
        dbApiKeys: state.dbApiKeys.filter((k) => k.id !== id),
        dbProviderConfigs: state.dbProviderConfigs.map((p) =>
          p.apiKeyId === id ? { ...p, apiKeyId: null } : p,
        ),
      }));
      toast.success(`API Key "${keyName}" deleted.`);
    },
    addProviderConfig: async (configData) => {
      const newId = nanoid();
      const now = new Date();
      const newConfig: DbProviderConfig = {
        id: newId,
        createdAt: now,
        updatedAt: now,
        ...configData,
      };
      await PersistenceService.saveProviderConfig(newConfig);
      set((state) => {
        state.dbProviderConfigs.push(newConfig);
      });
      toast.success(`Provider "${configData.name}" added.`);
      if (get().selectedProviderId === null && newConfig.isEnabled)
        get().selectProvider(newId);
      return newId;
    },
    updateProviderConfig: async (id, changes) => {
      let configToSave: DbProviderConfig | null = null;
      set((state) => {
        const index = state.dbProviderConfigs.findIndex((p) => p.id === id);
        if (index !== -1) {
          Object.assign(state.dbProviderConfigs[index], {
            ...changes,
            updatedAt: new Date(),
          });
          configToSave = state.dbProviderConfigs[index];
        }
      });
      if (configToSave) {
        await PersistenceService.saveProviderConfig(configToSave);
        if (get().selectedProviderId === id) {
          if (!configToSave.isEnabled) {
            const firstEnabled = get().dbProviderConfigs.find(
              (p) => p.isEnabled,
            );
            get().selectProvider(firstEnabled?.id ?? null);
          } else {
            const currentModelId = get().selectedModelId;
            const defaultModelId = getDefaultModelIdForProvider(configToSave); // Use helper
            // Re-check model validity based on potentially updated enabled/fetched models
            const allModels = configToSave.fetchedModels ?? [];
            const enabledModels = configToSave.enabledModels ?? [];
            const modelsToConsider =
              enabledModels.length > 0
                ? allModels.filter((m) => enabledModels.includes(m.id))
                : allModels;
            const modelIsValid = modelsToConsider.some(
              (m) => m.id === currentModelId,
            );

            if (!modelIsValid) get().selectModel(defaultModelId);
          }
        }
      }
    },
    deleteProviderConfig: async (id) => {
      const configName =
        get().dbProviderConfigs.find((p) => p.id === id)?.name ?? "Unknown";
      const wasSelected = get().selectedProviderId === id;
      await PersistenceService.deleteProviderConfig(id);
      set((state) => ({
        dbProviderConfigs: state.dbProviderConfigs.filter((p) => p.id !== id),
      }));
      toast.success(`Provider "${configName}" deleted.`);
      if (wasSelected) {
        const firstEnabled = get().dbProviderConfigs.find((p) => p.isEnabled);
        get().selectProvider(firstEnabled?.id ?? null);
      }
    },
    fetchModels: async (providerConfigId) => {
      const config = get().dbProviderConfigs.find(
        (p) => p.id === providerConfigId,
      );
      if (!config) {
        toast.error("Provider not found.");
        return;
      }
      if (get().providerFetchStatus[providerConfigId] === "fetching") return;
      set((state) => {
        state.providerFetchStatus[providerConfigId] = "fetching";
      });
      try {
        const apiKey = get().getApiKeyForProvider(providerConfigId);
        console.log("TODO: Implement fetchModelsForProvider service call");
        // const fetched = await fetchModelsForProvider(config, apiKey);
        const fetched: { id: string; name: string }[] = [
          { id: `fetched-${config.type}-1`, name: `Fetched ${config.type} 1` },
        ]; // Placeholder
        await get().updateProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });
        set((state) => {
          state.providerFetchStatus[providerConfigId] = "success";
        });
        toast.success(`Models fetched for ${config.name}`);
      } catch (error) {
        set((state) => {
          state.providerFetchStatus[providerConfigId] = "error";
        });
        toast.error(`Failed fetch models for ${config.name}`);
      }
    },
    getSelectedProvider: () => {
      const { selectedProviderId, dbProviderConfigs } = get();
      const config = dbProviderConfigs.find((p) => p.id === selectedProviderId);
      if (!config) return undefined;
      // TODO: Instantiate models properly
      return {
        id: config.id,
        name: config.name,
        type: config.type,
        models: [],
        allAvailableModels: config.fetchedModels ?? [],
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
      const apiKey = dbApiKeys.find((k) => k.id === config.apiKeyId)?.value;
      return createAiModelConfig(config, selectedModelId, apiKey); // Use helper
    },
    getApiKeyForProvider: (providerId) => {
      const config = get().dbProviderConfigs.find((p) => p.id === providerId);
      return get().dbApiKeys.find((k) => k.id === config?.apiKeyId)?.value;
    },
    getActiveProviders: () => {
      // TODO: Map DbProviderConfig to AiProviderConfig properly
      return get()
        .dbProviderConfigs.filter((p) => p.isEnabled)
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          models: [],
          allAvailableModels: c.fetchedModels ?? [],
        }));
    },
  })),
);
