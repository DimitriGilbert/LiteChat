// src/context/chat-context.tsx
import React, { useMemo, useCallback, useState } from "react"; // Added useState
import type {
  AiProviderConfig,
  ChatContextProps,
  DbMessage,
} from "@/lib/types"; // Added DbMessage
import { ChatContext } from "@/hooks/use-chat-context";
import { useProviderModelSelection } from "@/hooks/use-provider-model-selection";
import { useApiKeysManagement } from "@/hooks/use-api-keys-management";
import { useConversationManagement } from "@/hooks/use-conversation-management";
import { useChatSettings } from "@/hooks/use-chat-settings";
import { useAiInteraction } from "@/hooks/use-ai-interaction";
import { useChatInput } from "@/hooks/use-chat-input";
import { useMessageHandling } from "@/hooks/use-message-handling";
import { useChatStorage } from "@/hooks/use-chat-storage"; // Import useChatStorage
import { toast } from "sonner";

interface ChatProviderProps {
  children: React.ReactNode;
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialConversationId?: string | null;
  streamingThrottleRate?: number;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({
  children,
  providers,
  initialProviderId = null,
  initialModelId = null,
  initialConversationId = null,
  streamingThrottleRate = 42, // ~24fps
}) => {
  // --- Hook Instantiation ---

  const [isAiStreaming, setIsAiStreaming] = useState(false); // Moved state up

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

  // Instantiate useChatStorage ONCE at the top level
  const {
    addDbMessage,
    deleteDbMessage,
    // We might need conversations list from here if not using the one from useConversationManagement
    // conversations: dbConversations, // Example if needed elsewhere
  } = useChatStorage(null); // Pass null initially, or selectedConversationId if needed globally

  // Define the callback for conversation selection
  const handleConversationSelect = useCallback(
    (id: string | null) => {
      if (isAiStreaming) {
        // Abort stream if conversation changes during streaming
        abortControllerRef.current?.abort(); // Access abort controller ref directly
        setIsAiStreaming(false);
      }
      // Other resets can happen within the selectConversation logic itself
    },
    [isAiStreaming], // Dependency on isAiStreaming
  );

  const {
    conversations, // This list comes from useConversationManagement now
    selectedConversationId,
    selectConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    updateConversationSystemPrompt,
    exportConversation,
    importConversation,
    exportAllConversations,
    activeConversationData,
  } = useConversationManagement({
    initialConversationId,
    onConversationSelect: handleConversationSelect,
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

  // State for message handling hook (error, loading, messages)
  const [localMessages, setLocalMessages] = useState<
    import("@/lib/types").Message[]
  >([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setErrorState] = useState<string | null>(null);

  const setError = useCallback((newError: string | null) => {
    setErrorState(newError);
    if (newError) {
      console.error("Chat Error Context:", newError);
    }
  }, []);

  // AI Interaction Hook - Pass addDbMessage from the top-level useChatStorage instance
  const { performAiStream, abortControllerRef } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages, // Pass the setter from this level
    setIsAiStreaming, // Pass the setter from this level
    setError, // Pass the setter from this level
    addDbMessage, // Pass the function obtained from useChatStorage
  });

  // Message Handling Hook - Pass DB functions and AI stream function
  const {
    handleSubmit: handleMessageSubmit,
    regenerateMessage: handleMessageRegenerate,
    stopStreaming: stopMessageStreaming,
  } = useMessageHandling({
    selectedConversationId,
    performAiStream,
    stopStreamingCallback: () => abortControllerRef.current?.abort(),
    activeSystemPrompt,
    temperature,
    maxTokens,
    topP,
    topK,
    presencePenalty,
    frequencyPenalty,
    isAiStreaming,
    setIsAiStreaming, // Pass down setter
    // Pass down the state/setters managed here:
    localMessages, // Pass state
    setLocalMessages, // Pass setter
    isLoadingMessages, // Pass state
    setIsLoadingMessages, // Pass setter
    error, // Pass state
    setError, // Pass setter
    // Pass DB functions from top-level useChatStorage:
    addDbMessage,
    deleteDbMessage,
  });

  // --- Final Submit Handler ---
  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const currentPrompt = prompt.trim();
      const canSubmit = currentPrompt.length > 0;

      if (!canSubmit || isAiStreaming) {
        return;
      }

      let conversationIdToSubmit = selectedConversationId;

      if (!conversationIdToSubmit) {
        try {
          console.log("No conversation selected, creating new one...");
          const newConvId = await createConversation(
            "New Chat",
            activeSystemPrompt,
          );
          if (!newConvId)
            throw new Error("Failed to create a new conversation ID.");
          conversationIdToSubmit = newConvId;
          console.log("New conversation created:", conversationIdToSubmit);
        } catch (err: any) {
          console.error("Error creating conversation during submit:", err);
          setError(`Error: Could not start chat - ${err.message}`);
          toast.error(`Failed to start chat: ${err.message}`);
          return;
        }
      }

      if (!selectedProvider || !selectedModel) {
        setError("Error: Please select an AI Provider and Model first.");
        toast.error("Please select an AI Provider and Model.");
        return;
      }

      const promptToSend = currentPrompt;
      setPrompt("");
      clearAttachedFiles();

      // Call the submit logic from useMessageHandling
      await handleMessageSubmit(promptToSend, conversationIdToSubmit);
    },
    [
      prompt,
      isAiStreaming,
      selectedConversationId,
      createConversation,
      activeSystemPrompt,
      selectedProvider,
      selectedModel,
      setPrompt,
      clearAttachedFiles,
      handleMessageSubmit, // Use function from useMessageHandling
      setError,
    ],
  );

  // --- Final Regenerate Handler ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      // Call the regenerate logic from useMessageHandling
      await handleMessageRegenerate(messageId);
    },
    [handleMessageRegenerate], // Depends only on the function from the hook
  );

  // --- Context Value Construction ---
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
      // Conversations
      conversations,
      selectedConversationId,
      selectConversation,
      createConversation,
      deleteConversation,
      renameConversation,
      updateConversationSystemPrompt,
      // Messages & State (Managed at this level now)
      messages: localMessages,
      isLoading: isLoadingMessages,
      isStreaming: isAiStreaming,
      error,
      setError,
      // Input & Submission
      prompt,
      setPrompt,
      handleSubmit, // Use the final orchestrated handler
      stopStreaming: stopMessageStreaming, // Use the handler from useMessageHandling
      regenerateMessage, // Use the final orchestrated handler
      // Files (from useChatInput)
      attachedFiles,
      addAttachedFile,
      removeAttachedFile,
      clearAttachedFiles,
      // Settings (from useChatSettings)
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
      // Search (from useChatSettings)
      searchTerm,
      setSearchTerm,
      // Import/Export (from useConversationManagement)
      exportConversation,
      importConversation,
      exportAllConversations,
    }),
    [
      // List ALL dependencies from all hooks and state used in the value object
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
      conversations,
      selectedConversationId,
      selectConversation,
      createConversation,
      deleteConversation,
      renameConversation,
      updateConversationSystemPrompt,
      localMessages,
      isLoadingMessages,
      isAiStreaming,
      error,
      setError, // Use state/setters from this level
      prompt,
      setPrompt,
      handleSubmit,
      stopMessageStreaming,
      regenerateMessage, // Use final handlers
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
      importConversation,
      exportAllConversations,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
