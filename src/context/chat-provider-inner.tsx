// src/context/chat-provider-inner.tsx
import React, { useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type {
  ChatContextProps,
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
  SidebarItemType,
} from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";
import { type ReadonlyChatContextSnapshot } from "@/mods/api";
import { ChatContext } from "@/hooks/use-chat-context";
import { useCoreChatContext } from "@/context/core-chat-context";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useProviderManagementContext } from "./provider-management-context";
import { useSidebarContext } from "./sidebar-context";
import { useSettingsContext } from "./settings-context";
import { useVfsContext } from "./vfs-context";
import { useModContext } from "./mod-context";
import { useChatMiddleware } from "./chat-middleware";
import { EMPTY_DB_PROVIDER_CONFIGS } from "@/utils/chat-utils";
import { ChatSubmissionService } from "@/services/chat-submission-service";

interface ChatProviderInnerProps {
  children: React.ReactNode;
  streamingThrottleRate?: number;
  userCustomPromptActions: CustomPromptAction[];
  userCustomMessageActions: CustomMessageAction[];
  userCustomSettingsTabs: CustomSettingTab[];
}

type Theme = "light" | "dark" | "system";

interface StableReferences {
  providerMgmt: {
    selectedProviderId: string | null;
    selectedModelId: string | null;
    getApiKeyForProvider: (id: string) => string | undefined;
  };
  sidebar: {
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
  };
  settings: {
    activeSystemPrompt: string | null;
    temperature: number;
    maxTokens: number | null;
    theme: Theme;
  };
  vfs: {
    isVfsEnabledForItem: boolean;
  };
}

