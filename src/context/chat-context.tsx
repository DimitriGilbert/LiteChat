// src/context/chat-context.tsx
import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  CoreChatContextProps,
  SidebarItemType,
  Message,
  DbConversation,
  DbProject,
  DbApiKey, // Keep DbApiKey
  SidebarItem, // Keep SidebarItem
} from "@/lib/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { CoreChatContext } from "@/context/core-chat-context";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import { useApiKeysManagement } from "@/hooks/use-api-keys-management";
import { useConversationManagement } from "@/hooks/use-conversation-management";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useAiInteraction } from "@/hooks/use-ai-interaction";
import { useChatInput } from "@/hooks/use-chat-input";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useVirtualFileSystem } from "@/hooks/use-virtual-file-system";
import { toast } from "sonner";

// ... (interfaces and decodeUint8Array remain the same) ...
interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
}

const decodeUint8Array = (arr: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch (e) {
    console.warn("Failed to decode Uint8Array as UTF-8, trying lossy:", e);
    return new TextDecoder("utf-8", { fatal: false }).decode(arr);
  }
};

// Keep EMPTY constants for default values if needed, but don't pass them directly if live data exists
const EMPTY_API_KEYS: DbApiKey[] = [];
const EMPTY_SIDEBAR_ITEMS: SidebarItem[] = [];

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
}) => {
  // --- Core State Management ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatInput = useChatInput();

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
    }
  }, []);

  // --- Hook Instantiation ---
  const providerModel = useProviderModelSelection({
    providers,
    initialProviderId,
    initialModelId,
  });
  const storage = useChatStorage(); // Contains live query results

  const apiKeysMgmt = useApiKeysManagement({
    // Pass the LIVE data from storage here
    apiKeys: storage.apiKeys || EMPTY_API_KEYS,
    addDbApiKey: storage.addApiKey,
    deleteDbApiKey: storage.deleteApiKey,
  });

  const stopStreamingCallback = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      stopStreamingCallback();
      chatInput.clearSelectedVfsPaths();
      chatInput.clearAttachedFiles();
      setMessages([]);
      setIsLoadingMessages(!!id);
      setErrorState(null);
      // Log selection change
      console.log(
        `[ChatProvider] handleSelectItem called: ID=${id}, Type=${type}`,
      );
    },
    [stopStreamingCallback, chatInput],
  );

  const conversationMgmt = useConversationManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem,
    toggleDbVfs: storage.toggleVfsEnabled,
    getProject: storage.getProject,
    getConversation: storage.getConversation,
    getMessagesForConversation: storage.getMessagesForConversation,
    bulkAddMessages: storage.bulkAddMessages,
    updateConversationTimestamp: storage.updateConversationTimestamp,
    countChildProjects: storage.countChildProjects,
    countChildConversations: storage.countChildConversations,
  });

  // --- Derive active data directly from storage based on selection ---
  // FIX 1: Correct dependencies and lookup logic for activeItemData
  const activeItemData = useMemo(() => {
    const { selectedItemId, selectedItemType } = conversationMgmt;
    console.log(
      `[ChatProvider] Recalculating activeItemData for ID: ${selectedItemId}, Type: ${selectedItemType}`,
    );
    if (!selectedItemId || !selectedItemType) return null;

    // Perform lookup inside the memo using the latest storage values
    if (selectedItemType === "conversation") {
      // Use the live array from storage directly inside the memo
      return storage.conversations.find((c) => c.id === selectedItemId) || null;
    } else if (selectedItemType === "project") {
      // Use the live array from storage directly inside the memo
      return storage.projects.find((p) => p.id === selectedItemId) || null;
    }
    return null;
    // Depend ONLY on the stable ID and Type from conversationMgmt state
  }, [conversationMgmt, storage.conversations, storage.projects]); // Keep storage arrays here because the *lookup* needs the latest data

  const activeConversationData = useMemo(() => {
    return conversationMgmt.selectedItemType === "conversation"
      ? (activeItemData as DbConversation | null)
      : null;
  }, [conversationMgmt.selectedItemType, activeItemData]);

  const activeProjectData = useMemo(() => {
    return conversationMgmt.selectedItemType === "project"
      ? (activeItemData as DbProject | null)
      : null;
  }, [conversationMgmt.selectedItemType, activeItemData]);
  // --- End Derive active data ---

  const chatSettings = useChatSettings({
    activeConversationData: activeConversationData,
    activeProjectData: activeProjectData,
  });

  // --- VFS (remains disabled) ---
  const vfsEnabled = useMemo(() => false, []);
  const vfs = useVirtualFileSystem({
    itemId: conversationMgmt.selectedItemId,
    itemType: conversationMgmt.selectedItemType,
    isEnabled: vfsEnabled,
  });
  useEffect(() => {
    if (!vfsEnabled && chatInput.selectedVfsPaths.length > 0) {
      chatInput.clearSelectedVfsPaths();
    }
  }, [vfsEnabled, chatInput]);
  // --- End VFS ---

  // --- AI Interaction & Message Handling ---
  const aiInteraction = useAiInteraction({
    selectedModel: providerModel.selectedModel,
    selectedProvider: providerModel.selectedProvider,
    getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages: setMessages,
    setIsAiStreaming: setIsStreaming,
    setError,
    addDbMessage: storage.addDbMessage,
    abortControllerRef,
  });

  const messageHandling = useMessageHandling({
    selectedConversationId:
      conversationMgmt.selectedItemType === "conversation"
        ? conversationMgmt.selectedItemId
        : null,
    performAiStream: aiInteraction.performAiStream,
    stopStreamingCallback,
    activeSystemPrompt: chatSettings.activeSystemPrompt,
    temperature: chatSettings.temperature,
    maxTokens: chatSettings.maxTokens,
    topP: chatSettings.topP,
    topK: chatSettings.topK,
    presencePenalty: chatSettings.presencePenalty,
    frequencyPenalty: chatSettings.frequencyPenalty,
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

  // --- Top-Level Handlers ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = chatInput.prompt.trim();
      const canSubmit =
        currentPrompt.length > 0 || chatInput.attachedFiles.length > 0;

      if (!canSubmit) return;
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      if (!providerModel.selectedProvider || !providerModel.selectedModel) {
        setError("Error: Please select an AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      let conversationIdToSubmit: string | null = null;
      let parentProjectId: string | null = null;

      // Determine parent and target conversation ID based on current selection
      if (
        conversationMgmt.selectedItemType === "project" &&
        conversationMgmt.selectedItemId
      ) {
        parentProjectId = conversationMgmt.selectedItemId;
      } else if (
        conversationMgmt.selectedItemType === "conversation" &&
        conversationMgmt.selectedItemId
      ) {
        // Use the memoized activeConversationData to find parentId
        parentProjectId = activeConversationData?.parentId ?? null;
        conversationIdToSubmit = conversationMgmt.selectedItemId;
      }

      // If no conversation is selected (e.g., a project is selected, or nothing is), create one
      if (!conversationIdToSubmit) {
        try {
          const title = currentPrompt.substring(0, 50) || "New Chat";
          // Create conversation, potentially under the selected project (parentProjectId)
          const newConvId = await conversationMgmt.createConversation(
            parentProjectId,
            title,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
          // Note: createConversation already selects the new item, triggering message load
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

      // --- VFS/Upload Handling (remains disabled for now) ---
      let uploadInfo = "";
      if (chatInput.attachedFiles.length > 0) {
        toast.warning("File attaching is temporarily disabled for debugging.");
        uploadInfo = `
          [File attaching disabled]`;
        chatInput.clearAttachedFiles();
      }
      const pathsIncludedInContext: string[] = [];
      if (chatInput.selectedVfsPaths.length > 0) {
        toast.warning("VFS context is temporarily disabled for debugging.");
        chatInput.clearSelectedVfsPaths();
      }
      // --- End VFS/Upload Handling ---

      const originalUserPrompt = currentPrompt;
      const promptToSendToAI = originalUserPrompt + uploadInfo;

      chatInput.setPrompt(""); // Clear input immediately

      // Only proceed if there's actual text content to send
      if (promptToSendToAI.trim().length > 0) {
        await messageHandling.handleSubmitCore(
          originalUserPrompt,
          conversationIdToSubmit,
          promptToSendToAI,
          pathsIncludedInContext,
        );
      } else {
        console.log(
          "Submission skipped: empty prompt after processing VFS/uploads.",
        );
        // If only files were attached (and uploads worked), we might still want
        // to add a user message indicating files were sent, even if text prompt is empty.
        // For now, it skips if the text part is empty.
      }
    },
    [
      chatInput,
      isStreaming,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      conversationMgmt, // Includes selectedItemId/Type and createConversation
      activeConversationData, // Memoized derived state for parentId lookup
      setError,
      messageHandling,
    ],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (
        conversationMgmt.selectedItemType !== "conversation" ||
        !conversationMgmt.selectedItemId
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
      conversationMgmt.selectedItemType,
      conversationMgmt.selectedItemId,
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
      if (
        conversationMgmt.selectedItemType === "project" &&
        conversationMgmt.selectedItemId
      ) {
        parentId = conversationMgmt.selectedItemId;
      } else if (
        conversationMgmt.selectedItemType === "conversation" &&
        conversationMgmt.selectedItemId
      ) {
        parentId = activeConversationData?.parentId ?? null;
      }
      await conversationMgmt.importConversation(file, parentId);
    },
    [conversationMgmt, activeConversationData],
  );

  // --- Context Value Construction ---
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
      prompt: chatInput.prompt,
      setPrompt: chatInput.setPrompt,
      handleSubmitCore: messageHandling.handleSubmitCore,
      stopStreamingCore: messageHandling.stopStreamingCore,
      regenerateMessageCore: messageHandling.regenerateMessageCore,
      abortControllerRef,
    }),
    [
      messages,
      isLoadingMessages,
      isStreaming,
      error,
      setError,
      chatInput.prompt,
      chatInput.setPrompt,
      messageHandling.handleSubmitCore,
      messageHandling.stopStreamingCore,
      messageHandling.regenerateMessageCore,
    ],
  );

  const fullContextValue: ChatContextProps = useMemo(
    () => ({
      providers,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      // FIX 2: Provide live data, not static empty arrays
      apiKeys: storage.apiKeys || EMPTY_API_KEYS,
      sidebarItems: conversationMgmt.sidebarItems || EMPTY_SIDEBAR_ITEMS,
      selectedApiKeyId: apiKeysMgmt.selectedApiKeyId,
      setSelectedApiKeyId: apiKeysMgmt.setSelectedApiKeyId,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
      selectedItemId: conversationMgmt.selectedItemId,
      selectedItemType: conversationMgmt.selectedItemType,
      selectItem: conversationMgmt.selectItem,
      createConversation: conversationMgmt.createConversation,
      createProject: conversationMgmt.createProject,
      deleteItem: conversationMgmt.deleteItem,
      renameItem: conversationMgmt.renameItem,
      updateConversationSystemPrompt:
        conversationMgmt.updateConversationSystemPrompt,
      messages: coreContextValue.messages,
      isLoading: coreContextValue.isLoadingMessages, // Use isLoadingMessages alias
      isStreaming: coreContextValue.isStreaming,
      error: coreContextValue.error,
      setError: coreContextValue.setError,
      prompt: coreContextValue.prompt,
      setPrompt: coreContextValue.setPrompt,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      attachedFiles: chatInput.attachedFiles,
      addAttachedFile: chatInput.addAttachedFile,
      removeAttachedFile: chatInput.removeAttachedFile,
      clearAttachedFiles: chatInput.clearAttachedFiles,
      selectedVfsPaths: chatInput.selectedVfsPaths,
      addSelectedVfsPath: chatInput.addSelectedVfsPath,
      removeSelectedVfsPath: chatInput.removeSelectedVfsPath,
      clearSelectedVfsPaths: chatInput.clearSelectedVfsPaths,
      temperature: chatSettings.temperature,
      setTemperature: chatSettings.setTemperature,
      maxTokens: chatSettings.maxTokens,
      setMaxTokens: chatSettings.setMaxTokens,
      globalSystemPrompt: chatSettings.globalSystemPrompt,
      setGlobalSystemPrompt: chatSettings.setGlobalSystemPrompt,
      activeSystemPrompt: chatSettings.activeSystemPrompt,
      topP: chatSettings.topP,
      setTopP: chatSettings.setTopP,
      topK: chatSettings.topK,
      setTopK: chatSettings.setTopK,
      presencePenalty: chatSettings.presencePenalty,
      setPresencePenalty: chatSettings.setPresencePenalty,
      frequencyPenalty: chatSettings.frequencyPenalty,
      setFrequencyPenalty: chatSettings.setFrequencyPenalty,
      theme: chatSettings.theme,
      setTheme: chatSettings.setTheme,
      streamingThrottleRate,
      searchTerm: chatSettings.searchTerm,
      setSearchTerm: chatSettings.setSearchTerm,
      exportConversation: conversationMgmt.exportConversation,
      importConversation: handleImportConversation,
      exportAllConversations: conversationMgmt.exportAllConversations,
      clearAllData: storage.clearAllData,
      vfsEnabled: false, // Keep disabled
      toggleVfsEnabled: conversationMgmt.toggleVfsEnabled,
      vfs: {
        // Dummy VFS object
        isReady: false,
        configuredItemId: null,
        isLoading: false,
        isOperationLoading: false,
        error: "VFS Disabled for Debug",
        listFiles: async () => [],
        readFile: async () => {
          throw new Error("VFS Disabled");
        },
        writeFile: async () => {
          throw new Error("VFS Disabled");
        },
        deleteItem: async () => {
          throw new Error("VFS Disabled");
        },
        createDirectory: async () => {
          throw new Error("VFS Disabled");
        },
        downloadFile: async () => {
          throw new Error("VFS Disabled");
        },
        uploadFiles: async () => {
          throw new Error("VFS Disabled");
        },
        uploadAndExtractZip: async () => {
          throw new Error("VFS Disabled");
        },
        downloadAllAsZip: async () => {
          throw new Error("VFS Disabled");
        },
        rename: async () => {
          throw new Error("VFS Disabled");
        },
      },
      getConversation: storage.getConversation,
      getProject: storage.getProject,
    }),
    [
      // Dependencies (ensure stability where possible)
      providers,
      providerModel.selectedProviderId,
      providerModel.setSelectedProviderId,
      providerModel.selectedModelId,
      providerModel.setSelectedModelId,
      storage.apiKeys, // Live data
      conversationMgmt.sidebarItems, // Live data
      apiKeysMgmt.selectedApiKeyId,
      apiKeysMgmt.setSelectedApiKeyId,
      apiKeysMgmt.addApiKey,
      apiKeysMgmt.deleteApiKey,
      apiKeysMgmt.getApiKeyForProvider,
      conversationMgmt.selectedItemId,
      conversationMgmt.selectedItemType,
      conversationMgmt.selectItem,
      conversationMgmt.createConversation,
      conversationMgmt.createProject,
      conversationMgmt.deleteItem,
      conversationMgmt.renameItem,
      conversationMgmt.updateConversationSystemPrompt,
      conversationMgmt.exportConversation,
      conversationMgmt.exportAllConversations,
      conversationMgmt.toggleVfsEnabled,
      coreContextValue, // Memoized core state
      handleSubmit, // useCallback
      stopStreaming, // useCallback
      regenerateMessage, // useCallback
      handleImportConversation, // useCallback
      chatInput, // Memoized input state
      chatSettings, // Memoized settings state
      streamingThrottleRate,
      storage.clearAllData, // useCallback from storage
      storage.getConversation, // useCallback from storage
      storage.getProject, // useCallback from storage
    ],
  );

  // Log when messages state changes
  useEffect(() => {
    console.log("[ChatProvider] Messages state updated:", messages);
  }, [messages]);

  // Log when loading state changes
  useEffect(() => {
    console.log(
      "[ChatProvider] isLoadingMessages state updated:",
      isLoadingMessages,
    );
  }, [isLoadingMessages]);

  return (
    <CoreChatContext.Provider value={coreContextValue}>
      <ChatContext.Provider value={fullContextValue}>
        {children}
      </ChatContext.Provider>
    </CoreChatContext.Provider>
  );
};
