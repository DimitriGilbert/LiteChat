// src/store/provider.store.ts
import { create } from "zustand";
import type {
  DbApiKey,
  DbProviderConfig,
  AiProviderConfig,
  AiModelConfig, // Keep AiModelConfig for potential future use in selectors
  DbProviderType,
} from "@/lib/types";
import { nanoid } from "nanoid";
import { toast } from "sonner"; // Import toast for user feedback

// --- Placeholder Dependencies ---
// These represent external dependencies that need proper injection (Task 8)

// Placeholder storage functions (simulating access via a service/hook result)
// TODO: Replace with actual injected storage service in Task 8
const storage = {
  addApiKey: async (
    name: string,
    providerId: string,
    value: string,
  ): Promise<string> => {
    console.warn("Placeholder storage.addApiKey called", {
      name,
      providerId,
      value,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const newId = nanoid();
    // Simulate adding to a DB (needed for optimistic updates elsewhere if used)
    return newId;
  },
  deleteApiKey: async (id: string): Promise<void> => {
    console.warn("Placeholder storage.deleteApiKey called", { id });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate deletion (needed for optimistic updates elsewhere if used)
  },
  addProviderConfig: async (
    configData: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> => {
    console.warn("Placeholder storage.addProviderConfig called", {
      configData,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const newId = nanoid();
    // Simulate adding to a DB
    return newId;
  },
  updateProviderConfig: async (
    id: string,
    changes: Partial<DbProviderConfig>,
  ): Promise<void> => {
    console.warn("Placeholder storage.updateProviderConfig called", {
      id,
      changes,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate update
  },
  deleteProviderConfig: async (id: string): Promise<void> => {
    console.warn("Placeholder storage.deleteProviderConfig called", { id });
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Simulate deletion
  },
};

// Placeholder fetcher service
// TODO: Replace with actual injected fetcher service in Task 8
const fetcher = {
  fetchModelsForProvider: async (
    config: DbProviderConfig,
    apiKey: string | undefined,
  ): Promise<{ id: string; name: string }[]> => {
    console.warn("Placeholder fetcher.fetchModelsForProvider called", {
      config,
      apiKey: apiKey ? "******" : undefined,
    });
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate fetch delay
    // Simulate fetch result based on type (very basic)
    if (config.type === "openai") {
      return [
        { id: "gpt-4o-sim", name: "GPT-4o (Simulated)" },
        { id: "gpt-3.5-turbo-sim", name: "GPT-3.5 Turbo (Simulated)" },
      ];
    } else if (config.type === "ollama") {
      return [{ id: "llama3-sim:latest", name: "Llama 3 (Simulated)" }];
    }
    // Simulate failure for other types or if no API key for required types
    if ((config.type === "openai" || config.type === "openrouter") && !apiKey) {
      throw new Error("Simulated API Key required");
    }
    // Default empty or throw error
    // throw new Error(`Simulated fetch error for ${config.name}`);
    return [];
  },
};
// --- End Placeholder Dependencies ---

// Default models (copied from provider-management-context for fallback logic)
// This might be better sourced from a shared constants file later
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

// Type for fetch status - can be shared or defined here
type FetchStatus = "idle" | "fetching" | "error" | "success";

export interface ProviderState {
  enableApiKeyManagement: boolean;
  // activeProviders: AiProviderConfig[]; // REMOVED - This will be derived by selectors
  selectedProviderId: string | null;
  selectedModelId: string | null;
  apiKeys: DbApiKey[];
  dbProviderConfigs: DbProviderConfig[];
  providerFetchStatus: Record<string, FetchStatus>;
}

export interface ProviderActions {
  setEnableApiKeyManagement: (enabled: boolean) => void;
  // setActiveProviders: (providers: AiProviderConfig[]) => void; // REMOVED
  setSelectedProviderId: (id: string | null) => void; // Logic updated as per instructions
  setSelectedModelId: (id: string | null) => void;
  setApiKeys: (keys: DbApiKey[]) => void; // Needed if fetched async
  addApiKey: (
    name: string,
    providerId: string,
    value: string,
  ) => Promise<string>; // Implementation needs storage access
  deleteApiKey: (id: string) => Promise<void>; // Implementation needs storage access
  setDbProviderConfigs: (configs: DbProviderConfig[]) => void; // Needed if fetched async
  addDbProviderConfig: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>; // Implementation needs storage access
  updateDbProviderConfig: (
    id: string,
    changes: Partial<DbProviderConfig>,
  ) => Promise<void>; // Implementation needs storage access
  deleteDbProviderConfig: (id: string) => Promise<void>; // Implementation needs storage access
  fetchModels: (providerConfigId: string) => Promise<void>; // Implementation needs fetcher/storage
  setProviderFetchStatus: (providerId: string, status: FetchStatus) => void;
  // Derived data (selectedProvider, selectedModel, getApiKeyForProvider) should be handled by selectors outside the store
}

export const useProviderStore = create<ProviderState & ProviderActions>()(
  (set, get) => ({
    // Initial State
    enableApiKeyManagement: true,
    // activeProviders: [], // REMOVED
    selectedProviderId: null,
    selectedModelId: null,
    apiKeys: [],
    dbProviderConfigs: [],
    providerFetchStatus: {},

    // Actions
    setEnableApiKeyManagement: (enableApiKeyManagement) =>
      set({ enableApiKeyManagement }),
    // setActiveProviders: (activeProviders) => set({ activeProviders }), // REMOVED

    setSelectedProviderId: (id) => {
      const currentConfigs = get().dbProviderConfigs;
      const targetProviderConfig = currentConfigs.find((p) => p.id === id);
      let defaultModelId: string | null = null;

      if (targetProviderConfig) {
        // Determine available models for this provider
        const availableModels =
          targetProviderConfig.fetchedModels &&
          targetProviderConfig.fetchedModels.length > 0
            ? targetProviderConfig.fetchedModels
            : DEFAULT_MODELS[targetProviderConfig.type] || [];

        // Filter by enabledModels if configured
        const enabledModelIds = targetProviderConfig.enabledModels ?? [];
        let potentialModels = availableModels;
        if (enabledModelIds.length > 0) {
          potentialModels = availableModels.filter((m) =>
            enabledModelIds.includes(m.id),
          );
          // If filtering results in no models, fall back to all available (as per context logic)
          if (potentialModels.length === 0) {
            potentialModels = availableModels;
          }
        }

        // Apply sort order if configured
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
          // Default sort if no order specified
          potentialModels.sort((a, b) => a.name.localeCompare(b.name));
        }

        // Select the first model from the final list
        defaultModelId = potentialModels[0]?.id ?? null;
      }

      // Update both provider and model ID
      set({ selectedProviderId: id, selectedModelId: defaultModelId });
    },

    setSelectedModelId: (selectedModelId) => set({ selectedModelId }),

    setApiKeys: (apiKeys) => set({ apiKeys }),

    addApiKey: async (name, providerId, value) => {
      // TODO: Replace with actual storage call in Task 8
      const keyToAdd = value; // Avoid logging sensitive value if storage fails
      value = ""; // Clear original value immediately
      try {
        const newId = await storage.addApiKey(name, providerId, keyToAdd);
        // Add to state optimistically or after confirmation? Let's add after confirmation.
        const newKey: DbApiKey = {
          id: newId,
          name,
          providerId,
          value: keyToAdd, // Store the actual value in state (consider security implications)
          createdAt: new Date(),
        };
        set((state) => ({ apiKeys: [...state.apiKeys, newKey] }));
        toast.success(`API Key "${name}" added.`);
        return newId;
      } catch (error) {
        console.error("Failed to add API key:", error);
        toast.error(
          `Failed to add API Key: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error; // Re-throw for potential UI handling
      }
    },

    deleteApiKey: async (id) => {
      // TODO: Replace with actual storage call in Task 8
      const keyToDelete = get().apiKeys.find((k) => k.id === id);
      if (!keyToDelete) {
        toast.error("API Key not found.");
        return;
      }
      // Optimistic removal from state
      set((state) => ({ apiKeys: state.apiKeys.filter((k) => k.id !== id) }));
      try {
        await storage.deleteApiKey(id);
        toast.success(`API Key "${keyToDelete.name}" deleted.`);
        // Note: The storage function should handle unlinking from providerConfigs
      } catch (error) {
        console.error("Failed to delete API key:", error);
        toast.error(
          `Failed to delete API Key: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Rollback optimistic update
        set((state) => ({ apiKeys: [...state.apiKeys, keyToDelete] }));
        throw error;
      }
    },

    setDbProviderConfigs: (dbProviderConfigs) => set({ dbProviderConfigs }),

    addDbProviderConfig: async (config) => {
      // TODO: Replace with actual storage call in Task 8
      try {
        const newId = await storage.addProviderConfig(config);
        const now = new Date();
        const newConfig: DbProviderConfig = {
          ...config,
          id: newId,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          dbProviderConfigs: [...state.dbProviderConfigs, newConfig],
        }));
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
      // TODO: Replace with actual storage call in Task 8
      const originalConfigs = get().dbProviderConfigs;
      const configToUpdate = originalConfigs.find((c) => c.id === id);
      if (!configToUpdate) {
        toast.error("Provider configuration not found.");
        throw new Error("Provider configuration not found.");
      }

      const updatedConfig = {
        ...configToUpdate,
        ...changes,
        updatedAt: new Date(),
      };

      // Optimistic update
      set({
        dbProviderConfigs: originalConfigs.map((c) =>
          c.id === id ? updatedConfig : c,
        ),
      });

      try {
        await storage.updateProviderConfig(id, changes);
        // No success toast here, often called internally (e.g., after fetch)
        // If called from UI, add toast there.
      } catch (error) {
        console.error("Failed to update provider config:", error);
        toast.error(
          `Failed to update Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Rollback optimistic update
        set({ dbProviderConfigs: originalConfigs });
        throw error;
      }
    },

    deleteDbProviderConfig: async (id) => {
      // TODO: Replace with actual storage call in Task 8
      const originalConfigs = get().dbProviderConfigs;
      const configToDelete = originalConfigs.find((c) => c.id === id);
      if (!configToDelete) {
        toast.error("Provider configuration not found.");
        return;
      }

      // Optimistic removal
      set((state) => ({
        dbProviderConfigs: state.dbProviderConfigs.filter((c) => c.id !== id),
      }));

      // If the deleted provider was selected, reset selection
      if (get().selectedProviderId === id) {
        set({ selectedProviderId: null, selectedModelId: null });
      }

      try {
        await storage.deleteProviderConfig(id);
        toast.success(`Provider "${configToDelete.name}" deleted.`);
      } catch (error) {
        console.error("Failed to delete provider config:", error);
        toast.error(
          `Failed to delete Provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Rollback optimistic update
        set({ dbProviderConfigs: originalConfigs });
        // Re-select if it was previously selected (might be complex if selection logic depends on available providers)
        if (get().selectedProviderId === null && configToDelete) {
          // Attempt to re-select if needed, though might be better handled by UI effect
        }
        throw error;
      }
    },

    fetchModels: async (providerConfigId) => {
      // TODO: Replace fetcher call with actual service call in Task 8
      // TODO: Replace updateDbProviderConfig call with direct state update or action call
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
        const fetched = await fetcher.fetchModelsForProvider(config, apiKey);

        // Update the specific provider config in the state
        // Using the update action ensures 'updatedAt' is set correctly
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
        // We don't re-throw here, the status and toast indicate the error
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
  }),
);