const ChatProviderInner: React.FC<ChatProviderInnerProps> = ({
  children,
  streamingThrottleRate = 42,
  userCustomPromptActions,
  userCustomMessageActions,
  userCustomSettingsTabs,
}) => {
  const {
    messages,
    setMessages,
    isLoadingMessages,
    setIsLoadingMessages,
    isStreaming,
    setIsStreaming,
    error,
    setError,
    abortControllerRef,
  } = useCoreChatContext();
  const providerMgmt = useProviderManagementContext();
  const sidebar = useSidebarContext();
  const settings = useSettingsContext();
  const vfs = useVfsContext();
  const modCtx = useModContext();
  const storage = useChatStorage();

  const middleware = useChatMiddleware(setError);

  const stableReferences = useRef<StableReferences>({
    providerMgmt: {
      selectedProviderId: null,
      selectedModelId: null,
      getApiKeyForProvider: (id: string) =>
        providerMgmt.getApiKeyForProvider(id),
    },
    sidebar: {
      selectedItemId: null,
      selectedItemType: null,
    },
    settings: {
      activeSystemPrompt: null,
      temperature: 0,
      maxTokens: null,
      theme: "system",
    },
    vfs: {
      isVfsEnabledForItem: false,
    },
  });

  useEffect(() => {
    stableReferences.current.providerMgmt.selectedProviderId =
      providerMgmt.selectedProviderId;
    stableReferences.current.providerMgmt.selectedModelId =
      providerMgmt.selectedModelId;
  }, [providerMgmt.selectedProviderId, providerMgmt.selectedModelId]);

  useEffect(() => {
    stableReferences.current.sidebar.selectedItemId = sidebar.selectedItemId;
    stableReferences.current.sidebar.selectedItemType =
      sidebar.selectedItemType;
  }, [sidebar.selectedItemId, sidebar.selectedItemType]);

  useEffect(() => {
    stableReferences.current.settings.activeSystemPrompt =
      settings.activeSystemPrompt;
    stableReferences.current.settings.temperature = settings.temperature;
    stableReferences.current.settings.maxTokens = settings.maxTokens;
    stableReferences.current.settings.theme = settings.theme;
  }, [
    settings.activeSystemPrompt,
    settings.temperature,
    settings.maxTokens,
    settings.theme,
  ]);

  useEffect(() => {
    stableReferences.current.vfs.isVfsEnabledForItem = vfs.isVfsEnabledForItem;
  }, [vfs.isVfsEnabledForItem]);

  const getApiKeyForSelectedProvider = useCallback((): string | undefined => {
    if (!providerMgmt.selectedProviderId) return undefined;
    return providerMgmt.getApiKeyForProvider(providerMgmt.selectedProviderId);
  }, [providerMgmt]);

  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      return Object.freeze({
        selectedItemId: stableReferences.current.sidebar.selectedItemId,
        selectedItemType: stableReferences.current.sidebar.selectedItemType,
        messages,
        isStreaming,
        selectedProviderId:
          stableReferences.current.providerMgmt.selectedProviderId,
        selectedModelId: stableReferences.current.providerMgmt.selectedModelId,
        activeSystemPrompt:
          stableReferences.current.settings.activeSystemPrompt,
        temperature: stableReferences.current.settings.temperature,
        maxTokens: stableReferences.current.settings.maxTokens,
        theme: stableReferences.current.settings.theme,
        isVfsEnabledForItem: stableReferences.current.vfs.isVfsEnabledForItem,
        getApiKeyForProvider:
          stableReferences.current.providerMgmt.getApiKeyForProvider,
      });
    }, [messages, isStreaming]);

  const messageHandling = useMessageHandling({
    selectedModel: providerMgmt.selectedModel,
    selectedProvider: providerMgmt.selectedProvider,
    getApiKeyForProvider: getApiKeyForSelectedProvider,
    streamingThrottleRate,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    topP: settings.topP,
    topK: settings.topK,
    presencePenalty: settings.presencePenalty,
    frequencyPenalty: settings.frequencyPenalty,
    activeSystemPrompt: settings.activeSystemPrompt,
    localMessages: messages,
    setLocalMessages: setMessages,
    isLoadingMessages: isLoadingMessages,
    setIsLoadingMessages: setIsLoadingMessages,
    isStreaming: isStreaming,
    setIsStreaming: setIsStreaming,
    error: error,
    setError,
    addDbMessage: storage.addDbMessage,
    deleteDbMessage: storage.deleteDbMessage,
    getMessagesForConversation: storage.getMessagesForConversation,
    // Removed getDbMessagesUpTo from here
    abortControllerRef,
    selectedConversationId: sidebar.activeConversationData?.id ?? null,
    getContextSnapshotForMod,
    bulkAddMessages: storage.bulkAddMessages,
  });

  const handleSubmit = useCallback(
    async (
      promptValue: string,
      attachedFilesValue: File[],
      vfsPathsToSubmit: string[],
    ) => {
      try {
        await ChatSubmissionService.submitChat(
          promptValue,
          attachedFilesValue,
          vfsPathsToSubmit,
          {
            selectedProviderId: providerMgmt.selectedProviderId,
            selectedProvider: providerMgmt.selectedProvider || null,
            selectedModel: providerMgmt.selectedModel,
            getApiKeyForProvider: getApiKeyForSelectedProvider,
            dbProviderConfigs:
              providerMgmt.dbProviderConfigs || EMPTY_DB_PROVIDER_CONFIGS,
            enableApiKeyManagement: providerMgmt.enableApiKeyManagement,
            isStreaming,
            setError,
            selectedItemType: sidebar.selectedItemType,
            selectedItemId: sidebar.selectedItemId,
            activeConversationData: sidebar.activeConversationData,
            createConversation: sidebar.createConversation,
            selectItem: sidebar.selectItem,
            deleteItem: sidebar.deleteItem,
            vfs: vfs.vfs,
            enableVfs: vfs.enableVfs,
            isVfsEnabledForItem: vfs.isVfsEnabledForItem,
            runMiddleware: middleware.runMiddleware,
            handleSubmitCore: messageHandling.handleSubmitCore,
            handleImageGenerationCore:
              messageHandling.handleImageGenerationCore,
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setError(`Error: ${message}`);
        toast.error(`Failed: ${message}`);
      }
    },
    [
      isStreaming,
      providerMgmt,
      getApiKeyForSelectedProvider,
      setError,
      messageHandling,
      vfs,
      middleware,
      sidebar,
    ],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await messageHandling.regenerateMessageCore(messageId);
    },
    [messageHandling, isStreaming],
  );

  const stopStreaming = useCallback(() => {
    messageHandling.stopStreamingCore();
  }, [messageHandling]);

  const handleImportConversation = useCallback(
    async (file: File, parentId: string | null) => {
      await sidebar.importConversation(file, parentId);
    },
    [sidebar],
  );

  const handleToggleVfs = useCallback(async () => {
    if (!sidebar.selectedItemId || !sidebar.selectedItemType) {
      toast.warning("No item selected.");
      return;
    }
    if (!vfs.enableVfs) {
      toast.error("Virtual Filesystem is disabled in configuration.");
      return;
    }
    await sidebar.toggleVfsEnabled(
      sidebar.selectedItemId,
      sidebar.selectedItemType,
      vfs.isVfsEnabledForItem,
    );
  }, [sidebar, vfs.isVfsEnabledForItem, vfs.enableVfs]);

  const hasInitializedMods = useRef(false);
  useEffect(() => {
    if (hasInitializedMods.current || !modCtx.dbMods) return;
    hasInitializedMods.current = true;

    const dbMods = modCtx.dbMods;
    modCtx._clearRegisteredModItems();
    modCtx._clearRegisteredModTools();
    middleware.clearModReferences();

    if (dbMods.length > 0) {
      middleware
        .loadModsWithContext(dbMods, getContextSnapshotForMod)
        .then((instances) => {
          modCtx._setLoadedMods(instances);
        })
        .catch((error) => {
          console.error("Error loading mods:", error);
        });
    } else {
      modCtx._setLoadedMods([]);
      modEvents.emit(ModEvent.APP_LOADED);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modCtx.dbMods]);

  const combinedPromptActions = useMemo(
    () => [...userCustomPromptActions, ...modCtx.modPromptActions],
    [userCustomPromptActions, modCtx.modPromptActions],
  );
  const combinedMessageActions = useMemo(
    () => [...userCustomMessageActions, ...modCtx.modMessageActions],
    [userCustomMessageActions, modCtx.modMessageActions],
  );
  const combinedSettingsTabs = useMemo(
    () => [...userCustomSettingsTabs, ...modCtx.modSettingsTabs],
    [userCustomSettingsTabs, modCtx.modSettingsTabs],
  );

  const fullContextValue: ChatContextProps = useMemo(
    () => ({
      enableApiKeyManagement: providerMgmt.enableApiKeyManagement,
      enableAdvancedSettings: settings.enableAdvancedSettings,
      enableSidebar: sidebar.enableSidebar,
      enableVfs: vfs.enableVfs,
      activeProviders: providerMgmt.activeProviders,
      selectedProviderId: providerMgmt.selectedProviderId,
      setSelectedProviderId: providerMgmt.setSelectedProviderId,
      selectedModelId: providerMgmt.selectedModelId,
      setSelectedModelId: providerMgmt.setSelectedModelId,
      getApiKeyForProvider: getApiKeyForSelectedProvider,
      selectedModel: providerMgmt.selectedModel,
      apiKeys: providerMgmt.apiKeys,
      addApiKey: providerMgmt.addApiKey,
      deleteApiKey: providerMgmt.deleteApiKey,
      dbProviderConfigs: providerMgmt.dbProviderConfigs,
      addDbProviderConfig: providerMgmt.addDbProviderConfig,
      updateDbProviderConfig: providerMgmt.updateDbProviderConfig,
      deleteDbProviderConfig: providerMgmt.deleteDbProviderConfig,
      sidebarItems: sidebar.sidebarItems,
      selectedItemId: sidebar.selectedItemId,
      selectedItemType: sidebar.selectedItemType,
      selectItem: sidebar.selectItem,
      createConversation: sidebar.createConversation,
      createProject: sidebar.createProject,
      deleteItem: sidebar.deleteItem,
      renameItem: sidebar.renameItem,
      updateConversationSystemPrompt: sidebar.updateConversationSystemPrompt,
      messages: messages,
      isLoading: isLoadingMessages,
      isStreaming: isStreaming,
      error: error,
      setError: setError,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      selectedVfsPaths: vfs.selectedVfsPaths,
      addSelectedVfsPath: vfs.addSelectedVfsPath,
      removeSelectedVfsPath: vfs.removeSelectedVfsPath,
      clearSelectedVfsPaths: vfs.clearSelectedVfsPaths,
      isVfsEnabledForItem: vfs.isVfsEnabledForItem,
      toggleVfsEnabled: handleToggleVfs,
      vfs: vfs.vfs,
      temperature: settings.temperature,
      setTemperature: settings.setTemperature,
      maxTokens: settings.maxTokens,
      setMaxTokens: settings.setMaxTokens,
      globalSystemPrompt: settings.globalSystemPrompt,
      setGlobalSystemPrompt: settings.setGlobalSystemPrompt,
      activeSystemPrompt: settings.activeSystemPrompt,
      topP: settings.topP,
      setTopP: settings.setTopP,
      topK: settings.topK,
      setTopK: settings.setTopK,
      presencePenalty: settings.presencePenalty,
      setPresencePenalty: settings.setPresencePenalty,
      frequencyPenalty: settings.frequencyPenalty,
      setFrequencyPenalty: settings.setFrequencyPenalty,
      theme: settings.theme,
      setTheme: settings.setTheme,
      streamingThrottleRate,
      searchTerm: settings.searchTerm,
      setSearchTerm: settings.setSearchTerm,
      exportConversation: sidebar.exportConversation,
      importConversation: handleImportConversation,
      exportAllConversations: sidebar.exportAllConversations,
      clearAllData: storage.clearAllData,
      getConversation: storage.getConversation,
      getProject: storage.getProject,
      customPromptActions: combinedPromptActions,
      customMessageActions: combinedMessageActions,
      customSettingsTabs: combinedSettingsTabs,
      dbMods: modCtx.dbMods,
      loadedMods: modCtx.loadedMods,
      addDbMod: modCtx.addDbMod,
      updateDbMod: modCtx.updateDbMod,
      deleteDbMod: modCtx.deleteDbMod,
      isSettingsModalOpen: settings.isSettingsModalOpen,
      onSettingsModalOpenChange: settings.onSettingsModalOpenChange,
    }),
    [
      providerMgmt.enableApiKeyManagement,
      settings.enableAdvancedSettings,
      sidebar.enableSidebar,
      vfs.enableVfs,
      providerMgmt.activeProviders,
      providerMgmt.selectedProviderId,
      providerMgmt.setSelectedProviderId,
      providerMgmt.selectedModelId,
      providerMgmt.setSelectedModelId,
      getApiKeyForSelectedProvider,
      providerMgmt.selectedModel,
      providerMgmt.apiKeys,
      providerMgmt.addApiKey,
      providerMgmt.deleteApiKey,
      providerMgmt.dbProviderConfigs,
      providerMgmt.addDbProviderConfig,
      providerMgmt.updateDbProviderConfig,
      providerMgmt.deleteDbProviderConfig,
      sidebar.sidebarItems,
      sidebar.selectedItemId,
      sidebar.selectedItemType,
      sidebar.selectItem,
      sidebar.createConversation,
      sidebar.createProject,
      sidebar.deleteItem,
      sidebar.renameItem,
      sidebar.updateConversationSystemPrompt,
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      setError,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      vfs.selectedVfsPaths,
      vfs.addSelectedVfsPath,
      vfs.removeSelectedVfsPath,
      vfs.clearSelectedVfsPaths,
      vfs.isVfsEnabledForItem,
      handleToggleVfs,
      vfs.vfs,
      settings.temperature,
      settings.setTemperature,
      settings.maxTokens,
      settings.setMaxTokens,
      settings.globalSystemPrompt,
      settings.setGlobalSystemPrompt,
      settings.activeSystemPrompt,
      settings.topP,
      settings.setTopP,
      settings.topK,
      settings.setTopK,
      settings.presencePenalty,
      settings.setPresencePenalty,
      settings.frequencyPenalty,
      settings.setFrequencyPenalty,
      settings.theme,
      settings.setTheme,
      streamingThrottleRate,
      settings.searchTerm,
      settings.setSearchTerm,
      sidebar.exportConversation,
      handleImportConversation,
      sidebar.exportAllConversations,
      storage.clearAllData,
      storage.getConversation,
      storage.getProject,
      combinedPromptActions,
      combinedMessageActions,
      combinedSettingsTabs,
      modCtx.dbMods,
      modCtx.loadedMods,
      modCtx.addDbMod,
      modCtx.updateDbMod,
      modCtx.deleteDbMod,
      settings.isSettingsModalOpen,
      settings.onSettingsModalOpenChange,
    ],
  );

  return (
    <ChatContext.Provider value={fullContextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProviderInner;
