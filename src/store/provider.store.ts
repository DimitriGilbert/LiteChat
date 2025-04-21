// src/store/provider.store.ts
import { create } from "zustand";
import type { DbApiKey, DbProviderConfig, DbProviderType } from "@/lib/types";
// FIX: Removed unused nanoid import
// import { nanoid } from "nanoid";
import { toast } from "sonner"; // Import toast for user feedback
import { db } from "@/lib/db"; // Import Dexie instance
import { fetchModelsForProvider } from "@/services/model-fetcher"; // Import fetcher
import { nanoid } from "nanoid"; // Keep nanoid for API key generation

// --- REMOVE Placeholder Dependencies ---

// Default models
const DEFAULT_MODELS: Record<DbProviderType, { id: string; name: string }[]> = {
  openai: [{ id: "gpt-4o", name: "GPT-4o" }],
  google: [
    { id: "gemini-2.5-pro-exp-03-25", name: "Gemini 2.5 Pro exp (Free)" },
    {
      id: "gemini-2.0-flash-thinking-exp-01-21",
      name: "Gemini 2.0 Flash exp (Free)",
    },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { id: "emini-2.5-pro-preview-03-25", name: "Gemini 2.5 Pro Preview" },
    { id: "gemini-2.5-flash-preview-04-17", name: "Gemini 2.5 Flash Preview" },
  ],
  openrouter: [],
  ollama: [{ id: "llama3", name: "Llama 3 (Ollama)" }],
  "openai-compatible": [],
};

// Type for fetch status
type FetchStatus = "idle" | "fetching" | "error" | "success";

export interface ProviderState {
  enableApiKeyManagement: boolean;
  selectedProviderId: string | null;
  selectedModelId: string | null;
  apiKeys: DbApiKey[];
  dbProviderConfigs: DbProviderConfig[];
  providerFetchStatus: Record<string, FetchStatus>;
}

export interface ProviderActions {
  setEnableApiKeyManagement: (enabled: boolean) => void;
  setSelectedProviderId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  setApiKeys: (keys: DbApiKey[]) => void;
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>;
  deleteApiKey: (id: string) => Promise<void>;
  setDbProviderConfigs: (configs: DbProviderConfig[]) => void;
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>;
  deleteDbProviderConfig: (id: string) => Promise<void>;
  fetchModels: (providerConfigId: string) => Promise<void>;
  setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  initializeFromDb: () => Promise<void>; // Action to load initial data
}

