import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow"; // Keep for existing usage if any
import { toast } from "sonner";

// Import necessary stores and types
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
  DbProject,
} from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";

import { useAiInteraction } from "@/hooks/ai-interaction";
import { useChatStorage } from "./use-chat-storage";
import { useDerivedChatState } from "./use-derived-chat-state";

// Props might change slightly
interface UseLiteChatLogicProps {
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
  // Pass DB data needed for derivations if not directly from stores
  dbConversations: DbConversation[];
  dbProjects: DbProject[];
  // REMOVED: dbProviderConfigs: DbProviderConfig[];
  // REMOVED: apiKeys: DbApiKey[];
}

// Return type will be reduced
interface UseLiteChatLogicReturn {
  // REMOVED Input State & Actions (Components use useInputStore)
  // REMOVED Simple Store Actions (Components use store hooks)
  // REMOVED Simple Store State (Components use store hooks)

  // Keep Interaction Handlers (from useAiInteraction)
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;

  // Keep Utility Callbacks
  clearAllData: () => Promise<void>;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;

  // Keep Derived State (Components can use useDerivedChatState directly if preferred later)
  activeConversationData: DbConversation | null;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;

  // Keep complex actions if they coordinate multiple stores/logic
  // Example: Maybe renameItem needs to stay if it does more than just DB update
  sidebarActions: Pick<SidebarActions, "renameItem">; // Example: Keep only complex ones
  settingsActions: Pick<SettingsActions, "setSearchTerm">; // Example: Keep only complex ones
  providerActions: Pick<ProviderActions, "updateDbProviderConfig">; // Example
}

export function useLiteChatLogic(
  props: UseLiteChatLogicProps,
): UseLiteChatLogicReturn {
  const { dbConversations, dbProjects } = props;
  const storage = useChatStorage();

  // --- Get necessary state/actions from stores ONLY for logic within this hook ---
  const { selectedItemId, selectedItemType, renameItem } = useSidebarStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      renameItem: state.renameItem, // Keep if complex
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
  // Fetch provider data needed for derivations/interactions
  const {
    selectedProviderId,
    selectedModelId,
    getApiKeyForProvider,
    dbProviderConfigs, // Get from store now
    apiKeys, // Get from store now
    updateDbProviderConfig, // Keep if complex
  } = useProviderStore(
    useShallow((state) => ({
      selectedProviderId: state.selectedProviderId,
      selectedModelId: state.selectedModelId,
      getApiKeyForProvider: state.getApiKeyForProvider,
      dbProviderConfigs: state.dbProviderConfigs, // Fetch from store
      apiKeys: state.apiKeys, // Fetch from store
      updateDbProviderConfig: state.updateDbProviderConfig, // Keep if complex
    })),
  );
  const { streamingRefreshRateMs, setSearchTerm } = useSettingsStore(
    useShallow((state) => ({
      streamingRefreshRateMs: state.streamingRefreshRateMs,
      setSearchTerm: state.setSearchTerm, // Keep if complex
    })),
  );

  // --- Context Snapshot ---
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      const coreState = useCoreChatStore.getState();
      const sidebarState = useSidebarStore.getState();
      const providerState = useProviderStore.getState();
      const settingsState = useSettingsStore.getState();
      const vfsState = useVfsStore.getState();
      const currentDbConversations = dbConversations;

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
        if (
          !activeSystemPrompt &&
          settingsState.globalSystemPrompt &&
          settingsState.globalSystemPrompt.trim() !== ""
        ) {
          activeSystemPrompt = settingsState.globalSystemPrompt;
        }
      }

      const getApiKeyFunc = providerState.getApiKeyForProvider;

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
      });
    }, [dbConversations]);

  // --- Use Derived State Hook ---
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

  // --- Use AI Interaction Hook ---
  const { handleFormSubmit, stopStreaming, regenerateMessage } =
    useAiInteraction({
      selectedModel,
      selectedProvider,
      getApiKeyForProvider: useCallback(
        () => getApiKeyForProvider(selectedProviderId!),
        [getApiKeyForProvider, selectedProviderId],
      ),
      streamingRefreshRateMs,
      addMessage,
      updateMessage,
      setIsAiStreaming: setIsStreaming,
      setError,
      addDbMessage,
      getContextSnapshotForMod,
      bulkAddMessages,
      selectedItemId,
      selectedItemType,
      dbProviderConfigs,
      dbConversations,
      dbProjects,
      inputActions: { clearAllInput },
      handleSubmitCore,
      handleImageGenerationCore,
      stopStreamingCore,
      regenerateMessageCore,
      startWorkflowCore,
    });

  // --- Utility Callbacks ---
  const clearAllData = useCallback(async () => {
    // (Keep existing implementation using storage.clearAllData or db)
    if (
      window.confirm(
        `🚨 ARE YOU ABSOLUTELY SURE? 🚨

This will permanently delete ALL conversations, messages, and stored API keys from your browser. This action cannot be undone.`,
      )
    ) {
      if (
        window.confirm(
          `SECOND CONFIRMATION:

Really delete everything? Consider exporting first.`,
        )
      ) {
        try {
          await storage.clearAllData();
          toast.success("All local data cleared. Reloading the application...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error: unknown) {
          console.error("Failed to clear all data:", error);
          const message =
            error instanceof Error ? error.message : "Unknown error";
          toast.error(`Failed to clear data: ${message}`);
        }
      }
    }
  }, [storage]);

  // --- Return Structure ---
  return {
    // Interaction Handlers
    handleFormSubmit,
    stopStreaming,
    regenerateMessage,
    // Utilities
    clearAllData,
    getContextSnapshotForMod,
    // Derived State (pass through)
    activeConversationData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider, // Pass through the store's getter
    // Pass through complex actions kept in this hook
    sidebarActions: { renameItem },
    settingsActions: { setSearchTerm },
    providerActions: { updateDbProviderConfig },
  };
}
