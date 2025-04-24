// src/store/provider.store.ts
import { create } from "zustand";
import type { DbApiKey, DbProviderConfig } from "@/lib/types";
import { toast } from "sonner";
import { db } from "@/lib/db"; // Import db
import { fetchModelsForProvider } from "@/services/model-fetcher";
import { nanoid } from "nanoid";
import { DEFAULT_MODELS } from "@/lib/litechat";
import { getDefaultModelIdForProvider } from "@/utils/chat-utils";

type FetchStatus = "idle" | "fetching" | "error" | "success";
const LAST_SELECTION_KEY = "provider:lastSelection"; // Changed key prefix

export interface ProviderState {
  enableApiKeyManagement: boolean;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  providerFetchStatus: Record<string, FetchStatus>;
}

export interface ProviderActions {
  loadInitialProviderSettings: () => Promise<void>;
  setEnableApiKeyManagement: (enabled: boolean) => void;
  setSelectedProviderId: (
    id: string | null,
    currentConfigs: DbProviderConfig[], // Keep for setting default model logic
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
    currentConfigs: DbProviderConfig[],
    currentApiKeys: DbApiKey[],
  ) => Promise<void>;
  setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  // REMOVED currentConfigs argument from loadInitialSelection signature
  loadInitialSelection: () => Promise<{
    providerId: string | null;
    modelId: string | null;
  }>;
  getApiKeyForProvider: (
    providerId: string,
    currentApiKeys: DbApiKey[],
    currentConfigs: DbProviderConfig[],
  ) => string | undefined;
}

// Helper to save a setting to DB
const saveProviderSetting = async (key: string, value: any) => {
  try {
    await db.appState.put({ key: `provider:${key}`, value });
  } catch (error) {
    console.error(`Failed to save provider setting ${key}:`, error);
    toast.error(`Failed to save provider setting: ${key}`);
  }
};

// Helper to load a setting from DB
const loadProviderSetting = async <T>(
  key: string,
  defaultValue: T,
): Promise<T> => {
  try {
    const setting = await db.appState.get(`provider:${key}`);
    return setting?.value !== undefined ? (setting.value as T) : defaultValue;
  } catch (error) {
    console.error(`Failed to load provider setting ${key}:`, error);
    toast.error(`Failed to load provider setting: ${key}`);
    return defaultValue;
  }
};

const saveSelectionToDb = async (
  providerId: string | null,
  modelId: string | null,
) => {
  try {
    await db.appState.put({
      key: LAST_SELECTION_KEY,
      value: { providerId, modelId },
    });
    console.log(
      `[ProviderStore saveSelectionToDb] Saved: Provider=${providerId}, Model=${modelId}`,
    );
  } catch (error) {
    console.error("Failed to save selection state to DB:", error);
  }
};

