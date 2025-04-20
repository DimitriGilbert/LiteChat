// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react";
import type {
  Message,
  DbMessage,
  MessageContent,
  // Removed unused CoreMessage import
  AiModelConfig,
  AiProviderConfig,
} from "@/lib/types";
import { toast } from "sonner";
import { useAiInteraction } from "./ai-interaction";
import { modEvents, ModEvent } from "@/mods/events";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import { nanoid } from "nanoid";
import { ReadonlyChatContextSnapshot } from "@/mods/api";

// --- Interface Definitions ---
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
  localMessages: Message[];
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  isStreaming: boolean;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: (error: string | null) => void;
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  deleteDbMessage: (messageId: string) => Promise<void>;
  getMessagesForConversation: (conversationId: string) => Promise<DbMessage[]>;
  // Removed unused getDbMessagesUpTo prop type
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  selectedConversationId: string | null;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  bulkAddMessages: (messages: DbMessage[]) => Promise<unknown>;
}

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
  setIsLoadingMessages,
  isStreaming,
  setIsStreaming,
  setError,
  addDbMessage,
  deleteDbMessage,
  getMessagesForConversation,
  // Removed unused getDbMessagesUpTo destructuring
  abortControllerRef,
  selectedConversationId,
  getContextSnapshotForMod,
  bulkAddMessages,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
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
    getContextSnapshotForMod,
    bulkAddMessages,
  });

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
        const uiMessages: Message[] = dbMessages.map((dbMsg) => ({
          id: dbMsg.id,
          conversationId: dbMsg.conversationId,
          role: dbMsg.role,
          content: dbMsg.content,
          createdAt: dbMsg.createdAt,
          vfsContextPaths: dbMsg.vfsContextPaths,
          tool_calls: dbMsg.tool_calls,
          tool_call_id: dbMsg.tool_call_id,
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

  useEffect(() => {
    loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);

  const stopStreamingCore = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.isStreaming ? { ...msg, isStreaming: false } : msg,
        ),
      );
      toast.info("Processing stopped.");
    }
  }, [abortControllerRef, setIsStreaming, setLocalMessages]);

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

      setLocalMessages((prev) => [...prev, userMessage]);

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

      const currentMessagesForApi = convertDbMessagesToCoreMessages([
        ...localMessages,
        userMessage,
      ]);

      try {
        await performAiStream({
          conversationIdToUse: currentConversationId,
          messagesToSend: currentMessagesForApi,
          currentTemperature: temperature,
          currentMaxTokens: maxTokens,
          currentTopP: topP,
          currentTopK: topK,
          currentPresencePenalty: presencePenalty,
          currentFrequencyPenalty: frequencyPenalty,
          systemPromptToUse: activeSystemPrompt,
        });
      } catch (err) {
        // Error handled within performAiStream
      }
    },
    [
      localMessages,
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
    ],
  );

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

      setLocalMessages((prev) => [...prev, userMessage]);

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
        // Error handled within performImageGeneration
      }
    },
    [performImageGeneration, addDbMessage, setError, setLocalMessages],
  );

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

      let precedingUserMessageIndex = -1;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (localMessages[i].role === "user") {
          precedingUserMessageIndex = i;
          break;
        }
      }

      if (precedingUserMessageIndex === -1) {
        toast.error("Cannot regenerate: Preceding user message not found.");
        return;
      }
      const precedingUserMessage = localMessages[precedingUserMessageIndex];

      if (
        typeof precedingUserMessage.content === "string" &&
        precedingUserMessage.content.startsWith("/imagine ")
      ) {
        const imagePrompt = precedingUserMessage.content
          .substring("/imagine ".length)
          .trim();
        if (imagePrompt) {
          setLocalMessages((prev) =>
            prev.filter((msg) => msg.id !== messageId),
          );
          await deleteDbMessage(messageId);
          await handleImageGenerationCore(conversationId, imagePrompt);
        } else {
          toast.error("Cannot regenerate: Invalid image prompt found.");
        }
      } else {
        const historyForApi = convertDbMessagesToCoreMessages(
          localMessages.slice(0, precedingUserMessageIndex + 1),
        );

        setLocalMessages((prev) => prev.slice(0, messageIndex));

        deleteDbMessage(messageId).catch((err) => {
          console.error("Failed to delete old assistant message:", err);
        });

        try {
          await performAiStream({
            conversationIdToUse: conversationId,
            messagesToSend: historyForApi,
            currentTemperature: temperature,
            currentMaxTokens: maxTokens,
            currentTopP: topP,
            currentTopK: topK,
            currentPresencePenalty: presencePenalty,
            currentFrequencyPenalty: frequencyPenalty,
            systemPromptToUse: activeSystemPrompt,
          });
        } catch (err) {
          // Error handled within performAiStream
        }
      }
    },
    [
      localMessages,
      deleteDbMessage,
      performAiStream,
      handleImageGenerationCore,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      activeSystemPrompt,
      setLocalMessages,
      setError,
      isStreaming,
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
