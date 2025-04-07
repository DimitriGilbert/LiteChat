// src/context/chat-context.tsx
import React, {
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";
import type {
  AiProviderConfig,
  ChatContextProps,
  DbMessage,
  SidebarItemType,
  Message, // Import Message type
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
  initialSelectedItemId?: string | null; // Changed from initialConversationId
  initialSelectedItemType?: SidebarItemType | null; // Added
  streamingThrottleRate?: number;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialSelectedItemId = null, // Use new initial prop
  initialSelectedItemType = null, // Use new initial prop
  streamingThrottleRate = 42, // ~24fps
}) => {
  // --- State for AI Streaming and Messages ---
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  // This state holds the messages for the *currently selected* conversation
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);

  // Ref for AI abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
      // Optionally show toast here too, though individual hooks might be better
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

  // Instantiate useChatStorage ONCE to provide DB functions
  // We only need the action functions here, not the live query results directly.
  const { addDbMessage, deleteDbMessage, getDbMessagesUpTo } = useChatStorage();

  // Define the callback for item selection passed to useConversationManagement
  const handleSelectItem = useCallback(
    (id: string | null, type: SidebarItemType | null) => {
      console.log(
        `ChatProvider: handleSelectItem called with id=${id}, type=${type}`,
      );
      // Abort any ongoing stream if selection changes
      if (abortControllerRef.current) {
        console.log("ChatProvider: Aborting stream due to selection change.");
        abortControllerRef.current.abort();
        abortControllerRef.current = null; // Clear the ref after aborting
        // Note: isAiStreaming state will be set to false within performAiStream's finally block
        toast.info("AI response stopped due to selection change.");
      }
      // Reset message state is handled by useMessageHandling's effect based on selectedConversationId change
    },
    [], // No dependencies needed here as it only uses the ref
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
    importConversation, // This is the raw function from the hook
    exportAllConversations,
    activeConversationData,
  } = useConversationManagement({
    initialSelectedItemId,
    initialSelectedItemType,
    onSelectItem: handleSelectItem, // Pass the callback
  });

  // Pass activeConversationData (which is DbConversation | null)
  const {
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    globalSystemPrompt,
    setGlobalSystemPrompt,
    activeSystemPrompt, // This now correctly uses activeConversationData
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

  // AI Interaction Hook
  const { performAiStream } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages, // Pass the state setter
    setIsAiStreaming, // Pass the state setter
    setError, // Pass the error setter
    addDbMessage, // Pass the DB function
    abortControllerRef, // Pass the ref
  });

  // Message Handling Hook - Manages loading/displaying messages for the selected conversation
  const {
    handleSubmit: handleMessageSubmit, // Renamed to avoid conflict
    regenerateMessage: handleMessageRegenerate, // Renamed to avoid conflict
    stopStreaming: stopMessageStreaming, // Renamed to avoid conflict
  } = useMessageHandling({
    // Pass selectedItemId ONLY if it's a conversation
    selectedConversationId:
      selectedItemType === "conversation" ? selectedItemId : null,
    performAiStream, // Pass the AI function
    stopStreamingCallback: () => {
      // Callback to actually abort the stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    },
    activeSystemPrompt, // Pass derived system prompt
    temperature,
    maxTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    isAiStreaming, // Pass streaming state
    setIsAiStreaming, // Pass streaming state setter (needed by stopStreamingCallback logic)
    localMessages, // Pass message state
    setLocalMessages, // Pass message state setter
    isLoadingMessages, // Pass loading state
    setIsLoadingMessages, // Pass loading state setter
    error, // Pass error state
    setError, // Pass error state setter
    addDbMessage, // Pass DB function
    deleteDbMessage, // Pass DB function
    getDbMessagesUpTo, // Pass DB function
  });

  // --- Final Submit Handler (Top Level) ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      console.log("ChatProvider: handleSubmit triggered.");
      const currentPrompt = prompt.trim();
      const canSubmit = currentPrompt.length > 0;

      if (!canSubmit) {
        console.log("ChatProvider: Submit prevented - empty prompt.");
        return;
      }
      if (isAiStreaming) {
        console.log("ChatProvider: Submit prevented - AI is streaming.");
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

      // Determine parentId for potential new conversation
      if (selectedItemType === "project" && selectedItemId) {
        parentProjectId = selectedItemId; // Create inside the selected project
      } else if (selectedItemType === "conversation" && selectedItemId) {
        // If a conversation is selected, use its parentId for the new one
        // Fetch the current conversation's data if needed (or rely on activeConversationData)
        parentProjectId = activeConversationData?.parentId ?? null;
        conversationIdToSubmit = selectedItemId; // Submit to existing conversation
        console.log(
          `ChatProvider: Submitting to existing conversation: ${conversationIdToSubmit}`,
        );
      }
      // If nothing is selected, parentProjectId remains null (create at root)

      // Case: No conversation selected (or a project is selected) - Create a new one
      if (!conversationIdToSubmit) {
        try {
          console.log(
            `ChatProvider: No conversation selected. Creating new one with parentId: ${parentProjectId}`,
          );
          // createConversation now selects the new chat automatically
          const newConvId = await createConversation(
            parentProjectId,
            currentPrompt.substring(0, 50) || "New Chat", // Use start of prompt for title
            // Use current effective system prompt for the new chat
            activeConversationData?.systemPrompt ?? globalSystemPrompt,
          );
          if (!newConvId)
            throw new Error("Failed to get ID for new conversation.");
          conversationIdToSubmit = newConvId;
          console.log(
            `ChatProvider: New conversation created and selected: ${conversationIdToSubmit}`,
          );
          // No need to call selectItem here, createConversation handles it via its callback chain
        } catch (err: any) {
          console.error("Error creating conversation during submit:", err);
          setError(`Error: Could not start chat - ${err.message}`);
          toast.error(`Failed to start chat: ${err.message}`);
          return; // Stop submission if conversation creation failed
        }
      }

      // Ensure we have a valid conversation ID before proceeding
      if (!conversationIdToSubmit) {
        setError("Error: Could not determine target conversation for submit.");
        toast.error("Could not determine target conversation.");
        console.error(
          "ChatProvider: Submit failed - conversationIdToSubmit is null.",
        );
        return;
      }

      // Clear input and call the message handling hook's submit function
      const promptToSend = currentPrompt;
      setPrompt("");
      clearAttachedFiles(); // Clear any attached files after submit

      console.log(
        `ChatProvider: Calling handleMessageSubmit for convo ${conversationIdToSubmit}`,
      );
      await handleMessageSubmit(promptToSend, conversationIdToSubmit);
      console.log(`ChatProvider: handleMessageSubmit finished.`);
    },
    [
      prompt,
      isAiStreaming,
      selectedItemId,
      selectedItemType,
      selectedProvider,
      selectedModel,
      createConversation, // From useConversationManagement
      activeConversationData, // Need this to get parentId and systemPrompt
      globalSystemPrompt, // Fallback system prompt
      setPrompt, // From useChatInput
      clearAttachedFiles, // From useChatInput
      handleMessageSubmit, // From useMessageHandling
      setError, // Local setter
    ],
  );

  // --- Final Regenerate Handler (Top Level) ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (selectedItemType !== "conversation" || !selectedItemId) {
        toast.error("Please select the conversation containing the message.");
        return;
      }
      if (isAiStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }
      console.log(`ChatProvider: Regenerating message ${messageId}`);
      await handleMessageRegenerate(messageId); // Call handler from useMessageHandling
    },
    [handleMessageRegenerate, selectedItemType, selectedItemId, isAiStreaming],
  );

  // --- Modified Import Handler (Top Level) ---
  // This wrapper determines the parentId based on current selection
  const handleImportConversation = useCallback(
    async (file: File) => {
      let parentId: string | null = null;
      if (selectedItemType === "project" && selectedItemId) {
        parentId = selectedItemId;
      } else if (selectedItemType === "conversation" && selectedItemId) {
        // Import into the same project as the selected conversation
        parentId = activeConversationData?.parentId ?? null;
      }
      console.log(
        `ChatProvider: Importing conversation with parentId: ${parentId}`,
      );
      await importConversation(file, parentId); // Call the function from useConversationManagement
    },
    [
      importConversation,
      selectedItemId,
      selectedItemType,
      activeConversationData,
    ],
  );

  // --- Context Value Construction ---
  // Ensure all values provided by the context are included here
  const contextValue: ChatContextProps = useMemo(
    () => ({
      // Provider/Model Selection
      providers,
      selectedProviderId,
      setSelectedProviderId,
      selectedModelId,
      setSelectedModelId,
      // API Keys
      apiKeys,
      selectedApiKeyId,
      setSelectedApiKeyId,
      addApiKey,
      deleteApiKey,
      getApiKeyForProvider,
      // Projects & Conversations
      sidebarItems,
      selectedItemId,
      selectedItemType,
      selectItem,
      createConversation,
      createProject,
      deleteItem,
      renameItem,
      updateConversationSystemPrompt,
      activeConversationData, // Pass the specific conversation data
      // Messages & State (Reflects the selected conversation)
      messages: localMessages,
      isLoading: isLoadingMessages,
      isStreaming: isAiStreaming,
      error,
      setError,
      // Input & Submission
      prompt,
      setPrompt,
      handleSubmit, // Use the top-level handleSubmit
      stopStreaming: stopMessageStreaming, // Use the handler from useMessageHandling
      regenerateMessage, // Use the top-level regenerateMessage
      // Files
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      // Settings
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
      // UI Config
      streamingThrottleRate,
      // Search
      searchTerm,
      setSearchTerm,
      // Import/Export
      exportConversation,
      importConversation: handleImportConversation, // Use wrapped handler
      exportAllConversations,
    }),
    [
      // List ALL dependencies used to compute the context value
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
      localMessages, // State for messages
      isLoadingMessages, // State for loading
      isAiStreaming, // State for streaming
      error, // State for error
      setError, // Setter for error
      prompt, // State for input
      setPrompt, // Setter for input
      handleSubmit, // Memoized handler
      stopMessageStreaming, // Memoized handler
      regenerateMessage, // Memoized handler
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
      handleImportConversation, // Memoized handler
      exportAllConversations,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
