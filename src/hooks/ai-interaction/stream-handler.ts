// src/hooks/ai-interaction/stream-handler.ts
import { nanoid } from "nanoid";
import { Message } from "@/lib/types"; // Ensure Message type is imported
import { throttle } from "@/lib/throttle";
import { modEvents, ModEvent } from "@/mods/events";

/**
 * Creates an assistant message placeholder for streaming
 */
export function createAssistantPlaceholder(
  conversationId: string,
  providerId: string,
  modelId: string,
): { id: string; message: Message; timestamp: Date } {
  const assistantMessageId = nanoid();
  const assistantPlaceholderTimestamp = new Date();
  const assistantPlaceholder: Message = {
    id: assistantMessageId,
    conversationId: conversationId,
    role: "assistant",
    content: "", // Keep final content empty initially
    createdAt: assistantPlaceholderTimestamp,
    isStreaming: true,
    streamedContent: "", // Initialize streamed content
    error: null,
    providerId: providerId,
    modelId: modelId,
  };

  return {
    id: assistantMessageId,
    message: assistantPlaceholder,
    timestamp: assistantPlaceholderTimestamp,
  };
}

/**
 * Creates a throttled function to update the streamed content in the UI
 */
export function createStreamUpdater(
  assistantMessageId: string,
  contentRef: { current: string },
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  refreshRateMs: number, // Renamed parameter
) {
  return throttle(() => {
    const currentAccumulatedContent = contentRef.current;
    // Use functional update for setLocalMessages
    setLocalMessages((prevMessages) => {
      const targetMessageIndex = prevMessages.findIndex(
        (msg) => msg.id === assistantMessageId,
      );
      // If message not found or not streaming anymore, return previous state
      if (
        targetMessageIndex === -1 ||
        !prevMessages[targetMessageIndex].isStreaming
      ) {
        return prevMessages;
      }
      // Create a new array with the updated message
      const updatedMessages = [...prevMessages];
      // Update ONLY streamedContent
      updatedMessages[targetMessageIndex] = {
        ...prevMessages[targetMessageIndex],
        streamedContent: currentAccumulatedContent,
      };
      return updatedMessages;
    });
  }, refreshRateMs); // Use the new parameter name
}

/**
 * Handles getting API headers for different providers
 */
export function getStreamHeaders(
  providerType: string,
  apiKey: string | undefined,
): Record<string, string> | undefined {
  if (!apiKey) {
    // For providers that don't need a key or optional OpenRouter headers
    return providerType === "openrouter"
      ? {
          "HTTP-Referer": globalThis.location?.origin || "http://localhost", // Use actual origin
          "X-Title": "LiteChat",
        }
      : undefined;
  }

  // Headers with API key
  return {
    Authorization: `Bearer ${apiKey}`,
    // Add OpenRouter headers if needed
    ...(providerType === "openrouter" && {
      "HTTP-Referer": globalThis.location?.origin || "http://localhost", // Use actual origin
      "X-Title": "LiteChat",
    }),
  };
}

/**
 * Updates the UI state for the message that was streaming, marking it as finished.
 * It finds the message by ID and updates its properties.
 */
export function finalizeStreamedMessageUI(
  messageId: string,
  finalContent: string,
  streamError: Error | null,
  usage: { promptTokens: number; completionTokens: number } | undefined,
  startTime: number,
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>,
): void {
  const endTime = Date.now();

  setLocalMessages((prevMessages) => {
    const messageIndex = prevMessages.findIndex((msg) => msg.id === messageId);

    if (messageIndex === -1) {
      console.warn(
        `[finalizeStreamedMessageUI] Could not find message ${messageId} in state to finalize UI.`,
      );
      return prevMessages; // Message not found, return previous state
    }

    const updatedMessages = [...prevMessages];
    const originalMessage = updatedMessages[messageIndex];

    // Calculate tokens per second, avoid division by zero
    const durationSeconds = (endTime - startTime) / 1000;
    const tokensPerSecond =
      streamError || durationSeconds <= 0 || !usage?.completionTokens
        ? undefined
        : usage.completionTokens / durationSeconds;

    // Construct the final message object for UI update
    // FIX: Ensure finalMessageObject is explicitly typed as Message
    const finalMessageObject: Message = {
      ...originalMessage,
      content: finalContent, // Set the final content
      isStreaming: false,
      streamedContent: undefined, // Clear streamed content
      error: streamError ? streamError.message : null,
      tokensInput: usage?.promptTokens,
      tokensOutput: usage?.completionTokens,
      tokensPerSecond: tokensPerSecond,
    };

    updatedMessages[messageIndex] = finalMessageObject;
    console.log(
      `[finalizeStreamedMessageUI] Successfully finalized UI for message ${messageId}.`,
    );

    // Emit event only if the message was successfully finalized without error
    if (!streamError) {
      // FIX: Pass the correctly typed finalMessageObject
      modEvents.emit(ModEvent.RESPONSE_DONE, { message: finalMessageObject });
    }

    return updatedMessages;
  });
}
