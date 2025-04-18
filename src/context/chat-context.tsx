// src/context/chat-context.tsx
import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import type {
  ChatContextProps,
  CoreChatContextProps,
  SidebarItemType,
  Message,
  DbConversation,
  DbProject,
  CustomPromptAction,
  CustomMessageAction,
  CustomSettingTab,
  DbProviderConfig,
  DbProviderType,
  SidebarItem,
  ProjectSidebarItem,
  ConversationSidebarItem,
} from "@/lib/types";
import type {
  ProcessResponseChunkPayload,
  RenderMessagePayload,
} from "@/mods/types";
import { ChatContext } from "@/hooks/use-chat-context";
import {
  CoreChatContext,
  useCoreChatContext,
} from "@/context/core-chat-context";
import { useAiInteraction } from "@/hooks/ai-interaction";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { toast } from "sonner";
import { loadMods } from "@/mods/loader";
import { modEvents, ModEvent, ModEventName } from "@/mods/events";
import {
  ModMiddlewareHook,
  type ReadonlyChatContextSnapshot,
  type ModMiddlewareHookName,
} from "@/mods/api";
import type {
  ModEventPayloadMap,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "@/mods/types";
import { nanoid } from "nanoid";

import {
  ProviderManagementProvider,
  useProviderManagementContext,
} from "./provider-management-context";
import { SidebarProvider, useSidebarContext } from "./sidebar-context";
import { SettingsProvider, useSettingsContext } from "./settings-context";
import { VfsProvider, useVfsContext } from "./vfs-context";
import { ModProvider, useModContext } from "./mod-context";

// Helper functions
const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn(
      "Failed to decode Uint8Array as strict UTF-8, trying lossy:",
      e,
    );
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

const CODE_FILE_EXTENSIONS = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "html",
  "css",
  "scss",
  "less",
  "php",
  "py",
  "rb",
  "java",
  "cpp",
  "c",
  "cs",
  "go",
  "rs",
  "json",
  "yaml",
  "yml",
  "xml",
  "csv",
  "sql",
  "md",
  "markdown",
  "txt",
  "rst",
  "sh",
  "bash",
  "zsh",
  "fish",
  "bat",
  "ps1",
  "env",
  "ini",
  "conf",
  "config",
  "toml",
  "gradle",
  "dockerfile",
  "gitignore",
]);

const isCodeFile = (filename: string): boolean => {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  return CODE_FILE_EXTENSIONS.has(extension);
};

const requiresApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai" || type === "openrouter" || type === "google";
};

const EMPTY_CUSTOM_SETTINGS_TABS: CustomSettingTab[] = [];
const EMPTY_CUSTOM_PROMPT_ACTIONS: CustomPromptAction[] = [];
const EMPTY_CUSTOM_MESSAGE_ACTIONS: CustomMessageAction[] = [];
const EMPTY_DB_PROVIDER_CONFIGS: DbProviderConfig[] = [];

interface ChatProviderProps {
  children: React.ReactNode;
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
  enableApiKeyManagement?: boolean;
  enableSidebar?: boolean;
  enableVfs?: boolean;
  enableAdvancedSettings?: boolean;
  customPromptActions?: CustomPromptAction[];
  customMessageActions?: CustomMessageAction[];
  customSettingsTabs?: CustomSettingTab[];
}

interface ChatProviderInnerProps extends Omit<ChatProviderProps, "children"> {
  children: React.ReactNode;
  userCustomPromptActions: CustomPromptAction[];
  userCustomMessageActions: CustomMessageAction[];
  userCustomSettingsTabs: CustomSettingTab[];
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
  const modEventListenersRef = useRef<Map<string, Map<string, Function>>>(
    new Map(),
  );
  const modMiddlewareCallbacksRef = useRef<Map<string, Map<string, Function>>>(
    new Map(),
  );

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

