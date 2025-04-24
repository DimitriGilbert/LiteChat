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
  DbProject,
} from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";

import { useAiInteraction } from "@/hooks/ai-interaction";
import { useChatStorage } from "./use-chat-storage";
import { useDerivedChatState } from "./use-derived-chat-state";

interface UseLiteChatLogicProps {
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
  dbConversations: DbConversation[];
  dbProjects: DbProject[];
}

interface UseLiteChatLogicReturn {
  handleFormSubmit: (
    prompt: string,
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
  clearAllData: () => Promise<void>;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  activeConversationData: DbConversation | null;
  selectedProvider: AiProviderConfig | undefined;
  selectedModel: AiModelConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  // Pass through complex actions if needed
  sidebarActions: Pick<SidebarActions, "renameItem">;
  settingsActions: Pick<SettingsActions, "setSearchTerm">;
  providerActions: Pick<ProviderActions, "updateDbProviderConfig">;
}

export function useLiteChatLogic(
  props: UseLiteChatLogicProps,
): UseLiteChatLogicReturn {
  const { dbConversations, dbProjects } = props;
  const storage = useChatStorage();

  // --- Get necessary state/actions from stores ---
  const { selectedItemId, selectedItemType, renameItem } = useSidebarStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      renameItem: state.renameItem,
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
    updateDbProviderConfig,
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
      setSearchTerm: state.setSearchTerm,
    })),
  );
  const { providerConfigs: dbProviderConfigs, apiKeys } = useChatStorage();
  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      const coreState = useCoreChatStore.getState();
      const sidebarState = useSidebarStore.getState();
      const providerState = useProviderStore.getState();
      const settingsState = useSettingsStore.getState();
      const vfsState = useVfsStore.getState();
      const currentDbConversations = dbConversations;
      const currentApiKeys = apiKeys || [];
      const currentDbProviderConfigs = dbProviderConfigs || [];

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

      // Use the store's getter, passing the live data
      const getApiKeyFunc = (providerId: string) =>
        providerState.getApiKeyForProvider(
          providerId,
          currentApiKeys,
          currentDbProviderConfigs,
        );

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
    }, [dbConversations, apiKeys, dbProviderConfigs]);

  // --- Use Derived State Hook (pass live data) ---
  const { activeConversationData, selectedProvider, selectedModel } =
    useDerivedChatState({
      selectedItemId,
      selectedItemType,
      dbConversations,
      dbProjects,
      dbProviderConfigs: dbProviderConfigs || [],
      apiKeys: apiKeys || [],
      selectedProviderId,
      selectedModelId,
    });
  // This function needs to capture the live apiKeys and dbProviderConfigs
  const getApiKeyForInteraction = useCallback(
    (providerId: string): string | undefined => {
      const currentApiKeys = storage.apiKeys || [];
      const currentDbConfigs = storage.providerConfigs || [];
      return getApiKeyFromStore(providerId, currentApiKeys, currentDbConfigs);
    },
    [storage.apiKeys, storage.providerConfigs, getApiKeyFromStore],
  );
  const { handleFormSubmit, stopStreaming, regenerateMessage } =
    useAiInteraction({
      selectedModel,
      selectedProvider,
      getApiKeyForProvider: getApiKeyForInteraction,
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
      dbProviderConfigs: dbProviderConfigs || [],
      dbConversations,
      dbProjects,
      inputActions: { clearAllInput },
      handleSubmitCore,
      handleImageGenerationCore,
      stopStreamingCore,
      regenerateMessageCore,
      startWorkflowCore,
    });
  const clearAllData = useCallback(async () => {
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
  return {
    handleFormSubmit,
    stopStreaming,
    regenerateMessage,
    clearAllData,
    getContextSnapshotForMod,
    activeConversationData,
    selectedProvider,
    selectedModel,
    getApiKeyForProvider: getApiKeyForInteraction,
    sidebarActions: { renameItem },
    settingsActions: { setSearchTerm },
    providerActions: { updateDbProviderConfig },
  };
}
