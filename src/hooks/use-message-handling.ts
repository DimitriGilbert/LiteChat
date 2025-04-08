// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react";
import type { Message, DbMessage } from "@/lib/types";
import { db } from "@/lib/db";
import { toast } from "sonner";
import type { CoreMessage } from "ai";

// Interface for AI stream parameters
export interface PerformAiStreamParams {
  conversationIdToUse: string;
  messagesToSend: CoreMessage[];
  currentTemperature: number;
  currentMaxTokens: number | null;
  currentTopP: number | null;
  currentTopK: number | null;
  currentPresencePenalty: number | null;
  currentFrequencyPenalty: number | null;
  systemPromptToUse: string | null;
}

// Props received by the hook
interface UseMessageHandlingProps {
  selectedConversationId: string | null;
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
  stopStreamingCallback: () => void;
  activeSystemPrompt: string | null;
  temperature: number;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  isAiStreaming: boolean;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  localMessages: Message[];
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: (error: string | null) => void;
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  deleteDbMessage: (messageId: string) => Promise<void>;
}

// Return type of the hook
interface UseMessageHandlingReturn {
  handleSubmit: (
    originalUserPrompt: string,
    currentConversationId: string,
    promptToSendToAI: string,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  stopStreaming: () => void;
}

// Hook implementation
export function useMessageHandling({
  selectedConversationId,
  performAiStream,
  stopStreamingCallback,
  activeSystemPrompt,
  temperature,
  maxTokens,
  topP,
  topK,
  presencePenalty,
  frequencyPenalty,
  isAiStreaming,
  localMessages,
  setLocalMessages,
  setIsLoadingMessages,
  setError,
  addDbMessage,
  deleteDbMessage,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  // --- Message Loading Effect ---
  useEffect(() => {
    let isMounted = true;
    if (selectedConversationId) {
      setIsLoadingMessages(true);
      setError(null);

      db.messages
        .where("conversationId")
        .equals(selectedConversationId)
        .sortBy("createdAt")
        .then((messagesFromDb) => {
          if (isMounted) {
            setLocalMessages(
              messagesFromDb.map((dbMsg) => ({
                ...dbMsg,
                isStreaming: false,
                streamedContent: undefined,
                error: null,
                vfsContextPaths: dbMsg.vfsContextPaths ?? undefined,
              })),
            );
            setIsLoadingMessages(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("useMessageHandling: Failed to load messages:", err);
            setError(`Error loading chat: ${err.message}`);
            toast.error(`Error loading chat: ${err.message}`);
            setLocalMessages([]);
            setIsLoadingMessages(false);
          }
        });
    } else {
      setLocalMessages([]);
      setIsLoadingMessages(false);
      setError(null);
    }
    return () => {
      isMounted = false;
    };
  }, [
    selectedConversationId,
    setIsLoadingMessages,
    setLocalMessages,
    setError,
  ]);

  // --- Stop Streaming ---
  const stopStreaming = useCallback(() => {
    stopStreamingCallback();
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              content: msg.streamedContent || msg.content || "Stopped",
              streamedContent: undefined,
            }
          : msg,
      ),
    );
  }, [stopStreamingCallback, setLocalMessages]);

