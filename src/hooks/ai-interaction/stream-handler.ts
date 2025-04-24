// src/hooks/ai-interaction/stream-handler.ts
import { Message, MessageContent } from "@/lib/types";
import { ModEvent, modEvents } from "@/mods/events";
import { nanoid } from "nanoid";

/**
 * Creates an assistant message placeholder for streaming.
 * Includes providerId and modelId.
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
    content: "", // Start with empty content
    createdAt: assistantPlaceholderTimestamp,
    isStreaming: true,
    error: null,
    providerId: providerId, // Include provider ID
    modelId: modelId, // Include model ID
  };

  return {
    id: assistantMessageId,
    message: assistantPlaceholder,
    timestamp: assistantPlaceholderTimestamp,
  };
}

/**
 * Handles getting API headers for different providers.
 * Includes specific headers for OpenRouter.
 */
export function getStreamHeaders(
  providerType: string,
  apiKey: string | undefined,
): Record<string, string> | undefined {
  const headers: Record<string, string> = {};

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // Add OpenRouter specific headers if applicable
  if (providerType === "openrouter") {
    headers["HTTP-Referer"] = globalThis.location?.origin || "http://localhost";
    headers["X-Title"] = "LiteChat"; // Or your app name
  }

  // Return headers only if there are any, otherwise undefined
  return Object.keys(headers).length > 0 ? headers : undefined;
}

/**
 * Updates the UI state for the message that was streaming, marking it as finished.
 * It finds the message by ID and updates its properties, including token usage and speed.
 */
export function finalizeStreamedMessageUI(
  messageId: string,
  finalContent: MessageContent,
  streamError: Error | null,
  usage: { promptTokens: number; completionTokens: number } | undefined,
  startTime: number,
  updateMessage: (id: string, updates: Partial<Message>) => void,
  setActiveStream: (messageId: string | null) => void,
): void {
  const endTime = Date.now();
  const durationSeconds = (endTime - startTime) / 1000;

  // Calculate tokens per second, avoiding division by zero or invalid data
  const tokensPerSecond =
    streamError || durationSeconds <= 0 || !usage?.completionTokens
      ? undefined
      : usage.completionTokens / durationSeconds;

  const finalUpdates: Partial<Message> = {
    content: finalContent,
    isStreaming: false,
    error: streamError ? streamError.message : null,
    tokensInput: usage?.promptTokens,
    tokensOutput: usage?.completionTokens,
    tokensPerSecond: tokensPerSecond,
  };

  // Update the message in the UI state
  updateMessage(messageId, finalUpdates);

  // Clear the active stream ID
  setActiveStream(null);

  // Emit event only if the stream completed without error
  if (!streamError) {
    // Construct a partial message object for the event payload
    const eventMessagePayload: Partial<Message> = {
      id: messageId,
      content: finalContent,
      tokensInput: usage?.promptTokens,
      tokensOutput: usage?.completionTokens,
      tokensPerSecond: tokensPerSecond,
      // Include other relevant final properties if needed
    };
    modEvents.emit(ModEvent.RESPONSE_DONE, { message: eventMessagePayload });
  }
}
