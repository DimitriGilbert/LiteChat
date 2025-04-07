// src/context/chat-context.tsx
import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef, // Import useRef
} from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  DbMessage,
  SidebarItemType,
  Message,
} from "@/lib/types";
import { ChatContext } from "@/hooks/use-chat-context";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import { useApiKeysManagement } from "@/hooks/use-api-keys-management";
import { useConversationManagement } from "@/hooks/use-conversation-management";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useAiInteraction } from "@/hooks/use-ai-interaction";
import { useChatInput } from "@/hooks/use-chat-input";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { toast } from "sonner";

interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null;
  initialSelectedItemType?: SidebarItemType | null;
  streamingThrottleRate?: number;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null,
  initialSelectedItemType = null,
  streamingThrottleRate = 42,
}) => {
  // --- State for AI Streaming and Messages ---
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);

  // Ref for AI abort controller - owned by the provider
  const abortControllerRef = useRef<AbortController | null>(null);

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
    }
  }, []);

  // --- Hook Instantiation ---

  const {
    selectedProviderId,
    setSelectedProviderId,
    selectedModelId,
    setSelectedModelId,
    selectedProvider,
    selectedModel,
  } = useProviderModelSelection({
    providers,
    initialProviderId,
    initialModelId,
  });

  const {
    apiKeys,
    selectedApiKeyId,
    setSelectedApiKeyId,
    addApiKey,
    deleteApiKey,
    getApiKeyForProvider,
  } = useApiKeysManagement();

  const { addDbMessage, deleteDbMessage, getDbMessagesUpTo } = useChatStorage();

  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      console.log(
        `ChatProvider: handleSelectItem called with id=${id}, type=${type}`,
      );
      if (abortControllerRef.current) {
        console.log(
          "ChatProvider: Aborting stream via ref due to selection change.",
        );
        abortControllerRef.current.abort();
        // No need to nullify the ref here, the finally block in useAiInteraction
        // or the stopStreamingCallback will handle it based on the signal.
        toast.info("AI response stopped due to selection change.");
      }
    },
    [], // abortControllerRef is stable, no need to list as dependency
  );

  const {
    sidebarItems,
    selectedItemId,
    selectedItemType,
    selectItem,
    createConversation,
    createProject,
    deleteItem,
    renameItem,
    updateConversationSystemPrompt,
    exportConversation,
    importConversation,
    exportAllConversations,
    activeConversationData,
  } = useConversationManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem,
  });

  const {
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    globalSystemPrompt,
    setGlobalSystemPrompt,
    activeSystemPrompt,
    topP,
    setTopP,
    topK,
    setTopK,
    presencePenalty,
    setPresencePenalty,
    frequencyPenalty,
    setFrequencyPenalty,
    theme,
    setTheme,
    searchTerm,
    setSearchTerm,
  } = useChatSettings({ activeConversationData });

  const {
    prompt,
    setPrompt,
    attachedFiles,
    addAttachedFile,
    removeAttachedFile,
    clearAttachedFiles,
  } = useChatInput();

  // AI Interaction Hook - Pass the abortControllerRef
  const { performAiStream } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages,
    setIsAiStreaming,
    setError,
    addDbMessage,
    abortControllerRef, // Pass the ref here
  });

  // Message Handling Hook
  const {
    handleSubmit: handleMessageSubmit,
    regenerateMessage: handleMessageRegenerate,
    stopStreaming: stopMessageStreaming,
  } = useMessageHandling({
    selectedConversationId:
      selectedItemType === "conversation" ? selectedItemId : null,
    performAiStream,
    stopStreamingCallback: () => {
      // Callback to actually abort the stream using the provider's ref
      if (abortControllerRef.current) {
        console.log("ChatProvider: stopStreamingCallback aborting via ref.");
        abortControllerRef.current.abort();
        // No need to nullify ref here, finally block handles it.
      } else {
        console.log(
          "ChatProvider: stopStreamingCallback called but no active abortController.",
        );
      }
    },
    activeSystemPrompt,
    temperature,
    maxTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    isAiStreaming,
    setIsAiStreaming, // Pass setter needed by stopStreaming logic within useMessageHandling
    localMessages,
    setLocalMessages,
    isLoadingMessages,
    setIsLoadingMessages,
    error,
    setError,
    addDbMessage,
    deleteDbMessage,
    // getDbMessagesUpTo, // Pass if needed by useMessageHandling (currently not)
  });

  // --- Final Submit Handler (Top Level) ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      // ... (rest of handleSubmit remains the same) ...
      const currentPrompt = prompt.trim();
      const canSubmit = currentPrompt.length > 0;

      if (!canSubmit) return;
      if (isAiStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      if (!selectedProvider || !selectedModel) {
        setError("Error: Please select an AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      let conversationIdToSubmit: string | null = null;
      let parentProjectId: string | null = null;

      if (selectedItemType === "project" && selectedItemId) {
        parentProjectId = selectedItemId;
      } else if (selectedItemType === "conversation" && selectedItemId) {
        parentProjectId = activeConversationData?.parentId ?? null;
        conversationIdToSubmit = selectedItemId;
      }

      if (!conversationIdToSubmit) {
        try {
          const newConvId = await createConversation(
            parentProjectId,
            currentPrompt.substring(0, 50) || "New Chat",
            activeConversationData?.systemPrompt ?? globalSystemPrompt,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
          // Selection happens within createConversation's flow
        } catch (err: any) {
          console.error("Error creating conversation during submit:", err);
          setError(`Error: Could not start chat - ${err.message}`);
          toast.error(`Failed to start chat: ${err.message}`);
          return;
        }
      }

      if (!conversationIdToSubmit) {
        setError("Error: Could not determine target conversation for submit.");
        toast.error("Could not determine target conversation.");
        return;
      }

      const promptToSend = currentPrompt;
      setPrompt("");
      clearAttachedFiles();

      await handleMessageSubmit(promptToSend, conversationIdToSubmit);
    },
    [
      prompt,
      isAiStreaming,
      selectedItemId,
      selectedItemType,
      selectedProvider,
      selectedModel,
      createConversation,
      activeConversationData,
      globalSystemPrompt,
      setPrompt,
      clearAttachedFiles,
      handleMessageSubmit,
      setError,
    ],
  );

  // --- Final Regenerate Handler (Top Level) ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      // ... (rest of regenerateMessage remains the same) ...
      if (selectedItemType !== "conversation" || !selectedItemId) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isAiStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      await handleMessageRegenerate(messageId);
    },
    [handleMessageRegenerate, selectedItemType, selectedItemId, isAiStreaming],
  );

  // --- Modified Import Handler (Top Level) ---
  const handleImportConversation = useCallback(
    async (file: File) => {
      // ... (rest of handleImportConversation remains the same) ...
      let parentId: string | null = null;
      if (selectedItemType === "project" && selectedItemId) {
        parentId = selectedItemId;
      } else if (selectedItemType === "conversation" && selectedItemId) {
        parentId = activeConversationData?.parentId ?? null;
      }
      await importConversation(file, parentId);
    },
    [
      importConversation,
      selectedItemId,
      selectedItemType,
      activeConversationData,
    ],
  );

  // --- Context Value Construction ---
  const contextValue: ChatContextProps = useMemo(
    () => ({
      // ... (Include all necessary values, ensure they are stable or memoized) ...
      providers,
      selectedProviderId,
      setSelectedProviderId,
      selectedModelId,
      setSelectedModelId,
      apiKeys,
      selectedApiKeyId,
      setSelectedApiKeyId,
      addApiKey,
      deleteApiKey,
      getApiKeyForProvider,
      sidebarItems,
      selectedItemId,
      selectedItemType,
      selectItem,
      createConversation,
      createProject,
      deleteItem,
      renameItem,
      updateConversationSystemPrompt,
      activeConversationData,
      messages: localMessages,
      isLoading: isLoadingMessages,
      isStreaming: isAiStreaming,
      error,
      setError,
      prompt,
      setPrompt,
      handleSubmit,
      stopStreaming: stopMessageStreaming,
      regenerateMessage,
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      temperature,
      setTemperature,
      maxTokens,
      setMaxTokens,
      globalSystemPrompt,
      setGlobalSystemPrompt,
      activeSystemPrompt,
      topP,
      setTopP,
      topK,
      setTopK,
      presencePenalty,
      setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty,
      theme,
      setTheme,
      streamingThrottleRate,
      searchTerm,
      setSearchTerm,
      exportConversation,
      importConversation: handleImportConversation,
      exportAllConversations,
    }),
    [
      // Add ALL dependencies...
      providers,
      selectedProviderId,
      setSelectedProviderId,
      selectedModelId,
      setSelectedModelId,
      apiKeys,
      selectedApiKeyId,
      setSelectedApiKeyId,
      addApiKey,
      deleteApiKey,
      getApiKeyForProvider,
      sidebarItems,
      selectedItemId,
      selectedItemType,
      selectItem,
      createConversation,
      createProject,
      deleteItem,
      renameItem,
      updateConversationSystemPrompt,
      activeConversationData,
      localMessages,
      isLoadingMessages,
      isAiStreaming,
      error,
      setError,
      prompt,
      setPrompt,
      handleSubmit,
      stopMessageStreaming,
      regenerateMessage,
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      temperature,
      setTemperature,
      maxTokens,
      setMaxTokens,
      globalSystemPrompt,
      setGlobalSystemPrompt,
      activeSystemPrompt,
      topP,
      setTopP,
      topK,
      setTopK,
      presencePenalty,
      setPresencePenalty,
      frequencyPenalty,
      setFrequencyPenalty,
      theme,
      setTheme,
      streamingThrottleRate,
      searchTerm,
      setSearchTerm,
      exportConversation,
      handleImportConversation,
      exportAllConversations,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
