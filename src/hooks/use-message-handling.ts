// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react"; // Removed unused useRef
import type {
  Message,
  DbMessage,
  MessageContent,
  CoreMessage,
  AiModelConfig, // Import missing types
  AiProviderConfig,
} from "@/lib/types";
import { toast } from "sonner";
// Removed unused useChatStorage import
import { useAiInteraction } from "./ai-interaction";
import { modEvents, ModEvent } from "@/mods/events";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils"; // Re-added import
import { nanoid } from "nanoid";

// --- Interface Definitions ---
export interface PerformAiStreamParams {
  conversationIdToUse: string;
  messagesToSend: CoreMessage[]; // Use CoreMessage from types.ts
  currentTemperature: number;
  currentMaxTokens: number | null;
  currentTopP: number | null;
  currentTopK: number | null;
  currentPresencePenalty: number | null;
  currentFrequencyPenalty: number | null;
  systemPromptToUse: string | null;
}

// Props expected by the hook
interface UseMessageHandlingProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: () => string | undefined;
  streamingThrottleRate: number;
  temperature: number;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  activeSystemPrompt: string | null;
  // Core state/setters passed directly
  localMessages: Message[];
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean; // Keep this, it's used in ChatProviderInner
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null; // Keep this, it's used in ChatProviderInner
  setError: (error: string | null) => void;
  // DB functions passed directly
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  deleteDbMessage: (messageId: string) => Promise<void>;
  getMessagesForConversation: (conversationId: string) => Promise<DbMessage[]>;
  getDbMessagesUpTo: (
    convId: string,
    messageId: string,
  ) => Promise<DbMessage[]>;
  // Abort controller ref passed directly
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  // Selected conversation ID needed for loading/regen
  selectedConversationId: string | null;
}

