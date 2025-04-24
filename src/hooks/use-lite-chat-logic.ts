// src/hooks/use-lite-chat-logic.ts
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { useSidebarStore, type SidebarActions } from "@/store/sidebar.store";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useProviderStore, type ProviderActions } from "@/store/provider.store";
import { useSettingsStore, type SettingsActions } from "@/store/settings.store";
import { useVfsStore } from "@/store/vfs.store";
import { useInputStore } from "@/store/input.store";
import type {
  DbConversation,
  AiProviderConfig,
  AiModelConfig,
  MessageContent,
} from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";

import { useAiInteraction } from "@/hooks/ai-interaction";
import { useChatStorage } from "./use-chat-storage";
import { useDerivedChatState } from "./use-derived-chat-state";

interface UseLiteChatLogicReturn {
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: {
      selectedItemId: string | null;
      contentToSendToAI: MessageContent;
      vfsContextPaths?: string[];
    },
  ) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // Expose derived state needed by UI components
  activeConversationData: DbConversation | null;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  // Expose specific actions needed by UI components (example)
  sidebarActions: Pick<SidebarActions, "renameItem">;
  settingsActions: Pick<SettingsActions, "setSearchTerm">;
  providerActions: Pick<ProviderActions, "updateDbProviderConfig">;
}