  // --- Handle Submission ---
  const handleSubmit = useCallback(
    async (
      originalUserPrompt: string,
      currentConversationId: string,
      promptToSendToAI: string,
      vfsContextPaths?: string[],
    ) => {
      if (!currentConversationId) {
        setError("Error: Could not determine active conversation.");
        return;
      }

      setError(null);

      let userMessageId: string;
      let userMessageForState: Message;
      const userMessageTimestamp = new Date();

      // Prepare message history for AI *before* saving the new user message
      const messagesForAi = await new Promise<CoreMessage[]>((resolve) => {
        setLocalMessages((currentMessages) => {
          const history = currentMessages
            .filter((m) => !m.error)
            .map((m): CoreMessage => ({ role: m.role, content: m.content }));
          history.push({ role: "user", content: promptToSendToAI });
          resolve(history);
          return currentMessages;
        });
      });

      const hasUserOrAssistantMessage = messagesForAi.some(
        (m) => m.role === "user" || m.role === "assistant",
      );
      if (!hasUserOrAssistantMessage) {
        console.error("useMessageHandling: Attempting to send empty history.");
        setError("Internal Error: Cannot send empty message list.");
        return;
      }

      // Save user message to DB (using original prompt)
      try {
        const userMessageData = {
          role: "user" as const,
          content: originalUserPrompt,
          conversationId: currentConversationId,
          createdAt: userMessageTimestamp,
          vfsContextPaths: vfsContextPaths,
        };
        userMessageId = await addDbMessage(userMessageData);
        userMessageForState = {
          ...userMessageData,
          id: userMessageId,
          vfsContextPaths: vfsContextPaths ?? undefined,
        };
      } catch (dbError: unknown) {
        console.error(
          "useMessageHandling: Error adding user message:",
          dbError,
        );
        if (dbError instanceof Error) {
          setError(`Error: Could not save your message - ${dbError.message}`);
          toast.error(`Error saving message: ${dbError.message}`);
        } else {
          setError("Error: Could not save your message");
          toast.error("Error saving message");
        }
        return;
      }

      // Update local state with user message (using original prompt)
      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);

      // Call AI stream function
      try {
        await performAiStream({
          conversationIdToUse: currentConversationId,
          messagesToSend: messagesForAi,
          currentTemperature: temperature,
          currentMaxTokens: maxTokens,
          currentTopP: topP,
          currentTopK: topK,
          currentPresencePenalty: presencePenalty,
          currentFrequencyPenalty: frequencyPenalty,
          systemPromptToUse: activeSystemPrompt,
        });
      } catch (err: unknown) {
        console.error(
          "useMessageHandling: Error during performAiStream call:",
          err,
        );
      }
    },
    [
      addDbMessage,
      performAiStream,
      setError,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      setLocalMessages,
    ],
  );

  // --- Regeneration ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      const conversationIdToUse = selectedConversationId;
      if (!conversationIdToUse || isAiStreaming) {
        if (isAiStreaming)
          toast.warning("Please wait for the current response.");
        return;
      }

      setError(null);

      const messageIndex = localMessages.findIndex((m) => m.id === messageId);
      if (messageIndex < 0) {
        setError("Cannot regenerate non-existent message.");
        toast.error("Cannot find the message to regenerate.");
        return;
      }

      const messageToRegenerate = localMessages[messageIndex];
      if (messageToRegenerate.role !== "assistant") {
        setError("Can only regenerate assistant messages.");
        toast.error("Only AI responses can be regenerated.");
        return;
      }

      // Get history
      const historyForRegen = localMessages
        .slice(0, messageIndex)
        .filter((m) => !m.error)
        .map((m): CoreMessage => ({ role: m.role, content: m.content }));

      const hasUserOrAssistantMessage = historyForRegen.some(
        (m) => m.role === "user" || m.role === "assistant",
      );
      if (!hasUserOrAssistantMessage) {
        console.error(
          "useMessageHandling: Cannot regenerate with empty history.",
        );
        setError("Internal Error: Cannot regenerate with empty history.");
        toast.error("Cannot regenerate the first message in a chat.");
        return;
      }

      // Delete messages from DB
      const messagesToDelete = localMessages.slice(messageIndex);
      try {
        await Promise.all(messagesToDelete.map((m) => deleteDbMessage(m.id)));
      } catch (dbErr: unknown) {
        console.error("useMessageHandling: Error deleting for regen:", dbErr);
        if (dbErr instanceof Error) {
          setError(`Error preparing regeneration: ${dbErr.message}`);
          toast.error("Failed to prepare for regeneration : " + dbErr.message);
        } else {
          setError("Unknown error preparing regeneration");
          toast.error("Failed to prepare for regeneration.");
        }
        return;
      }

      // Update local state
      setLocalMessages((prev) => prev.slice(0, messageIndex));

      // Call AI stream function
      try {
        await performAiStream({
          conversationIdToUse: conversationIdToUse,
          messagesToSend: historyForRegen,
          currentTemperature: temperature,
          currentMaxTokens: maxTokens,
          currentTopP: topP,
          currentTopK: topK,
          currentPresencePenalty: presencePenalty,
          currentFrequencyPenalty: frequencyPenalty,
          systemPromptToUse: activeSystemPrompt,
        });
      } catch (err: unknown) {
        console.error("useMessageHandling: Error during regen stream:", err);
      }
    },
    [
      selectedConversationId,
      isAiStreaming,
      localMessages,
      deleteDbMessage,
      performAiStream,
      setError,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      setLocalMessages,
    ],
  );

  return {
    handleSubmit,
    regenerateMessage,
    stopStreaming,
  };
}
