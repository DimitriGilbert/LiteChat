// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react";
import type {
  Message,
  DbMessage,
  MessageContent, // Import the multi-modal content type
  CoreMessage, // Use the aliased/re-exported CoreMessage
  // Removed unused TextPart, ImagePart imports
} from "@/lib/types";
import { toast } from "sonner";
// Removed unused CoreMessage import from 'ai'
import { modEvents, ModEvent } from "@/mods/events"; // Import mod events and ModEvent constants

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
  getMessagesForConversation: (conversationId: string) => Promise<DbMessage[]>;
}

interface UseMessageHandlingReturn {
  handleSubmitCore: (
    // Removed originalUserPrompt
    currentConversationId: string,
    contentToSendToAI: MessageContent, // Use the multi-modal type
    vfsContextPaths?: string[],
  ) => Promise<void>;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  stopStreamingCore: () => void;
}
// --- End interfaces ---

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
  // setIsAiStreaming, // Not directly used in this hook's logic flow
  localMessages,
  setLocalMessages, // Setter used below
  // isLoadingMessages, // Not directly used
  setIsLoadingMessages, // Setter used below
  // error, // Not directly used
  setError, // Setter used below
  addDbMessage,
  deleteDbMessage,
  getMessagesForConversation,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  // --- Message Loading Effect ---
  useEffect(() => {
    let isMounted = true;
    if (selectedConversationId) {
      setIsLoadingMessages(true);
      setError(null);

      getMessagesForConversation(selectedConversationId)
        .then((messagesFromDb) => {
          if (isMounted) {
            // Map DbMessage to Message, ensuring content structure is preserved
            setLocalMessages(
              messagesFromDb.map((dbMsg) => ({
                ...dbMsg,
                // Ensure content is correctly typed
                content: dbMsg.content, // Should already be MessageContent type
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
            const message =
              err instanceof Error ? err.message : "Unknown error";
            setError(`Error loading chat: ${message}`);
            toast.error(`Error loading chat: ${message}`);
            setLocalMessages([]);
            setIsLoadingMessages(false);
          }
        });
    } else {
      // Clear state when no conversation is selected
      setLocalMessages([]);
      setIsLoadingMessages(false);
      setError(null);
    }
    return () => {
      isMounted = false;
    };
  }, [
    selectedConversationId,
    getMessagesForConversation,
    setLocalMessages,
    setIsLoadingMessages,
    setError,
  ]);
  // --- End Message Loading Effect ---

  // --- Stop Streaming ---
  const stopStreamingCore = useCallback(() => {
    stopStreamingCallback();
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              // If content was string, update it. If array, keep array but stop streaming.
              content:
                typeof msg.content === "string"
                  ? msg.streamedContent || msg.content || "Stopped by user"
                  : msg.content,
              streamedContent: undefined, // Clear streamed content buffer
            }
          : msg,
      ),
    );
    // TODO: Phase 5 - Emit 'response:stopped' event if needed
  }, [stopStreamingCallback, setLocalMessages]);

  // --- Handle Submission ---
  const handleSubmitCore = useCallback(
    async (
      // Removed originalUserPrompt
      currentConversationId: string,
      contentToSendToAI: MessageContent, // Use the multi-modal type (string or array)
      vfsContextPaths?: string[],
    ) => {
      if (!currentConversationId) {
        setError("Error: Could not determine active conversation.");
        toast.error("Cannot submit message: No active conversation selected.");
        return;
      }

      setError(null);

      // --- Construct messagesForAi adhering to CoreMessage structure ---
      const messagesForAi: CoreMessage[] = [];

      // 1. Add previous messages from local state
      localMessages
        .filter(
          (m) => !m.error && (m.role === "user" || m.role === "assistant"),
        )
        .forEach((m) => {
          // Directly use the content from localMessages, as it should match MessageContent type
          // The role also comes directly from the local message
          messagesForAi.push({
            role: m.role,
            content: m.content, // Pass the string or array directly
          } as CoreMessage); // Cast might still be needed due to TS complexity
        });

      // 2. Add the new user message
      //    The 'contentToSendToAI' parameter *must* be the correct structure (string or array)
      //    as prepared by the calling service (e.g., ChatSubmissionService).
      messagesForAi.push({
        role: "user",
        content: contentToSendToAI, // Pass the received structure directly
      });
      // --- End constructing messagesForAi ---

      // Basic check if there's anything to send (at least the new user message)
      if (messagesForAi.length === 0) {
        console.error(
          "useMessageHandling: Attempting to send empty message list.",
        );
        setError("Internal Error: Cannot send empty message list.");
        toast.error("Cannot send message: Chat history is effectively empty.");
        return;
      }

      // Log the structure being sent for debugging (optional)
      // console.log("Messages being sent to performAiStream:", JSON.stringify(messagesForAi, null, 2));

      let userMessageId: string;
      let userMessageForState: Message;
      const userMessageTimestamp = new Date();
      try {
        // Save the message to DB. Use the original contentToSendToAI structure.
        const dbContent = contentToSendToAI;

        const userMessageData = {
          role: "user" as const,
          content: dbContent, // Save the potentially multi-modal content
          conversationId: currentConversationId,
          createdAt: userMessageTimestamp,
          vfsContextPaths: vfsContextPaths,
        };
        userMessageId = await addDbMessage(userMessageData);
        userMessageForState = {
          ...userMessageData,
          id: userMessageId,
          isStreaming: false,
          streamedContent: undefined,
          error: null,
          vfsContextPaths: vfsContextPaths ?? undefined,
        };
      } catch (dbError: unknown) {
        console.error(
          "useMessageHandling: Error adding user message:",
          dbError,
        );
        const message =
          dbError instanceof Error ? dbError.message : "Unknown DB error";
        setError(`Error: Could not save your message - ${message}`);
        toast.error(`Error saving message: ${message}`);
        return;
      }

      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);

      // Phase 5: Emit 'message:submitted' event AFTER adding to local state
      modEvents.emit(ModEvent.MESSAGE_SUBMITTED, {
        // Use ModEvent constant
        message: userMessageForState,
      });

      try {
        await performAiStream({
          conversationIdToUse: currentConversationId,
          messagesToSend: messagesForAi, // Pass the correctly structured CoreMessage array
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
        // Error handling/setting state is done within performAiStream
      }
    },
    [
      localMessages,
      addDbMessage,
      performAiStream,
      setError,
      setLocalMessages,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
    ],
  );

  // --- Regeneration ---
  const regenerateMessageCore = useCallback(
    async (messageId: string) => {
      const conversationIdToUse = selectedConversationId;
      if (!conversationIdToUse) {
        toast.error("Please select the conversation first.");
        return;
      }
      if (isAiStreaming) {
        toast.warning("Please wait for the current response to finish.");
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

      // Prepare history up to the message *before* the one being regenerated
      const historyForRegen: CoreMessage[] = [];
      localMessages
        .slice(0, messageIndex)
        .filter(
          (m) => !m.error && (m.role === "user" || m.role === "assistant"),
        )
        .forEach((m) => {
          // Directly use the content from localMessages
          historyForRegen.push({
            role: m.role,
            content: m.content, // Pass the string or array directly
          } as CoreMessage);
        });

      // Ensure there's something to send (at least one user/assistant message)
      if (historyForRegen.length === 0) {
        console.error(
          "useMessageHandling: Cannot regenerate with empty history.",
        );
        setError("Internal Error: Cannot regenerate with empty history.");
        toast.error("Cannot regenerate the first message in a chat.");
        return;
      }

      // Delete the message being regenerated and any subsequent messages
      const messagesToDelete = localMessages.slice(messageIndex);
      try {
        const idsToDelete = messagesToDelete
          .map((m) => m.id)
          .filter((id): id is string => !!id);
        if (idsToDelete.length > 0) {
          await Promise.all(idsToDelete.map((id) => deleteDbMessage(id)));
        } else {
          console.warn("Regeneration: No message IDs found to delete from DB.");
        }
      } catch (dbErr: unknown) {
        console.error("useMessageHandling: Error deleting for regen:", dbErr);
        const message =
          dbErr instanceof Error ? dbErr.message : "Unknown DB error";
        setError(`Error preparing regeneration: ${message}`);
        toast.error(`Failed to prepare for regeneration: ${message}`);
        return;
      }

      // Update local state to remove the messages
      setLocalMessages((prev) => prev.slice(0, messageIndex));
      // TODO: Phase 5 - Emit 'message:regenerating' event if needed

      try {
        // Perform the AI stream with the history up to the point of regeneration
        await performAiStream({
          conversationIdToUse: conversationIdToUse,
          messagesToSend: historyForRegen, // Pass the correctly structured history
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
        // Error handling/setting state is done within performAiStream
      }
    },
    [
      selectedConversationId,
      isAiStreaming,
      localMessages,
      deleteDbMessage,
      performAiStream,
      setError,
      setLocalMessages,
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
    ],
  );

  return {
    handleSubmitCore,
    regenerateMessageCore,
    stopStreamingCore,
  };
}
