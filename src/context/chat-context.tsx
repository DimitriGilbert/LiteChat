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
  DbApiKey,
  SidebarItem,
  ProjectSidebarItem, // Import specific types
  ConversationSidebarItem, // Import specific types
} from "@/lib/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { CoreChatContext } from "@/context/core-chat-context";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import { useApiKeysManagement } from "@/hooks/use-api-keys-management";
// Import the renamed hook
import { useSidebarManagement } from "@/hooks/use-sidebar-management";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useAiInteraction } from "@/hooks/use-ai-interaction";
import { useChatInput } from "@/hooks/use-chat-input";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useVirtualFileSystem } from "@/hooks/use-virtual-file-system";
import { toast } from "sonner";

// Interface for ChatProviderProps remains the same
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
  // --- Core State Management (remains the same) ---
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
  const storage = useChatStorage(); // Contains live query results and DB functions

  // --- Combine Projects and Conversations into SidebarItems ---
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
    // Sort by updatedAt descending
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [storage.projects, storage.conversations]);

  // --- State for derived active data ---
  const [activeItemId, setActiveItemId] = useState<string | null>(
    initialSelectedItemId,
  );
  const [activeItemType, setActiveItemType] = useState<SidebarItemType | null>(
    initialSelectedItemType,
  );

  // --- Callback for Sidebar Management Hook ---
  // This is called by useSidebarManagement when an item is selected
  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      // Stop streaming and clear inputs regardless of selection change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      chatInput.clearSelectedVfsPaths();
      chatInput.clearAttachedFiles();
      setMessages([]); // Clear messages immediately
      setErrorState(null); // Clear errors

      // Update the state that determines the active data
      setActiveItemId(id);
      setActiveItemType(type);
      setIsLoadingMessages(!!id); // Set loading only if an item is selected

      console.log(
        `[ChatProvider] handleSelectItem updated state: ID=${id}, Type=${type}`,
      );
    },
    [chatInput], // Removed stopStreamingCallback dependency
  );

  // --- Instantiate Sidebar Management Hook ---
  const sidebarMgmt = useSidebarManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem, // Pass the callback
    // Pass DB functions from storage
    dbCreateConversation: storage.createConversation,
    dbCreateProject: storage.createProject,
    dbDeleteConversation: storage.deleteConversation,
    dbDeleteProject: storage.deleteProject,
    dbRenameConversation: storage.renameConversation,
    dbRenameProject: storage.renameProject,
    dbUpdateConversationSystemPrompt: storage.updateConversationSystemPrompt,
    dbGetConversation: storage.getConversation,
    dbGetMessagesForConversation: storage.getMessagesForConversation,
    dbBulkAddMessages: storage.bulkAddMessages,
    dbUpdateConversationTimestamp: storage.updateConversationTimestamp,
    dbCountChildProjects: storage.countChildProjects,
    dbCountChildConversations: storage.countChildConversations,
    dbToggleVfsEnabled: storage.toggleVfsEnabled,
    sidebarItems: sidebarItems, // Pass the live, sorted items array
  });

  // --- Derive active data based on activeItemId/Type ---
  const activeItemData = useMemo(() => {
    console.log(
      `[ChatProvider] Recalculating activeItemData for ID: ${activeItemId}, Type: ${activeItemType}`,
    );
    if (!activeItemId || !activeItemType) return null;

    // Find in the combined sidebarItems list
    const item = sidebarItems.find((i) => i.id === activeItemId);
    // Ensure the type matches (should always match if state is consistent)
    if (item && item.type === activeItemType) {
      return item;
    }
    console.warn(
      `[ChatProvider] Could not find active item (${activeItemId}, ${activeItemType}) in sidebarItems list.`,
    );
    return null;
  }, [activeItemId, activeItemType, sidebarItems]); // Depend on ID, Type, and the items list

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
  // --- End Derive active data ---

  // --- Instantiate other hooks (ApiKeys, Settings, VFS, AI, Messages) ---
  const apiKeysMgmt = useApiKeysManagement({
    apiKeys: storage.apiKeys || EMPTY_API_KEYS,
    addDbApiKey: storage.addApiKey,
    deleteDbApiKey: storage.deleteApiKey,
  });

  const chatSettings = useChatSettings({
    activeConversationData: activeConversationData,
    activeProjectData: activeProjectData,
  });

  // VFS remains disabled for now
  const vfsEnabled = useMemo(
    () => activeItemData?.vfsEnabled ?? false,
    [activeItemData],
  );
  const vfs = useVirtualFileSystem({
    itemId: activeItemId, // Use derived active ID
    itemType: activeItemType, // Use derived active Type
    isEnabled: vfsEnabled,
  });
  useEffect(() => {
    if (!vfsEnabled && chatInput.selectedVfsPaths.length > 0) {
      chatInput.clearSelectedVfsPaths();
    }
  }, [vfsEnabled, chatInput]);

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
    selectedConversationId: activeConversationData?.id ?? null, // Use derived data
    performAiStream: aiInteraction.performAiStream,
    stopStreamingCallback: useCallback(() => {
      // Define stopStreamingCallback inline or memoize separately if needed elsewhere
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
    }, []),
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

      // Determine parent and target conversation ID based on current selection (using activeItem state)
      if (activeItemType === "project" && activeItemId) {
        parentProjectId = activeItemId;
      } else if (activeItemType === "conversation" && activeItemId) {
        // Use the memoized activeConversationData to find parentId
        parentProjectId = activeConversationData?.parentId ?? null;
        conversationIdToSubmit = activeItemId;
      }

      // If no conversation is selected (e.g., a project is selected, or nothing is), create one
      if (!conversationIdToSubmit) {
        try {
          const title = currentPrompt.substring(0, 50) || "New Chat";
          // Use the sidebarMgmt hook's createConversation function
          const newConvId = await sidebarMgmt.createConversation(
            parentProjectId,
            title,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
          // Note: sidebarMgmt.createConversation already selects the new item, triggering message load via handleSelectItem
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
      }
    },
    [
      chatInput,
      isStreaming,
      providerModel.selectedProvider,
      providerModel.selectedModel,
      activeItemId, // Use state for selection
      activeItemType, // Use state for selection
      activeConversationData, // Memoized derived state for parentId lookup
      sidebarMgmt, // Use sidebarMgmt.createConversation
      setError,
      messageHandling,
    ],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (activeItemType !== "conversation" || !activeItemId) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await messageHandling.regenerateMessageCore(messageId);
    },
    [messageHandling, activeItemType, activeItemId, isStreaming],
  );

  const stopStreaming = useCallback(() => {
    messageHandling.stopStreamingCore();
    toast.info("AI response stopped.");
  }, [messageHandling]);

  const handleImportConversation = useCallback(
    async (file: File) => {
      let parentId: string | null = null;
      if (activeItemType === "project" && activeItemId) {
        parentId = activeItemId;
      } else if (activeItemType === "conversation" && activeItemId) {
        parentId = activeConversationData?.parentId ?? null;
      }
      // Use the sidebarMgmt hook's import function
      await sidebarMgmt.importConversation(file, parentId);
    },
    [sidebarMgmt, activeItemType, activeItemId, activeConversationData],
  );

  const handleToggleVfs = useCallback(async () => {
    if (!activeItemId || !activeItemType) {
      toast.warning("No item selected.");
      return;
    }
    // Use the sidebarMgmt hook's toggle function
    await sidebarMgmt.toggleVfsEnabled(
      activeItemId,
      activeItemType,
      vfsEnabled, // Pass the current state
    );
    // Note: The vfsEnabled state will update via the activeItemData memo
  }, [sidebarMgmt, activeItemId, activeItemType, vfsEnabled]);

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
      // Provider/Model Selection
      providers,
      selectedProviderId: providerModel.selectedProviderId,
      setSelectedProviderId: providerModel.setSelectedProviderId,
      selectedModelId: providerModel.selectedModelId,
      setSelectedModelId: providerModel.setSelectedModelId,
      // API Key Management
      apiKeys: storage.apiKeys || EMPTY_API_KEYS,
      selectedApiKeyId: apiKeysMgmt.selectedApiKeyId,
      setSelectedApiKeyId: apiKeysMgmt.setSelectedApiKeyId,
      addApiKey: apiKeysMgmt.addApiKey,
      deleteApiKey: apiKeysMgmt.deleteApiKey,
      getApiKeyForProvider: apiKeysMgmt.getApiKeyForProvider,
      // Sidebar / Item Management (from sidebarMgmt and provider state)
      sidebarItems: sidebarItems || EMPTY_SIDEBAR_ITEMS, // Use combined list
      selectedItemId: sidebarMgmt.selectedItemId, // Use state from hook
      selectedItemType: sidebarMgmt.selectedItemType, // Use state from hook
      selectItem: sidebarMgmt.selectItem,
      createConversation: sidebarMgmt.createConversation,
      createProject: sidebarMgmt.createProject,
      deleteItem: sidebarMgmt.deleteItem,
      renameItem: sidebarMgmt.renameItem,
      updateConversationSystemPrompt:
        sidebarMgmt.updateConversationSystemPrompt,
      // Messages & Streaming (Core)
      messages: coreContextValue.messages,
      isLoading: coreContextValue.isLoadingMessages,
      isStreaming: coreContextValue.isStreaming,
      error: coreContextValue.error,
      setError: coreContextValue.setError,
      // Input Handling (Core + Optional)
      prompt: coreContextValue.prompt,
      setPrompt: coreContextValue.setPrompt,
      handleSubmit, // Use top-level handler
      stopStreaming, // Use top-level handler
      regenerateMessage, // Use top-level handler
      attachedFiles: chatInput.attachedFiles,
      addAttachedFile: chatInput.addAttachedFile,
      removeAttachedFile: chatInput.removeAttachedFile,
      clearAttachedFiles: chatInput.clearAttachedFiles,
      selectedVfsPaths: chatInput.selectedVfsPaths,
      addSelectedVfsPath: chatInput.addSelectedVfsPath,
      removeSelectedVfsPath: chatInput.removeSelectedVfsPath,
      clearSelectedVfsPaths: chatInput.clearSelectedVfsPaths,
      // Settings
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
      // Import/Export & Data Management
      exportConversation: sidebarMgmt.exportConversation,
      importConversation: handleImportConversation, // Use top-level handler
      exportAllConversations: sidebarMgmt.exportAllConversations,
      clearAllData: storage.clearAllData,
      // Virtual File System
      vfsEnabled: vfsEnabled, // Use derived state
      toggleVfsEnabled: handleToggleVfs, // Use top-level handler
      vfs: vfs, // Pass the VFS hook result
      // Pass required DB functions (still needed by some components directly?)
      // Consider removing these if all consumers use context actions
      getConversation: storage.getConversation,
      getProject: storage.getProject,
    }),
    [
      // Dependencies
      providers,
      providerModel.selectedProviderId,
      providerModel.setSelectedProviderId,
      providerModel.selectedModelId,
      providerModel.setSelectedModelId,
      storage.apiKeys,
      apiKeysMgmt.selectedApiKeyId,
      apiKeysMgmt.setSelectedApiKeyId,
      apiKeysMgmt.addApiKey,
      apiKeysMgmt.deleteApiKey,
      apiKeysMgmt.getApiKeyForProvider,
      sidebarItems, // Combined list
      sidebarMgmt.selectedItemId,
      sidebarMgmt.selectedItemType,
      sidebarMgmt.selectItem,
      sidebarMgmt.createConversation,
      sidebarMgmt.createProject,
      sidebarMgmt.deleteItem,
      sidebarMgmt.renameItem,
      sidebarMgmt.updateConversationSystemPrompt,
      sidebarMgmt.exportConversation,
      sidebarMgmt.exportAllConversations,
      coreContextValue,
      handleSubmit,
      stopStreaming,
      regenerateMessage,
      handleImportConversation,
      chatInput,
      chatSettings,
      streamingThrottleRate,
      storage.clearAllData,
      vfsEnabled,
      handleToggleVfs,
      vfs,
      storage.getConversation,
      storage.getProject,
    ],
  );

  // Log when active item changes
  useEffect(() => {
    console.log(
      `[ChatProvider] Active item state updated: ID=${activeItemId}, Type=${activeItemType}`,
    );
  }, [activeItemId, activeItemType]);

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
