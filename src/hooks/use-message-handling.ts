// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react";
import type { Message, DbMessage } from "@/lib/types";
import { db } from "@/lib/db"; // Keep direct import for loading effect for now
import { toast } from "sonner";
import type { CoreMessage } from "ai";

// Interface for AI stream parameters (remains the same)
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

// --- Updated Props Interface ---
interface UseMessageHandlingProps {
  selectedConversationId: string | null;
  // AI interaction function passed directly
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
  // Stop callback passed directly
  stopStreamingCallback: () => void;
  // Settings passed directly
  activeSystemPrompt: string | null;
  temperature: number;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  // Core state/setters passed directly
  isAiStreaming: boolean;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>; // Needed for checks
  localMessages: Message[];
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean;
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null; // Needed for checks/display
  setError: (error: string | null) => void;
  // DB functions passed directly
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  deleteDbMessage: (messageId: string) => Promise<void>;
}

// Return type of the hook (renamed functions for clarity)
interface UseMessageHandlingReturn {
  handleSubmitCore: (
    originalUserPrompt: string,
    currentConversationId: string,
    promptToSendToAI: string,
    vfsContextPaths?: string[],
  ) => Promise<void>;
  regenerateMessageCore: (messageId: string) => Promise<void>;
  stopStreamingCore: () => void;
}

// Hook implementation
export function useMessageHandling({
  selectedConversationId,
  performAiStream, // from props
  stopStreamingCallback, // from props
  activeSystemPrompt, // from props
  temperature, // from props
  maxTokens, // from props
  topP, // from props
  topK, // from props
  presencePenalty, // from props
  frequencyPenalty, // from props
  isAiStreaming, // from props
  // setIsAiStreaming, // Not directly used here, but passed for dependency array clarity
  localMessages, // from props
  setLocalMessages, // from props
  // isLoadingMessages, // Not directly used here
  setIsLoadingMessages, // from props
  // error, // Not directly used here
  setError, // from props
  addDbMessage, // from props
  deleteDbMessage, // from props
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  // --- Message Loading Effect ---
  useEffect(() => {
    let isMounted = true;
    if (selectedConversationId) {
      setIsLoadingMessages(true);
      setError(null);

      // TODO: Refactor this direct DB access in Task 1.2
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
            const message =
              err instanceof Error ? err.message : "Unknown error";
            setError(`Error loading chat: ${message}`);
            toast.error(`Error loading chat: ${message}`);
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
  // Renamed to stopStreamingCore
  const stopStreamingCore = useCallback(() => {
    stopStreamingCallback(); // Call the passed callback (which handles abortController)
    // Update local state to reflect stopped streaming
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming
          ? {
              ...msg,
              isStreaming: false,
              // Use streamed content if available, otherwise mark as stopped
              content: msg.streamedContent || msg.content || "Stopped by user",
              streamedContent: undefined,
            }
          : msg,
      ),
    );
  }, [stopStreamingCallback, setLocalMessages]);

  // --- Handle Submission ---
  // Renamed to handleSubmitCore
  const handleSubmitCore = useCallback(
    async (
      originalUserPrompt: string,
      currentConversationId: string,
      promptToSendToAI: string,
      vfsContextPaths?: string[],
    ) => {
      if (!currentConversationId) {
        setError("Error: Could not determine active conversation.");
        toast.error("Cannot submit message: No active conversation selected.");
        return;
      }

      setError(null); // Clear previous errors on new submission

      // --- Prepare message history for AI ---
      // Create history *before* adding the new user message to local state
      // This ensures the AI gets the state *before* the user message was sent
      const messagesForAi: CoreMessage[] = [
        ...localMessages
          .filter(
            (m) => !m.error && (m.role === "user" || m.role === "assistant"),
          ) // Filter out errors and system messages
          .map((m): CoreMessage => ({ role: m.role, content: m.content })),
        { role: "user", content: promptToSendToAI }, // Add the new user prompt (potentially with VFS context)
      ];

      // Basic check to prevent sending only system prompts or empty history
      const hasUserOrAssistantMessage = messagesForAi.some(
        (m) => m.role === "user" || m.role === "assistant",
      );
      if (!hasUserOrAssistantMessage) {
        console.error("useMessageHandling: Attempting to send empty history.");
        setError("Internal Error: Cannot send empty message list.");
        toast.error("Cannot send message: Chat history is effectively empty.");
        return;
      }

      // --- Save user message to DB (using original prompt) ---
      let userMessageId: string;
      let userMessageForState: Message;
      const userMessageTimestamp = new Date();
      try {
        const userMessageData = {
          role: "user" as const,
          content: originalUserPrompt, // Save the original prompt without VFS context
          conversationId: currentConversationId,
          createdAt: userMessageTimestamp,
          vfsContextPaths: vfsContextPaths, // Store VFS paths used
        };
        userMessageId = await addDbMessage(userMessageData);
        userMessageForState = {
          ...userMessageData,
          id: userMessageId,
          isStreaming: false, // User messages don't stream
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
        return; // Stop if user message can't be saved
      }

      // --- Update local state with user message (using original prompt) ---
      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);

      // --- Call AI stream function ---
      try {
        await performAiStream({
          conversationIdToUse: currentConversationId,
          messagesToSend: messagesForAi, // Send the prepared history
          currentTemperature: temperature,
          currentMaxTokens: maxTokens,
          currentTopP: topP,
          currentTopK: topK,
          currentPresencePenalty: presencePenalty,
          currentFrequencyPenalty: frequencyPenalty,
          systemPromptToUse: activeSystemPrompt,
        });
      } catch (err: unknown) {
        // Errors during streaming are handled within performAiStream (setting error state, toasting)
        // Log here for debugging if needed, but avoid redundant error setting/toasting
        console.error(
          "useMessageHandling: Error during performAiStream call:",
          err,
        );
      }
    },
    [
      localMessages, // Need current messages to build history
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
  // Renamed to regenerateMessageCore
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

      setError(null); // Clear previous errors

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

      // --- Get history up to the message *before* the one being regenerated ---
      const historyForRegen = localMessages
        .slice(0, messageIndex) // Exclude the message being regenerated and subsequent ones
        .filter(
          (m) => !m.error && (m.role === "user" || m.role === "assistant"),
        )
        .map((m): CoreMessage => ({ role: m.role, content: m.content }));

      // Check if history is valid
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

      // --- Delete messages from DB (the one being regenerated + subsequent ones) ---
      const messagesToDelete = localMessages.slice(messageIndex);
      try {
        // Ensure IDs exist before attempting deletion
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
        return; // Stop if DB cleanup fails
      }

      // --- Update local state (remove regenerated and subsequent messages) ---
      setLocalMessages((prev) => prev.slice(0, messageIndex));

      // --- Call AI stream function with the truncated history ---
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
        // Errors handled within performAiStream
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