  const runMiddleware = useCallback(
    async <H extends ModMiddlewareHookName>(
      hookName: H,
      initialPayload: ModMiddlewarePayloadMap[H],
    ): Promise<ModMiddlewareReturnMap[H] | false> => {
      const callbacksMap = modMiddlewareCallbacksRef.current.get(hookName);

      if (!callbacksMap || callbacksMap.size === 0) {
        const hook: ModMiddlewareHookName = hookName;
        switch (hook) {
          case ModMiddlewareHook.PROCESS_RESPONSE_CHUNK:
            return (initialPayload as ProcessResponseChunkPayload)
              .chunk as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.RENDER_MESSAGE:
            return (initialPayload as RenderMessagePayload)
              .message as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.SUBMIT_PROMPT:
          case ModMiddlewareHook.VFS_WRITE:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
          default:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
        }
      }

      let currentData:
        | ModMiddlewarePayloadMap[H]
        | ModMiddlewareReturnMap[H]
        | false = initialPayload;
      const callbacks = Array.from(callbacksMap.values());

      for (const callback of callbacks) {
        if (currentData === false) {
          break;
        }
        try {
          currentData = await callback(currentData as any);
        } catch (err) {
          console.error(
            `[Middleware] Error executing middleware for hook '${hookName}':`,
            err,
          );
          toast.error(`Middleware error during ${hookName}. Action cancelled.`);
          currentData = false;
          break;
        }
      }

      if (currentData !== false && currentData === initialPayload) {
        const hook: ModMiddlewareHookName = hookName;
        switch (hook) {
          case ModMiddlewareHook.PROCESS_RESPONSE_CHUNK:
            return (initialPayload as ProcessResponseChunkPayload)
              .chunk as unknown as ModMiddlewareReturnMap[H];
          case ModMiddlewareHook.RENDER_MESSAGE:
            return (initialPayload as RenderMessagePayload)
              .message as unknown as ModMiddlewareReturnMap[H];
          default:
            return initialPayload as unknown as ModMiddlewareReturnMap[H];
        }
      }
      return currentData as ModMiddlewareReturnMap[H] | false;
    },
    [],
  );

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
        requiresApiKey(selectedDbConfig?.type ?? null);

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
            conversationId: conversationIdToSubmit,
          };

        modEvents.emit(ModEvent.MESSAGE_BEFORE_SUBMIT, {
          prompt: originalUserPrompt,
          attachedFiles: attachedFilesValue,
          vfsPaths: pathsIncludedInContext,
        });

        const middlewareResult = await runMiddleware(
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
      runMiddleware,
      sidebar,
      // decodeUint8Array, // Added dependency - already defined globally
      // isCodeFile, // Added dependency - already defined globally
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
    [
      sidebar.importConversation,
      sidebar.selectedItemType,
      sidebar.selectedItemId,
      sidebar.activeConversationData,
    ],
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
  }, [
    sidebar.toggleVfsEnabled,
    sidebar.selectedItemId,
    sidebar.selectedItemType,
    vfs.isVfsEnabledForItem,
    vfs.enableVfs,
  ]);

  const registerModEventListener = useCallback(
    <E extends ModEventName>(
      eventName: E,
      callback: (payload: ModEventPayloadMap[E]) => void,
    ): (() => void) => {
      modEvents.on(eventName, callback);
      const unsubscribe = () => {
        modEvents.off(eventName, callback);
      };
      return unsubscribe;
    },
    [],
  );

  const registerModMiddleware = useCallback(
    <H extends ModMiddlewareHookName>(
      hookName: H,
      callback: (
        payload: ModMiddlewarePayloadMap[H],
      ) => ModMiddlewareReturnMap[H] | Promise<ModMiddlewareReturnMap[H]>,
    ): (() => void) => {
      const middlewareId = nanoid();
      const currentMap = modMiddlewareCallbacksRef.current;
      if (!currentMap.has(hookName)) {
        currentMap.set(hookName, new Map());
      }
      currentMap.get(hookName)?.set(middlewareId, callback);
      return () => {
        const hookCallbacks = currentMap.get(hookName);
        if (hookCallbacks) {
          hookCallbacks.delete(middlewareId);
          if (hookCallbacks.size === 0) {
            currentMap.delete(hookName);
          }
        }
      };
    },
    [],
  );

  const getContextSnapshotForMod =
    useCallback((): ReadonlyChatContextSnapshot => {
      return Object.freeze({
        selectedItemId: sidebar.selectedItemId,
        selectedItemType: sidebar.selectedItemType,
        messages: messages,
        isStreaming: isStreaming,
        selectedProviderId: providerMgmt.selectedProviderId,
        selectedModelId: providerMgmt.selectedModelId,
        activeSystemPrompt: settings.activeSystemPrompt,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        theme: settings.theme,
        isVfsEnabledForItem: vfs.isVfsEnabledForItem,
        getApiKeyForProvider: getApiKeyForSelectedProvider,
      });
    }, [
      sidebar.selectedItemId,
      sidebar.selectedItemType,
      messages,
      isStreaming,
      providerMgmt.selectedProviderId,
      providerMgmt.selectedModelId,
      settings.activeSystemPrompt,
      settings.temperature,
      settings.maxTokens,
      settings.theme,
      vfs.isVfsEnabledForItem,
      getApiKeyForSelectedProvider,
    ]);

  useEffect(() => {
    const dbMods = modCtx.dbMods;
    modCtx._clearRegisteredModItems();
    modEventListenersRef.current.clear();
    modMiddlewareCallbacksRef.current.clear();

    if (dbMods.length > 0) {
      const registrationCallbacks = {
        registerPromptAction: modCtx._registerModPromptAction,
        registerMessageAction: modCtx._registerModMessageAction,
        registerSettingsTab: modCtx._registerModSettingsTab,
        registerEventListener: registerModEventListener,
        registerMiddleware: registerModMiddleware,
      };
      loadMods(dbMods, registrationCallbacks, getContextSnapshotForMod)
        .then((instances) => {
          modCtx._setLoadedMods(instances);
          modEvents.emit(ModEvent.APP_LOADED);
        })
        .catch((err: unknown) => {
          if (err instanceof Error) {
            setError("Failed to load one or more mods." + err.message);
          } else {
            setError("Failed to load one or more mods.");
          }
          modEvents.emit(ModEvent.APP_LOADED);
        });
    } else {
      modCtx._setLoadedMods([]);
      modEvents.emit(ModEvent.APP_LOADED);
    }
  }, [
    modCtx.dbMods,
    modCtx._clearRegisteredModItems,
    modCtx._registerModPromptAction,
    modCtx._registerModMessageAction,
    modCtx._registerModSettingsTab,
    modCtx._setLoadedMods,
    registerModEventListener,
    registerModMiddleware,
    getContextSnapshotForMod,
    setError,
  ]);

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
      toggleVfsEnabled: handleToggleVfs, // Pass the correct function
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
    [
      providerMgmt,
      settings,
      sidebar,
      vfs,
      modCtx,
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      setError,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      handleImportConversation,
      handleToggleVfs,
      storage.clearAllData,
      storage.getConversation,
      storage.getProject,
      combinedPromptActions,
      combinedMessageActions,
      combinedSettingsTabs,
      streamingThrottleRate,
      getApiKeyForSelectedProvider,
    ],
  );

  return (
    <ChatContext.Provider value={fullContextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
  enableApiKeyManagement = true,
  enableSidebar = true,
  enableVfs = true,
  enableAdvancedSettings = true,
  customPromptActions = EMPTY_CUSTOM_PROMPT_ACTIONS,
  customMessageActions = EMPTY_CUSTOM_MESSAGE_ACTIONS,
  customSettingsTabs = EMPTY_CUSTOM_SETTINGS_TABS,
}) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
      modEvents.emit(ModEvent.APP_ERROR, { message: newError });
    }
  }, []);

  const coreContextValue: CoreChatContextProps = useMemo(
    () => ({
      messages,
      setMessages,
      isLoadingMessages,
      setIsLoadingMessages,
      isStreaming,
      setIsStreaming,
      error,
      setError,
      handleSubmitCore: async () => {
        console.warn("handleSubmitCore called on CoreChatContext");
      },
      stopStreamingCore: () => {
        console.warn("stopStreamingCore called on CoreChatContext");
      },
      regenerateMessageCore: async () => {
        console.warn("regenerateMessageCore called on CoreChatContext");
      },
      abortControllerRef,
    }),
    [messages, isLoadingMessages, isStreaming, error, setError],
  );

  const [activeItemId, setActiveItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [activeItemType, setActiveItemType] = useState<SidebarItemType | null>(
    initialSelectedItemType,
  );

  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      setMessages([]);
      setErrorState(null);
      setActiveItemId(id);
      setActiveItemType(type);
      setIsLoadingMessages(!!id);
      modEvents.emit(ModEvent.CHAT_SELECTED, { id, type });
    },
    [],
  );

  const handleSettingsModalOpenChange = useCallback((open: boolean) => {
    setIsSettingsModalOpen(open);
    if (open) {
      modEvents.emit(ModEvent.SETTINGS_OPENED);
    } else {
      modEvents.emit(ModEvent.SETTINGS_CLOSED);
    }
  }, []);

  const storage = useChatStorage();
  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allProjects = storage.projects || [];
    const allConversations = storage.conversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [storage.projects, storage.conversations]);

  const activeItemData = useMemo(() => {
    if (!activeItemId || !activeItemType) return null;
    const item = sidebarItems.find((i) => i.id === activeItemId);
    if (item && item.type === activeItemType) {
      return item;
    }
    return null;
  }, [activeItemId, activeItemType, sidebarItems]);

  const activeConversationData = useMemo(() => {
    return activeItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [activeItemType, activeItemData]);

  const activeProjectData = useMemo(() => {
    return activeItemType === "project"
      ? (activeItemData as DbProject | null)
      : null;
  }, [activeItemType, activeItemData]);

  const isVfsEnabledForItem = useMemo(
    () => (enableVfs ? (activeItemData?.vfsEnabled ?? false) : false),
    [enableVfs, activeItemData],
  );

  const vfsKey = useMemo(() => {
    if (!enableVfs) return null;
    if (activeItemType === "project" && activeItemId) {
      return activeItemId;
    }
    if (activeItemType === "conversation" && activeConversationData) {
      return activeConversationData.parentId || "orphan";
    }
    return null;
  }, [enableVfs, activeItemType, activeItemId, activeConversationData]);

  return (
    <CoreChatContext.Provider value={coreContextValue}>
      <ProviderManagementProvider
        initialProviderId={initialProviderId}
        initialModelId={initialModelId}
        enableApiKeyManagement={enableApiKeyManagement}
      >
        <SidebarProvider
          initialSelectedItemId={initialSelectedItemId}
          initialSelectedItemType={initialSelectedItemType}
          enableSidebar={enableSidebar}
          onSelectItem={handleSelectItem}
        >
          <SettingsProvider
            enableAdvancedSettings={enableAdvancedSettings}
            activeConversationData={activeConversationData}
            activeProjectData={activeProjectData}
            isSettingsModalOpen={isSettingsModalOpen}
            onSettingsModalOpenChange={handleSettingsModalOpenChange}
          >
            <VfsProvider
              enableVfs={enableVfs}
              selectedItemId={activeItemId}
              selectedItemType={activeItemType}
              isVfsEnabledForItem={isVfsEnabledForItem}
              vfsKey={vfsKey}
            >
              <ModProvider>
                <ChatProviderInner
                  initialProviderId={initialProviderId}
                  initialModelId={initialModelId}
                  initialSelectedItemId={initialSelectedItemId}
                  initialSelectedItemType={initialSelectedItemType}
                  streamingThrottleRate={streamingThrottleRate}
                  enableApiKeyManagement={enableApiKeyManagement}
                  enableSidebar={enableSidebar}
                  enableVfs={enableVfs}
                  enableAdvancedSettings={enableAdvancedSettings}
                  userCustomPromptActions={customPromptActions}
                  userCustomMessageActions={customMessageActions}
                  userCustomSettingsTabs={customSettingsTabs}
                >
                  {children}
                </ChatProviderInner>
              </ModProvider>
            </VfsProvider>
          </SettingsProvider>
        </SidebarProvider>
      </ProviderManagementProvider>
    </CoreChatContext.Provider>
  );
};
