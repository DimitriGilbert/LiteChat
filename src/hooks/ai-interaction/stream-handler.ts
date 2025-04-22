// src/hooks/ai-interaction/stream-handler.ts
import { Message } from "@/lib/types";
import { ModEvent, modEvents } from "@/mods/events";
import { throttle } from "@/lib/throttle";
import { nanoid } from "nanoid";

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
  // Use updateMessage action instead of setLocalMessages
  updateMessage: (id: string, updates: Partial<Message>) => void,
  refreshRateMs: number, // Renamed parameter
) {
  return throttle(() => {
    const currentAccumulatedContent = contentRef.current;
    // Call updateMessage to update only the streamedContent
    updateMessage(assistantMessageId, {
      streamedContent: currentAccumulatedContent,
      isStreaming: true, // Ensure isStreaming stays true during updates
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
  messageId: string, // messageId is available here
  finalContent: string,
  streamError: Error | null,
  usage: { promptTokens: number; completionTokens: number } | undefined,
  startTime: number,
  updateMessage: (id: string, updates: Partial<Message>) => void,
): void {
  const endTime = Date.now();

  // Calculate tokens per second, avoid division by zero
  const durationSeconds = (endTime - startTime) / 1000;
  const tokensPerSecond =
    streamError || durationSeconds <= 0 || !usage?.completionTokens
      ? undefined
      : usage.completionTokens / durationSeconds;

  // Construct the final updates object
  const finalUpdates: Partial<Message> = {
    content: finalContent, // Set the final content
    isStreaming: false,
    streamedContent: undefined, // Clear streamed content
    error: streamError ? streamError.message : null,
    tokensInput: usage?.promptTokens,
    tokensOutput: usage?.completionTokens,
    tokensPerSecond: tokensPerSecond,
  };

  // Call updateMessage with the final updates
  updateMessage(messageId, finalUpdates);

  // Emit event only if the message was successfully finalized without error
  if (!streamError) {
    // Emit the event with just the message ID
    modEvents.emit(ModEvent.RESPONSE_DONE, { message: { id: messageId } }); // Pass only messageId
  }
}
