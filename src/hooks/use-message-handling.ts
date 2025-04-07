// src/hooks/use-message-handling.ts
import React, { useCallback, useEffect } from "react"; // Removed useState
import type { Message, CoreMessage, DbMessage } from "@/lib/types";
// Removed useChatStorage import here, DB functions are passed as props
import { db } from "@/lib/db";
import { toast } from "sonner";

// Interface for AI stream parameters (ensure consistency)
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
  // State and setters passed down from ChatProvider
  localMessages: Message[];
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoadingMessages: boolean; // Receive loading state
  setIsLoadingMessages: React.Dispatch<React.SetStateAction<boolean>>; // Receive loading setter
  error: string | null; // Receive error state
  setError: (error: string | null) => void; // Receive error setter
  // DB functions passed down
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  deleteDbMessage: (messageId: string) => Promise<void>;
}

// Return type of the hook
interface UseMessageHandlingReturn {
  // No need to return state/setters managed by the provider
  handleSubmit: (
    userPromptContent: string,
    currentConversationId: string,
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
  // No need for setIsAiStreaming here if only used in stopStreaming via callback
  // State and setters received as props:
  localMessages,
  setLocalMessages,
  // isLoadingMessages, // Not directly used inside, only setIsLoadingMessages
  setIsLoadingMessages,
  // error, // Not directly used inside, only setError
  setError,
  // DB functions received as props:
  addDbMessage,
  deleteDbMessage,
}: UseMessageHandlingProps): UseMessageHandlingReturn {
  // --- Remove internal state declarations ---
  // const [localMessages, setLocalMessages] = useState<Message[]>([]); // REMOVED
  // const [isLoadingMessages, setIsLoadingMessages] = useState(true); // REMOVED
  // const [error, setErrorState] = useState<string | null>(null); // REMOVED
  // const setError = useCallback(...) // REMOVED (using prop directly)

  // --- Message Loading Effect ---
  useEffect(() => {
    let isMounted = true;
    if (selectedConversationId) {
      console.log(
        `useMessageHandling: Loading messages for ${selectedConversationId}`,
      );
      // Use the setter passed via props
      setIsLoadingMessages(true);
      setError(null); // Clear previous errors on load

      db.messages
        .where("conversationId")
        .equals(selectedConversationId)
        .sortBy("createdAt")
        .then((messagesFromDb) => {
          if (isMounted) {
            console.log(
              `useMessageHandling: Loaded ${messagesFromDb.length} messages from DB`,
            );
            // Use the setter passed via props
            setLocalMessages(
              messagesFromDb.map((dbMsg) => ({
                ...dbMsg,
                isStreaming: false,
                streamedContent: undefined,
                error: null,
              })),
            );
            // Use the setter passed via props
            setIsLoadingMessages(false);
            console.log("useMessageHandling: Set loading false");
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error("useMessageHandling: Failed to load messages:", err);
            // Use the setter passed via props
            setError(`Error loading chat: ${err.message}`);
            toast.error(`Error loading chat: ${err.message}`);
            setLocalMessages([]); // Clear messages on error
            setIsLoadingMessages(false); // Still set loading false on error
          }
        });
    } else {
      // No conversation selected, clear messages and set loading false
      console.log(
        "useMessageHandling: No conversation selected, clearing state.",
      );
      setLocalMessages([]);
      setIsLoadingMessages(false);
      setError(null);
    }
    return () => {
      console.log("useMessageHandling: Unmounting effect");
      isMounted = false;
    };
  }, [
    selectedConversationId,
    setIsLoadingMessages,
    setLocalMessages,
    setError,
  ]); // Dependencies are the setters and the ID

  // --- Stop Streaming ---
  const stopStreaming = useCallback(() => {
    console.log("useMessageHandling: stopStreaming called");
    stopStreamingCallback(); // Call the function passed from context/parent
    // Update the local message state immediately to reflect stoppage
    // Use the setter passed via props
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
    async (userPromptContent: string, currentConversationId: string) => {
      console.log("useMessageHandling: handleSubmit called");
      if (!currentConversationId) {
        setError("Error: Could not determine active conversation.");
        return;
      }

      setError(null); // Clear previous errors

      let userMessageId: string;
      let userMessageForState: Message;
      const userMessageTimestamp = new Date();

      // 1. Save user message to DB (using function prop)
      try {
        const userMessageData = {
          role: "user" as const,
          content: userPromptContent,
          conversationId: currentConversationId,
          createdAt: userMessageTimestamp,
        };
        userMessageId = await addDbMessage(userMessageData);
        userMessageForState = { ...userMessageData, id: userMessageId };
        console.log(
          "useMessageHandling: User message saved to DB",
          userMessageId,
        );
      } catch (dbError: any) {
        console.error(
          "useMessageHandling: Error adding user message:",
          dbError,
        );
        setError(`Error: Could not save your message - ${dbError.message}`);
        toast.error(`Error saving message: ${dbError.message}`);
        return;
      }

      // 2. Update local state with user message (using setter prop)
      setLocalMessages((prevMessages) => [
        ...prevMessages,
        userMessageForState,
      ]);
      console.log("useMessageHandling: User message added to local state");

      // 3. Prepare message history for AI (using the state *after* adding the user message)
      // Read state functionally to ensure it's the latest after the update above
      const messagesForAi = await new Promise<CoreMessage[]>((resolve) => {
        setLocalMessages((currentMessages) => {
          const history = currentMessages
            .filter((m) => !m.error)
            .map((m): CoreMessage => ({ role: m.role, content: m.content }));
          resolve(history);
          return currentMessages; // No change here, just reading
        });
      });

      console.log(
        `useMessageHandling: Prepared ${messagesForAi.length} messages for AI`,
      );

      const hasUserOrAssistantMessage = messagesForAi.some(
        (m) => m.role === "user" || m.role === "assistant",
      );
      if (!hasUserOrAssistantMessage) {
        console.error("useMessageHandling: Attempting to send empty history.");
        setError("Internal Error: Cannot send empty message list.");
        setLocalMessages((prev) => prev.filter((m) => m.id !== userMessageId)); // Rollback
        return;
      }

      // 4. Call AI stream function (passed as prop)
      try {
        console.log("useMessageHandling: Calling performAiStream");
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
        console.log("useMessageHandling: performAiStream finished");
      } catch (err: any) {
        // Errors during the stream are handled within performAiStream
        console.error(
          "useMessageHandling: Error during performAiStream call:",
          err,
        );
        // setError might be set within performAiStream already
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
      setLocalMessages, // Need setter prop as dependency
    ],
  );

  // --- Regeneration ---
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      console.log(
        "useMessageHandling: regenerateMessage called for",
        messageId,
      );
      const conversationIdToUse = selectedConversationId;
      if (!conversationIdToUse || isAiStreaming) {
        console.warn("Regeneration prevented: No convo or already streaming.");
        if (isAiStreaming)
          toast.warning("Please wait for the current response.");
        return;
      }

      setError(null);

      // Use localMessages prop directly
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

      // 1. Get history (using localMessages prop)
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

      // 2. Delete messages from DB (using function prop)
      const messagesToDelete = localMessages.slice(messageIndex);
      try {
        await Promise.all(messagesToDelete.map((m) => deleteDbMessage(m.id)));
        console.log(
          `useMessageHandling: Deleted ${messagesToDelete.length} messages for regen`,
        );
      } catch (dbErr: any) {
        console.error("useMessageHandling: Error deleting for regen:", dbErr);
        setError(`Error preparing regeneration: ${dbErr.message}`);
        toast.error("Failed to prepare for regeneration.");
        return;
      }

      // 3. Update local state (using setter prop)
      setLocalMessages((prev) => prev.slice(0, messageIndex));
      console.log("useMessageHandling: Sliced local messages for regen");

      // 4. Call AI stream function (passed as prop)
      try {
        console.log("useMessageHandling: Calling performAiStream for regen");
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
        console.log("useMessageHandling: performAiStream finished for regen");
      } catch (err: any) {
        console.error("useMessageHandling: Error during regen stream:", err);
      }
    },
    [
      selectedConversationId,
      isAiStreaming,
      localMessages, // Need localMessages prop
      deleteDbMessage, // Need function prop
      performAiStream, // Need function prop
      setError, // Need setter prop
      activeSystemPrompt,
      temperature,
      maxTokens,
      topP,
      topK,
      presencePenalty,
      frequencyPenalty,
      setLocalMessages, // Need setter prop
    ],
  );

  // Return only the functions, as state is managed by the provider
  return {
    handleSubmit,
    regenerateMessage,
    stopStreaming,
  };
}