export const useProviderStore = create<ProviderState & ProviderActions>()(
  (set, get) => ({
    // Initial State
    enableApiKeyManagement: true,
    selectedProviderId: null,
    selectedModelId: null,
    apiKeys: [],
    dbProviderConfigs: [],
    providerFetchStatus: {},

    // Actions
    setEnableApiKeyManagement: (enableApiKeyManagement) =>
      set({ enableApiKeyManagement }),

    setSelectedProviderId: (id) => {
      const currentConfigs = get().dbProviderConfigs;
      const targetProviderConfig = currentConfigs.find((p) => p.id === id);
      let defaultModelId: string | null = null;

      if (targetProviderConfig) {
        const availableModels =
          targetProviderConfig.fetchedModels &&
          targetProviderConfig.fetchedModels.length > 0
            ? targetProviderConfig.fetchedModels
            : DEFAULT_MODELS[targetProviderConfig.type] || [];

        const enabledModelIds = targetProviderConfig.enabledModels ?? [];
        let potentialModels = availableModels;
        if (enabledModelIds.length > 0) {
          potentialModels = availableModels.filter((m) =>
            enabledModelIds.includes(m.id),
          );
          if (potentialModels.length === 0) {
            potentialModels = availableModels;
          }
        }

        const sortOrder = targetProviderConfig.modelSortOrder ?? [];
        if (sortOrder.length > 0 && potentialModels.length > 0) {
          const orderedList: { id: string; name: string }[] = [];
          const addedIds = new Set<string>();
          const potentialModelMap = new Map(
            potentialModels.map((m) => [m.id, m]),
          );

          for (const modelId of sortOrder) {
            const model = potentialModelMap.get(modelId);
            if (model && !addedIds.has(modelId)) {
              orderedList.push(model);
              addedIds.add(modelId);
            }
          }
          const remaining = potentialModels
            .filter((m) => !addedIds.has(m.id))
            .sort((a, b) => a.name.localeCompare(b.name));
          potentialModels = [...orderedList, ...remaining];
        } else {
          potentialModels.sort((a, b) => a.name.localeCompare(b.name));
        }

        defaultModelId = potentialModels[0]?.id ?? null;
      }

      set({ selectedProviderId: id, selectedModelId: defaultModelId });
    },

    setSelectedModelId: (selectedModelId) => set({ selectedModelId }),

    setApiKeys: (apiKeys) => set({ apiKeys }),

    addApiKey: async (name, providerId, value) => {
      const keyToAdd = value;
      value = ""; // Clear sensitive data immediately
      try {
        // FIX: Use db.apiKeys.add
        const newId = nanoid();
        const newKey: DbApiKey = {
          id: newId,
          name,
          providerId,
          value: keyToAdd,
          createdAt: new Date(),
        };
        await db.apiKeys.add(newKey);
        // State update via live query
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
      const keyToDelete = get().apiKeys.find((k) => k.id === id);
      if (!keyToDelete) {
        toast.error("API Key not found.");
        return;
      }
      // Optimistic update handled by live query
      try {
        // FIX: Use db.apiKeys.delete and transaction
        await db.transaction("rw", db.apiKeys, db.providerConfigs, async () => {
          await db.apiKeys.delete(id);
          const configsToUpdate = await db.providerConfigs
            .where("apiKeyId")
            .equals(id)
            .toArray();
          if (configsToUpdate.length > 0) {
            const updates = configsToUpdate.map((config) =>
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
        // Rollback handled by live query?
        throw error;
      }
    },

    setDbProviderConfigs: (dbProviderConfigs) => set({ dbProviderConfigs }),

    addDbProviderConfig: async (config) => {
      try {
        // FIX: Use db.providerConfigs.add
        const newId = nanoid();
        const now = new Date();
        const newConfig: DbProviderConfig = {
          ...config,
          id: newId,
          createdAt: now,
          updatedAt: now,
        };
        await db.providerConfigs.add(newConfig);
        // State update via live query
        toast.success(`Provider "${config.name}" added.`);
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
        // FIX: Use db.providerConfigs.update
        await db.providerConfigs.update(id, {
          ...changes,
          updatedAt: new Date(),
        });
        // State update via live query
      } catch (error) {
        console.error("Failed to update provider config:", error);
        toast.error(
          `Failed to update Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    },

    deleteDbProviderConfig: async (id) => {
      const configToDelete = get().dbProviderConfigs.find((c) => c.id === id);
      if (!configToDelete) {
        toast.error("Provider configuration not found.");
        return;
      }

      // Optimistic update for selection
      if (get().selectedProviderId === id) {
        set({ selectedProviderId: null, selectedModelId: null });
      }

      try {
        // FIX: Use db.providerConfigs.delete
        await db.providerConfigs.delete(id);
        // State update via live query
        toast.success(`Provider "${configToDelete.name}" deleted.`);
      } catch (error) {
        console.error("Failed to delete provider config:", error);
        toast.error(
          `Failed to delete Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Rollback selection if needed
        if (get().selectedProviderId === null && configToDelete) {
          // Maybe select the first available provider again?
        }
        throw error;
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

      get().setProviderFetchStatus(providerConfigId, "fetching");
      try {
        const apiKeyId = config.apiKeyId;
        const apiKey = get().apiKeys.find((k) => k.id === apiKeyId)?.value;
        const fetched = await fetchModelsForProvider(config, apiKey);

        await get().updateDbProviderConfig(providerConfigId, {
          fetchedModels: fetched,
          modelsLastFetchedAt: new Date(),
        });

        get().setProviderFetchStatus(providerConfigId, "success");
        toast.success(
          `Successfully fetched ${fetched.length} models for ${config.name}`,
        );
      } catch (error) {
        console.error(`Error fetching models for ${config.name}:`, error);
        get().setProviderFetchStatus(providerConfigId, "error");
        toast.error(
          `Failed to fetch models for ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
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

    initializeFromDb: async () => {
      try {
        const [keys, configs] = await Promise.all([
          db.apiKeys.toArray(),
          db.providerConfigs.toArray(),
        ]);
        set({ apiKeys: keys, dbProviderConfigs: configs });
        console.log("[ProviderStore] Initialized from DB.");
      } catch (error) {
        console.error("[ProviderStore] Failed to initialize from DB:", error);
        toast.error("Failed to load provider/API key data.");
      }
    },
  }),
);