// Removed props from function signature as they are fetched from stores/storage
export function useLiteChatLogic(): UseLiteChatLogicReturn {
  // --- Fetch live data from storage ---
  const storage = useChatStorage();
  const dbConversations = storage.conversations || [];
  const dbProjects = storage.projects || [];
  const dbProviderConfigs = storage.providerConfigs || [];
  const apiKeys = storage.apiKeys || [];

  // --- Get necessary state/actions from stores using useShallow ---
  const { selectedItemId, selectedItemType, renameItem } = useSidebarStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      renameItem: state.renameItem, // Keep if needed by UI
    })),
  );
  const {
    addMessage,
    updateMessage,
    setIsStreaming,
    setError,
    addDbMessage,
    bulkAddMessages,
    handleSubmitCore,
    handleImageGenerationCore,
    stopStreamingCore,
    regenerateMessageCore,
    startWorkflowCore,
  } = useCoreChatStore(
    useShallow((state) => ({
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      setIsStreaming: state.setIsStreaming,
      setError: state.setError,
      addDbMessage: state.addDbMessage,
      bulkAddMessages: state.bulkAddMessages,
      handleSubmitCore: state.handleSubmitCore,
      handleImageGenerationCore: state.handleImageGenerationCore,
      stopStreamingCore: state.stopStreamingCore,
      regenerateMessageCore: state.regenerateMessageCore,
      startWorkflowCore: state.startWorkflowCore,
    })),
  );
  const { clearAllInput } = useInputStore(
    useShallow((state) => ({ clearAllInput: state.clearAllInput })),
  );
  const {
    selectedProviderId,
    selectedModelId,
    updateDbProviderConfig, // Keep if needed by UI
    getApiKeyForProvider: getApiKeyFromStore,
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      updateDbProviderConfig: state.updateDbProviderConfig,
      getApiKeyForProvider: state.getApiKeyForProvider,
    })),
  );
  const { streamingRefreshRateMs, setSearchTerm } = useSettingsStore(
    useShallow((state) => ({
      streamingRefreshRateMs: state.streamingRefreshRateMs,
      setSearchTerm: state.setSearchTerm, // Keep if needed by UI
    })),
  );

  // --- Create Context Snapshot Function ---
  // This function captures the current state from various stores when called.
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      // Get current state snapshots from each store
      const coreState = useCoreChatStore.getState();
      const sidebarState = useSidebarStore.getState();
      const providerState = useProviderStore.getState();
      const settingsState = useSettingsStore.getState();
      const vfsState = useVfsStore.getState();
      // Use live data fetched at the start of the hook
      const currentDbConversations = dbConversations;
      const currentApiKeys = apiKeys;
      const currentDbProviderConfigs = dbProviderConfigs;

      // Derive activeSystemPrompt based on current state
      let activeSystemPrompt: string | null = null;
      if (settingsState.enableAdvancedSettings) {
        if (sidebarState.selectedItemType === "conversation") {
          const convo = currentDbConversations.find(
            (c: DbConversation) => c.id === sidebarState.selectedItemId,
          );
          if (convo?.systemPrompt && convo.systemPrompt.trim() !== "") {
            activeSystemPrompt = convo.systemPrompt;
          }
        }
        // Fallback to global prompt if conversation-specific one isn't set
        if (
          !activeSystemPrompt &&
          settingsState.globalSystemPrompt &&
          settingsState.globalSystemPrompt.trim() !== ""
        ) {
          activeSystemPrompt = settingsState.globalSystemPrompt;
        }
      }

      // Create the API key getter function for the snapshot
      // It uses the live data captured at the start of the hook
      const getApiKeyFunc = (providerId: string) =>
        providerState.getApiKeyForProvider(
          providerId,
          currentApiKeys,
          currentDbProviderConfigs,
        );

      // Construct and freeze the snapshot object
      return Object.freeze({
        selectedItemId: sidebarState.selectedItemId,
        selectedItemType: sidebarState.selectedItemType,
        messages: coreState.messages,
        isStreaming: coreState.isStreaming,
        selectedProviderId: providerState.selectedProviderId,
        selectedModelId: providerState.selectedModelId,
        activeSystemPrompt: activeSystemPrompt,
        temperature: settingsState.temperature,
        maxTokens: settingsState.maxTokens,
        theme: settingsState.theme,
        isVfsEnabledForItem: vfsState.isVfsEnabledForItem,
        getApiKeyForProvider: getApiKeyFunc,
        // Add other necessary read-only properties here
      });
    }, [dbConversations, apiKeys, dbProviderConfigs]); // Dependencies ensure the snapshot function is stable unless underlying data sources change reference

  // --- Use Derived State Hook (pass live data) ---
  const { activeConversationData, selectedProvider, selectedModel } =
    useDerivedChatState({
      selectedItemId,
      selectedItemType,
      dbConversations,
      dbProjects,
      dbProviderConfigs,
      apiKeys,
      selectedProviderId,
      selectedModelId,
    });

  // --- API Key Getter for AI Interaction ---
  // This function needs to capture the live apiKeys and dbProviderConfigs
  // It's passed to useAiInteraction to ensure it uses fresh data when called.
  const getApiKeyForInteraction = useCallback(
    (providerId: string): string | undefined => {
      // Use the store's getter, passing the live data captured by useChatStorage
      return getApiKeyFromStore(providerId, apiKeys, dbProviderConfigs);
    },
    [apiKeys, dbProviderConfigs, getApiKeyFromStore], // Depend on live data refs
  );

  // --- Initialize AI Interaction Hook ---
  const { handleFormSubmit, stopStreaming, regenerateMessage } =
    useAiInteraction({
      selectedModel, // Pass derived state
      selectedProvider, // Pass derived state
      getApiKeyForProvider: getApiKeyForInteraction, // Pass the specific getter
      streamingRefreshRateMs, // Pass setting from store
      addMessage, // Pass action from store
      updateMessage, // Pass action from store
      setIsAiStreaming: setIsStreaming, // Pass action from store
      setError, // Pass action from store
      addDbMessage, // Pass action from store
      getContextSnapshotForMod, // Pass snapshot function
      bulkAddMessages, // Pass action from store
      selectedItemId, // Pass current selection state
      selectedItemType, // Pass current selection state
      dbProviderConfigs, // Pass live data
      dbConversations, // Pass live data
      dbProjects, // Pass live data
      inputActions: { clearAllInput }, // Pass specific input action
      // Pass core handlers from CoreChatStore
      handleSubmitCore,
      handleImageGenerationCore,
      stopStreamingCore,
      regenerateMessageCore,
      startWorkflowCore,
    });

  // --- Data Management Action ---
  const clearAllData = useCallback(async () => {
    // Confirmation dialogs
    if (
      !window.confirm(
        `🚨 ARE YOU ABSOLUTELY SURE? 🚨

This will permanently delete ALL conversations, messages, projects, API keys, provider configs, and mods from your browser. This action cannot be undone.`,
      ) ||
      !window.confirm(
        `SECOND CONFIRMATION:

Really delete everything? Consider exporting first.`,
      )
    ) {
      return; // Abort if user cancels
    }

    try {
      await storage.clearAllData(); // Call storage hook's clear function
      toast.success("All local data cleared. Reloading the application...");
      // Reload the page to reflect the cleared state
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: unknown) {
      console.error("Failed to clear all data:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to clear data: ${message}`);
    }
  }, [storage]); // Dependency on the storage hook instance

  // --- Return Value ---
  // Expose only what's needed by the UI components that use this logic hook
  return {
    handleFormSubmit,
    stopStreaming,
    regenerateMessage,
    clearAllData,
    getContextSnapshotForMod,
    // Derived state for UI
    activeConversationData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider: getApiKeyForInteraction, // Expose the getter used by AI interaction
    // Specific actions needed by UI (example)
    sidebarActions: { renameItem },
    settingsActions: { setSearchTerm },
    providerActions: { updateDbProviderConfig },
  };
}