export const useProviderStore = create<ProviderState & ProviderActions>()(
  (set, get) => ({
    // Initial State (will be overwritten)
    enableApiKeyManagement: true,
    selectedProviderId: null,
    selectedModelId: null,
    providerFetchStatus: {},

    loadInitialProviderSettings: async () => {
      console.log(
        "[ProviderStore] Loading initial provider settings from DB...",
      );
      const loadedEnableApiKeyManagement = await loadProviderSetting(
        "enableApiKeyManagement",
        true,
      );
      console.log(
        "[ProviderStore] Loaded enableApiKeyManagement:",
        loadedEnableApiKeyManagement,
      );
      set({ enableApiKeyManagement: loadedEnableApiKeyManagement });
    },

    setEnableApiKeyManagement: (enableApiKeyManagement) => {
      set({ enableApiKeyManagement });
      saveProviderSetting("enableApiKeyManagement", enableApiKeyManagement);
    },

    setSelectedProviderId: (id, currentConfigs) => {
      const targetProviderConfig = currentConfigs.find(
        (p: DbProviderConfig) => p.id === id,
      );
      const defaultModelId = getDefaultModelIdForProvider(targetProviderConfig);

      console.log(
        `[ProviderStore setSelectedProviderId] Setting Provider=${id}, Default Model=${defaultModelId}`,
      );
      set({ selectedProviderId: id, selectedModelId: defaultModelId });
      saveSelectionToDb(id, defaultModelId);
    },

    setSelectedModelId: (selectedModelId) => {
      const currentProviderId = get().selectedProviderId;
      console.log(
        `[ProviderStore setSelectedModelId] Setting Model=${selectedModelId} for Provider=${currentProviderId}`,
      );
      set({ selectedModelId });
      saveSelectionToDb(currentProviderId, selectedModelId);
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
          providerId,
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
            const updates = configsToUpdate.map((config: DbProviderConfig) =>
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
        if (get().selectedProviderId === null && newConfig.isEnabled) {
          const allConfigs = await db.providerConfigs.toArray();
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
        if (get().selectedProviderId === id) {
          const updatedConfig = await db.providerConfigs.get(id);
          if (!updatedConfig) {
            console.warn(
              `Selected provider ${id} disappeared after update, finding fallback.`,
            );
            const allConfigs = await db.providerConfigs.toArray();
            const firstEnabled = allConfigs.find(
              (c: DbProviderConfig) => c.isEnabled,
            );
            get().setSelectedProviderId(firstEnabled?.id ?? null, allConfigs);
          } else if (!updatedConfig.isEnabled) {
            console.log(
              `Selected provider ${id} was disabled, finding fallback.`,
            );
            const allConfigs = await db.providerConfigs.toArray();
            const firstEnabled = allConfigs.find(
              (c: DbProviderConfig) => c.isEnabled,
            );
            get().setSelectedProviderId(firstEnabled?.id ?? null, allConfigs);
          } else {
            const currentModelId = get().selectedModelId;
            const defaultModelId = getDefaultModelIdForProvider(updatedConfig);

            const providerTypeKey =
              updatedConfig.type as keyof typeof DEFAULT_MODELS;
            const availableModels =
              updatedConfig.fetchedModels ??
              (DEFAULT_MODELS[providerTypeKey] || []);

            const enabledModelIds = updatedConfig.enabledModels ?? [];
            const modelsToConsider =
              enabledModelIds.length > 0
                ? availableModels.filter((m: { id: string }) =>
                    enabledModelIds.includes(m.id),
                  )
                : availableModels;

            const currentModelStillValid = modelsToConsider.some(
              (m: { id: string }) => m.id === currentModelId,
            );

            if (!currentModelStillValid) {
              console.log(
                `Selected model ${currentModelId} no longer valid/enabled for ${id}, selecting default: ${defaultModelId}`,
              );
              get().setSelectedModelId(defaultModelId);
            } else {
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

        if (wasSelected) {
          console.log(`Selected provider ${id} was deleted, finding fallback.`);
          const allConfigs = await db.providerConfigs.toArray();
          const firstEnabled = allConfigs.find(
            (c: DbProviderConfig) => c.isEnabled,
          );
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
      const config = currentConfigs.find(
        (p: DbProviderConfig) => p.id === providerConfigId,
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

      get().setProviderFetchStatus(providerConfigId, "fetching");
      try {
        const apiKeyId = config.apiKeyId;
        const apiKey = currentApiKeys.find(
          (k: DbApiKey) => k.id === apiKeyId,
        )?.value;
        const fetched = await fetchModelsForProvider(config, apiKey);
        await get().updateDbProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get().setProviderFetchStatus(providerConfigId, "success");
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get().setProviderFetchStatus(providerConfigId, "error");
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

    // --- Modified loadInitialSelection ---
    loadInitialSelection: async () => {
      console.log("[ProviderStore loadInitialSelection] Starting...");
      try {
        // Fetch provider configs directly from DB within the action
        const currentConfigs = await db.providerConfigs.toArray();
        console.log(
          `[ProviderStore loadInitialSelection] Fetched ${currentConfigs.length} configs directly from DB.`,
        );

        const lastSelectionState = await db.appState.get(LAST_SELECTION_KEY);
        console.log(
          "[ProviderStore loadInitialSelection] Loaded from DB:",
          lastSelectionState,
        );

        if (lastSelectionState?.value) {
          const savedProviderId = lastSelectionState.value.providerId ?? null;
          const savedModelId = lastSelectionState.value.modelId ?? null;
          console.log(
            `[ProviderStore loadInitialSelection] Saved state: Provider=${savedProviderId}, Model=${savedModelId}`,
          );

          // Validate against the freshly fetched configs
          const savedProviderConfig = currentConfigs.find(
            (p: DbProviderConfig) => p.id === savedProviderId && p.isEnabled,
          );

          if (savedProviderConfig) {
            console.log(
              `[ProviderStore loadInitialSelection] Found valid saved provider config: ${savedProviderId}`,
            );

            const providerTypeKey =
              savedProviderConfig.type as keyof typeof DEFAULT_MODELS;
            const availableModels =
              savedProviderConfig.fetchedModels ??
              (DEFAULT_MODELS[providerTypeKey] || []);

            const enabledModelIds = savedProviderConfig.enabledModels ?? [];
            const modelsToConsider =
              enabledModelIds.length > 0
                ? availableModels.filter((m: { id: string }) =>
                    enabledModelIds.includes(m.id),
                  )
                : availableModels;

            const modelExistsAndIsValid = modelsToConsider.some(
              (m: { id: string }) => m.id === savedModelId,
            );

            if (modelExistsAndIsValid) {
              console.log(
                `[ProviderStore loadInitialSelection] Saved model ${savedModelId} is valid. Returning saved selection.`,
              );
              return { providerId: savedProviderId, modelId: savedModelId };
            } else {
              const defaultModelId =
                getDefaultModelIdForProvider(savedProviderConfig);
              console.log(
                `[ProviderStore loadInitialSelection] Saved model ${savedModelId} invalid/disabled, returning saved provider with default model: ${defaultModelId}`,
              );
              return { providerId: savedProviderId, modelId: defaultModelId };
            }
          } else {
            console.log(
              `[ProviderStore loadInitialSelection] Saved provider ${savedProviderId} not found or not enabled.`,
            );
          }
        } else {
          console.log(
            "[ProviderStore loadInitialSelection] No saved selection found in DB.",
          );
        }
      } catch (error) {
        console.error(
          "[ProviderStore] Failed to load selection from DB:",
          error,
        );
        toast.error("Failed to load last provider selection.");
      }

      console.log(
        "[ProviderStore loadInitialSelection] No valid saved state found, returning nulls.",
      );
      return { providerId: null, modelId: null };
    },
    // --- End Modified loadInitialSelection ---

    getApiKeyForProvider: (providerId, currentApiKeys, currentConfigs) => {
      const config = currentConfigs.find(
        (p: DbProviderConfig) => p.id === providerId,
      );
      if (!config || !config.apiKeyId) return undefined;
      return currentApiKeys.find((k: DbApiKey) => k.id === config.apiKeyId)
        ?.value;
    },
  }),
);