// Return type includes all core handlers
export interface UseMessageHandlingReturn {
  loadMessages: (conversationId: string | null) => Promise<void>;
  handleSubmitCore: (
    currentConversationId: string,
    contentToSendToAI: MessageContent,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  handleImageGenerationCore: (
    currentConversationId: string,
    prompt: string,
  ) => Promise<void>;
  stopStreamingCore: () => void;
  regenerateMessageCore: (messageId: string) => Promise<void>;
}
// --- End interfaces ---

export function useMessageHandling({
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  streamingThrottleRate,
  temperature,
  maxTokens,
  topP,
  topK,
  presencePenalty,
  frequencyPenalty,
  activeSystemPrompt,
  localMessages,
  setLocalMessages,
  // isLoadingMessages, // Removed unused destructuring
  setIsLoadingMessages,
  isStreaming,
  setIsStreaming,
  // error, // Removed unused destructuring
  setError,
  addDbMessage,
  deleteDbMessage,
  getMessagesForConversation,
  getDbMessagesUpTo,
  abortControllerRef,
  selectedConversationId,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  // Instantiate the AI interaction hook
  const { performAiStream, performImageGeneration } = useAiInteraction({
    selectedModel,
    selectedProvider,
    getApiKeyForProvider,
    streamingThrottleRate,
    setLocalMessages,
    setIsAiStreaming: setIsStreaming,
    setError,
    addDbMessage,
    abortControllerRef,
  });

  // --- Message Loading Effect ---
  const loadMessages = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) {
        setLocalMessages([]);
        setError(null);
        return;
      }
      setIsLoadingMessages(true);
      setError(null);
      try {
        const dbMessages = await getMessagesForConversation(conversationId);
        // Convert DbMessage[] to Message[] for UI state
        const uiMessages: Message[] = dbMessages.map((dbMsg) => ({
          id: dbMsg.id,
          conversationId: dbMsg.conversationId,
          role: dbMsg.role,
          content: dbMsg.content, // Already correct type
          createdAt: dbMsg.createdAt,
          vfsContextPaths: dbMsg.vfsContextPaths,
          // Add other fields if they exist in DbMessage and are needed in UI Message
        }));
        setLocalMessages(uiMessages);
      } catch (err) {
        console.error("Failed to load messages:", err);
        const message =
          err instanceof Error ? err.message : "Unknown loading error";
        setError(`Failed to load messages: ${message}`);
        toast.error(`Failed to load messages: ${message}`);
        setLocalMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [
      getMessagesForConversation,
      setLocalMessages,
      setIsLoadingMessages,
      setError,
    ],
  );

  // Load messages when selectedConversationId changes
  useEffect(() => {
    loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);
  // --- End Message Loading Effect ---

  // --- Stop Streaming ---
  const stopStreamingCore = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false); // Ensure streaming state is reset
      // Find potentially incomplete message and mark it as finished/aborted
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );
      toast.info("Processing stopped.");
    }
  }, [abortControllerRef, setIsStreaming, setLocalMessages]);

  // --- Handle Text/Multi-modal Submission ---
  const handleSubmitCore = useCallback(
    async (
      currentConversationId: string,
      contentToSendToAI: MessageContent,
      vfsContextPaths?: string[],
    ) => {
      const userMessageId = nanoid();
      const userMessageTimestamp = new Date();
      const userMessage: Message = {
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: contentToSendToAI,
        createdAt: userMessageTimestamp,
        vfsContextPaths: vfsContextPaths,
      };

      // Add user message locally first
      setLocalMessages((prev) => [...prev, userMessage]);

      // Save user message to DB (async, don't wait)
      addDbMessage({
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: contentToSendToAI,
        createdAt: userMessageTimestamp,
        vfsContextPaths: vfsContextPaths,
      })
        .then(() => {
          modEvents.emit(ModEvent.MESSAGE_SUBMITTED, { message: userMessage });
        })
        .catch((err) => {
          console.error("Failed to save user message:", err);
          setError("Failed to save your message.");
          toast.error("Failed to save your message.");
          setLocalMessages((prev) =>
            prev.filter((msg) => msg.id !== userMessageId),
          );
        });

      // Prepare messages for AI (use local state which includes the new message)
      const messagesForApi = convertDbMessagesToCoreMessages(
        // Filter local messages *before* passing to conversion function
        localMessages
          .filter(
            (m) => !m.error && (m.role === "user" || m.role === "assistant"),
          )
          // Add the latest user message again to ensure it's last
          .concat(userMessage),
      );

      try {
        await performAiStream({
          conversationIdToUse: currentConversationId,
          messagesToSend: messagesForApi,
          currentTemperature: temperature,
          currentMaxTokens: maxTokens,
          currentTopP: topP,
          currentTopK: topK,
          currentPresencePenalty: presencePenalty,
          currentFrequencyPenalty: frequencyPenalty,
          systemPromptToUse: activeSystemPrompt,
        });
      } catch (err) {
        console.error("Error setting up AI stream:", err);
      }
    },
    [
      localMessages, // Depend on localMessages to get history
      performAiStream,
      addDbMessage,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      activeSystemPrompt,
      setError,
      setLocalMessages,
      convertDbMessagesToCoreMessages, // Add dependency
    ],
  );

  // --- Handle Image Generation Submission ---
  const handleImageGenerationCore = useCallback(
    async (currentConversationId: string, prompt: string) => {
      const userMessageId = nanoid();
      const userMessageTimestamp = new Date();
      const userMessageContent = `/imagine ${prompt}`;

      const userMessage: Message = {
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: userMessageContent,
        createdAt: userMessageTimestamp,
      };

      // Add user message locally
      setLocalMessages((prev) => [...prev, userMessage]);

      // Save user message to DB
      addDbMessage({
        id: userMessageId,
        conversationId: currentConversationId,
        role: "user",
        content: userMessageContent,
        createdAt: userMessageTimestamp,
      })
        .then(() => {
          modEvents.emit(ModEvent.MESSAGE_SUBMITTED, { message: userMessage });
        })
        .catch((err) => {
          console.error("Failed to save user image prompt message:", err);
          setError("Failed to save your image prompt.");
          toast.error("Failed to save your image prompt.");
          setLocalMessages((prev) =>
            prev.filter((msg) => msg.id !== userMessageId),
          );
        });

      try {
        await performImageGeneration({
          conversationIdToUse: currentConversationId,
          prompt: prompt,
        });
      } catch (err) {
        console.error("Error setting up image generation:", err);
      }
    },
    [performImageGeneration, addDbMessage, setError, setLocalMessages],
  );

  // --- Regeneration ---
  const regenerateMessageCore = useCallback(
    async (messageId: string) => {
      const messageIndex = localMessages.findIndex((m) => m.id === messageId);
      if (
        messageIndex === -1 ||
        localMessages[messageIndex].role !== "assistant"
      ) {
        toast.error("Cannot regenerate this message.");
        return;
      }

      const conversationId = localMessages[messageIndex].conversationId;
      if (!conversationId) {
        toast.error("Cannot regenerate message: Missing conversation ID.");
        return;
      }

      if (isStreaming) {
        toast.warning("Please wait for the current response to finish.");
        return;
      }

      setError(null);

      // Find the user message preceding the assistant message to regenerate
      let precedingUserMessage: Message | undefined;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (localMessages[i].role === "user") {
          precedingUserMessage = localMessages[i];
          break;
        }
      }

      if (!precedingUserMessage || !precedingUserMessage.id) {
        toast.error("Cannot regenerate: Preceding user message not found.");
        return;
      }

      // Check if the preceding user message was an image generation command
      if (
        typeof precedingUserMessage.content === "string" &&
        precedingUserMessage.content.startsWith("/imagine ")
      ) {
        const imagePrompt = precedingUserMessage.content
          .substring("/imagine ".length)
          .trim();
        if (imagePrompt) {
          // Delete the old assistant message (image result)
          setLocalMessages((prev) =>
            prev.filter((msg) => msg.id !== messageId),
          );
          await deleteDbMessage(messageId);
          // Trigger image generation again
          await handleImageGenerationCore(conversationId, imagePrompt);
        } else {
          toast.error("Cannot regenerate: Invalid image prompt found.");
        }
      } else {
        // Handle text regeneration
        // Get history up to the *user* message before the one being regenerated
        const dbHistory = await getDbMessagesUpTo(
          conversationId,
          precedingUserMessage.id, // Get history *before* the user message
        );

        // Combine history with the user message that triggered the response
        const messagesForApi = convertDbMessagesToCoreMessages([
          ...dbHistory,
          {
            // Add the user message itself
            id: precedingUserMessage.id,
            conversationId: precedingUserMessage.conversationId!,
            role: "user",
            content: precedingUserMessage.content,
            createdAt: precedingUserMessage.createdAt!,
            vfsContextPaths: precedingUserMessage.vfsContextPaths,
          },
        ]);

        // Remove the old assistant message and any subsequent messages locally
        setLocalMessages((prev) => prev.slice(0, messageIndex));

        // Delete the old assistant message from DB (async)
        deleteDbMessage(messageId).catch((err) => {
          console.error("Failed to delete old assistant message:", err);
          // Handle error if needed, maybe restore local message?
        });

        // Perform the stream again
        try {
          await performAiStream({
            conversationIdToUse: conversationId,
            messagesToSend: messagesForApi,
            currentTemperature: temperature,
            currentMaxTokens: maxTokens,
            currentTopP: topP,
            currentTopK: topK,
            currentPresencePenalty: presencePenalty,
            currentFrequencyPenalty: frequencyPenalty,
            systemPromptToUse: activeSystemPrompt,
          });
        } catch (err) {
          console.error("Error during regeneration stream:", err);
        }
      }
    },
    [
      localMessages,
      deleteDbMessage,
      getDbMessagesUpTo,
      performAiStream,
      handleImageGenerationCore, // Add dependency
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      activeSystemPrompt,
      setLocalMessages,
      setError,
      isStreaming, // Add dependency
      convertDbMessagesToCoreMessages, // Add dependency
    ],
  );

  return {
    loadMessages,
    handleSubmitCore,
    handleImageGenerationCore,
    stopStreamingCore,
    regenerateMessageCore,
  };
}
