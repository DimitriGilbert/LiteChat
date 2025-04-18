// src/context/chat-provider-inner.tsx
import React, { useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type {
  ChatContextProps,
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
  DbProviderType,
  SidebarItemType,
} from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";
import {
  ModMiddlewareHook,
  type ReadonlyChatContextSnapshot,
} from "@/mods/api";
import type {
  ModMiddlewarePayloadMap,
} from "@/mods/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { useCoreChatContext } from "@/context/core-chat-context";
import { useAiInteraction } from "@/hooks/ai-interaction";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useProviderManagementContext } from "./provider-management-context";
import { useSidebarContext } from "./sidebar-context";
import { useSettingsContext } from "./settings-context";
import { useVfsContext } from "./vfs-context";
import { useModContext } from "./mod-context";
import { useChatMiddleware } from "./chat-middleware";
import { decodeUint8Array, isCodeFile, requiresApiKey, EMPTY_DB_PROVIDER_CONFIGS } from "@/utils/chat-utils";

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
    activeSystemPrompt: string;
    temperature: number;
    maxTokens: number;
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
  
  // Keep stable references to functions/objects to prevent dependency loops
  const stableReferences = useRef<StableReferences>({
    providerMgmt: {
      selectedProviderId: null,
      selectedModelId: null,
      getApiKeyForProvider: (id: string) => providerMgmt.getApiKeyForProvider(id),
    },
    sidebar: {
      selectedItemId: null,
      selectedItemType: null,
    },
    settings: {
      activeSystemPrompt: "",
      temperature: 0,
      maxTokens: 0,
      theme: "system", // default to system theme
    },
    vfs: {
      isVfsEnabledForItem: false,
    }
  });
  
  // Keep stable references updated with latest values
  useEffect(() => {
    stableReferences.current.providerMgmt.selectedProviderId = providerMgmt.selectedProviderId;
    stableReferences.current.providerMgmt.selectedModelId = providerMgmt.selectedModelId;
  }, [providerMgmt.selectedProviderId, providerMgmt.selectedModelId]);
  
  useEffect(() => {
    stableReferences.current.sidebar.selectedItemId = sidebar.selectedItemId;
    stableReferences.current.sidebar.selectedItemType = sidebar.selectedItemType;
  }, [sidebar.selectedItemId, sidebar.selectedItemType]);
  
  useEffect(() => {
    stableReferences.current.settings.activeSystemPrompt = settings.activeSystemPrompt || "";
    stableReferences.current.settings.temperature = settings.temperature || 0;
    stableReferences.current.settings.maxTokens = settings.maxTokens || 0;
    stableReferences.current.settings.theme = settings.theme;
  }, [settings.activeSystemPrompt, settings.temperature, settings.maxTokens, settings.theme]);
  
  useEffect(() => {
    stableReferences.current.vfs.isVfsEnabledForItem = vfs.isVfsEnabledForItem;
  }, [vfs.isVfsEnabledForItem]);

  const getApiKeyForSelectedProvider = useCallback((): string | undefined => {
    if (!providerMgmt.selectedProviderId) return undefined;
    return providerMgmt.getApiKeyForProvider(providerMgmt.selectedProviderId);
  }, [providerMgmt]);

  const aiInteraction = useAiInteraction({
    selectedModel: providerMgmt.selectedModel,
    selectedProvider: providerMgmt.selectedProvider,
    getApiKeyForProvider: getApiKeyForSelectedProvider,
    streamingThrottleRate,
    setLocalMessages: setMessages,
    setIsAiStreaming: setIsStreaming,
    setError,
    addDbMessage: storage.addDbMessage,
    abortControllerRef,
  });

  const messageHandling = useMessageHandling({
    selectedConversationId: sidebar.activeConversationData?.id ?? null,
    performAiStream: aiInteraction.performAiStream,
    stopStreamingCallback: useCallback(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }, [abortControllerRef, setIsStreaming]),
    activeSystemPrompt: settings.activeSystemPrompt,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    topP: settings.topP,
    topK: settings.topK,
    presencePenalty: settings.presencePenalty,
    frequencyPenalty: settings.frequencyPenalty,
    isAiStreaming: isStreaming,
    setIsAiStreaming: setIsStreaming,
    localMessages: messages,
    setLocalMessages: setMessages,
    isLoadingMessages: isLoadingMessages,
    setIsLoadingMessages: setIsLoadingMessages,
    error: error,
    setError,
    addDbMessage: storage.addDbMessage,
    deleteDbMessage: storage.deleteDbMessage,
    getMessagesForConversation: storage.getMessagesForConversation,
  });

  const handleSubmit = useCallback(
    async (
      promptValue: string,
      attachedFilesValue: File[],
      vfsPathsToSubmit: string[],
    ) => {
      const currentPrompt = promptValue.trim();
      const canSubmit =
        currentPrompt.length > 0 ||
        attachedFilesValue.length > 0 ||
        vfsPathsToSubmit.length > 0;

      if (!canSubmit) return;
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      if (!providerMgmt.selectedProvider || !providerMgmt.selectedModel) {
        setError("Error: Please select an active AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      const selectedDbConfig = (
        providerMgmt.dbProviderConfigs || EMPTY_DB_PROVIDER_CONFIGS
      ).find((p) => p.id === providerMgmt.selectedProviderId);
      const needsKeyCheck =
        selectedDbConfig?.apiKeyId ||
        requiresApiKey(selectedDbConfig?.type as DbProviderType);

      if (needsKeyCheck && !getApiKeyForSelectedProvider()) {
        const errorMsg = `API Key for ${providerMgmt.selectedProvider.name} is not set, selected, or linked. Check Settings -> Providers.`;
        setError(errorMsg);
        toast.error(errorMsg);
        if (!providerMgmt.enableApiKeyManagement) {
          toast.info(
            "API Key management is disabled. Ensure keys are configured correctly if needed by the provider.",
          );
        }
        return;
      }

      let conversationIdToSubmit: string | null = null;
      let parentProjectId: string | null = null;

      if (sidebar.selectedItemType === "project" && sidebar.selectedItemId) {
        parentProjectId = sidebar.selectedItemId;
      } else if (
        sidebar.selectedItemType === "conversation" &&
        sidebar.selectedItemId
      ) {
        parentProjectId = sidebar.activeConversationData?.parentId ?? null;
        conversationIdToSubmit = sidebar.selectedItemId;
      }

      let newConvCreated = false;
      if (!conversationIdToSubmit) {
        try {
          const title = currentPrompt.substring(0, 50) || "New Chat";
          const newConvId = await sidebar.createConversation(
            parentProjectId,
            title,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
          newConvCreated = true;
          modEvents.emit(ModEvent.CHAT_CREATED, {
            id: newConvId,
            type: "conversation",
            parentId: parentProjectId,
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setError(`Error: Could not start chat - ${message}`);
          toast.error(`Failed to start chat: ${message}`);
          return;
        }
      }

      if (!conversationIdToSubmit) {
        setError("Error: Could not determine target conversation for submit.");
        toast.error("Could not determine target conversation.");
        return;
      }

      let contextPrefix = "";
      const pathsIncludedInContext: string[] = [];

      if (
        vfs.enableVfs &&
        vfs.isVfsEnabledForItem &&
        vfs.vfs.isReady &&
        vfs.vfs.configuredVfsKey === vfs.vfs.vfsKey &&
        vfsPathsToSubmit.length > 0
      ) {
        modEvents.emit(ModEvent.VFS_CONTEXT_ADDED, {
          paths: vfsPathsToSubmit,
        });
        const vfsContentPromises = vfsPathsToSubmit.map(async (path) => {
          try {
            const contentBytes = await vfs.vfs.readFile(path);
            const contentText = decodeUint8Array(contentBytes);
            pathsIncludedInContext.push(path);
            const fileExtension = path.split(".").pop()?.toLowerCase() || "";
            return `<vfs_file path="${path}" extension="${fileExtension}">
\`\`\`${fileExtension}
${contentText}
\`\`\`
</vfs_file>`;
          } catch (readErr) {
            console.error(`Error reading VFS file ${path}:`, readErr);
            toast.error(`Failed to read VFS file: ${path}`);
            return `<vfs_file path="${path}" error="Failed to read"/>`;
          }
        });
        const vfsContents = await Promise.all(vfsContentPromises);
        if (vfsContents.length > 0) {
          contextPrefix += vfsContents.join("\n") + "\n";
        }
      } else if (vfsPathsToSubmit.length > 0) {
        toast.warning("VFS not enabled for this chat. Selected files ignored.");
      }

      if (attachedFilesValue.length > 0) {
        const attachedContentPromises = attachedFilesValue.map(async (file) => {
          if (file.type.startsWith("text/") || isCodeFile(file.name)) {
            try {
              const contentText = await file.text();
              const fileExtension =
                file.name.split(".").pop()?.toLowerCase() || "";
              return `<attached_file name="${file.name}" type="${file.type}" extension="${fileExtension}">
\`\`\`${fileExtension}
${contentText}
\`\`\`
</attached_file>`;
            } catch (readErr) {
              let errmsg = "";
              if (readErr instanceof Error) {
                errmsg = readErr.message;
              } else {
                errmsg = String(readErr);
              }
              toast.error(
                `Failed to read attached file: ${file.name}\n${errmsg}`,
              );
              return `<attached_file name="${file.name}" type="${file.type}" error="Failed to read"/>`;
            }
          } else {
            toast.info(`Skipping unsupported file: ${file.name}`);
            return `<attached_file name="${file.name}" type="${file.type}" status="skipped_unsupported"/>`;
          }
        });
        const attachedContents = await Promise.all(attachedContentPromises);
        if (attachedContents.length > 0) {
          contextPrefix += attachedContents.join("\n") + "\n";
        }
      }

      const originalUserPrompt = currentPrompt;
      const promptToSendToAI = contextPrefix + originalUserPrompt;

      if (promptToSendToAI.trim().length > 0) {
        let submitPayload: ModMiddlewarePayloadMap[typeof ModMiddlewareHook.SUBMIT_PROMPT] =
          {
            prompt: promptToSendToAI,
            originalUserPrompt,
            attachedFiles: attachedFilesValue,
            vfsPaths: pathsIncludedInContext,
            conversationId: conversationIdToSubmit || '',
          };

        modEvents.emit(ModEvent.MESSAGE_BEFORE_SUBMIT, {
          prompt: originalUserPrompt,
          attachedFiles: attachedFilesValue,
          vfsPaths: pathsIncludedInContext,
        });

        const middlewareResult = await middleware.runMiddleware(
          ModMiddlewareHook.SUBMIT_PROMPT,
          submitPayload,
        );

        if (middlewareResult === false) {
          toast.info("Submission cancelled by a mod.");
          if (newConvCreated && conversationIdToSubmit) {
            await sidebar.deleteItem(conversationIdToSubmit, "conversation");
          }
          return;
        }
        submitPayload = middlewareResult;

        await messageHandling.handleSubmitCore(
          submitPayload.originalUserPrompt,
          submitPayload.conversationId,
          submitPayload.prompt,
          submitPayload.vfsPaths,
        );
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
      if (
        sidebar.selectedItemType !== "conversation" ||
        !sidebar.selectedItemId
      ) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await messageHandling.regenerateMessageCore(messageId);
    },
    [
      messageHandling,
      sidebar.selectedItemType,
      sidebar.selectedItemId,
      isStreaming,
    ],
  );

  const stopStreaming = useCallback(() => {
    messageHandling.stopStreamingCore();
    toast.info("AI response stopped.");
  }, [messageHandling]);

  const handleImportConversation = useCallback(
    async (file: File) => {
      let parentId: string | null = null;
      if (sidebar.selectedItemType === "project" && sidebar.selectedItemId) {
        parentId = sidebar.selectedItemId;
      } else if (
        sidebar.selectedItemType === "conversation" &&
        sidebar.selectedItemId
      ) {
        parentId = sidebar.activeConversationData?.parentId ?? null;
      }
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

  const getContextSnapshotForMod = useCallback((): ReadonlyChatContextSnapshot => {
    return Object.freeze({
      selectedItemId: stableReferences.current.sidebar.selectedItemId,
      selectedItemType: stableReferences.current.sidebar.selectedItemType,
      messages,
      isStreaming,
      selectedProviderId: stableReferences.current.providerMgmt.selectedProviderId,
      selectedModelId: stableReferences.current.providerMgmt.selectedModelId,
      activeSystemPrompt: stableReferences.current.settings.activeSystemPrompt,
      temperature: stableReferences.current.settings.temperature,
      maxTokens: stableReferences.current.settings.maxTokens,
      theme: stableReferences.current.settings.theme,
      isVfsEnabledForItem: stableReferences.current.vfs.isVfsEnabledForItem,
      getApiKeyForProvider: stableReferences.current.providerMgmt.getApiKeyForProvider,
    });
  }, [messages, isStreaming]); // Minimal dependencies to prevent loops

  // Track if effect has already run to avoid double initialization
  const hasInitializedMods = useRef(false);

  useEffect(() => {
    // Skip if already initialized or if dependencies aren't ready
    if (hasInitializedMods.current) return;
    hasInitializedMods.current = true;
    
    const dbMods = modCtx.dbMods;
    modCtx._clearRegisteredModItems();
    middleware.clearModReferences();

    if (dbMods.length > 0) {
      const registrationCallbacks = {
        registerPromptAction: modCtx._registerModPromptAction,
        registerMessageAction: modCtx._registerModMessageAction,
        registerSettingsTab: modCtx._registerModSettingsTab,
        registerEventListener: middleware.registerModEventListener,
        registerMiddleware: middleware.registerModMiddleware,
      };
      
      middleware.loadModsWithContext(
        dbMods,
        registrationCallbacks,
        getContextSnapshotForMod
      ).then(instances => {
        modCtx._setLoadedMods(instances);
      }).catch(error => {
        console.error("Error loading mods:", error);
      });
    } else {
      modCtx._setLoadedMods([]);
      modEvents.emit(ModEvent.APP_LOADED);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once

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
      // VFS
      selectedVfsPaths: vfs.selectedVfsPaths,
      addSelectedVfsPath: vfs.addSelectedVfsPath,
      removeSelectedVfsPath: vfs.removeSelectedVfsPath,
      clearSelectedVfsPaths: vfs.clearSelectedVfsPaths,
      isVfsEnabledForItem: vfs.isVfsEnabledForItem,
      toggleVfsEnabled: handleToggleVfs,
      vfs: vfs.vfs,
      // Settings
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
      // Data Management
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
    // Only depend on specific props to avoid infinite re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      handleImportConversation,
      handleToggleVfs,
      combinedPromptActions,
      combinedMessageActions,
      combinedSettingsTabs,
      streamingThrottleRate,
      getApiKeyForSelectedProvider,
      // Don't include all provider, sidebar, settings, and storage properties
      // Instead, use them only where they directly affect these callbacks
    ],
  );

  return (
    <ChatContext.Provider value={fullContextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatProviderInner;