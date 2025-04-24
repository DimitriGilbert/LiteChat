
import { Message, MessageContent } from "@/lib/types";
import { ModEvent, modEvents } from "@/mods/events";
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
    content: "",
    createdAt: assistantPlaceholderTimestamp,
    isStreaming: true,
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
 * Handles getting API headers for different providers
 */
export function getStreamHeaders(
  providerType: string,
  apiKey: string | undefined,
): Record<string, string> | undefined {
  if (!apiKey) {
    return providerType === "openrouter"
      ? {
          "HTTP-Referer": globalThis.location?.origin || "http://localhost",
          "X-Title": "LiteChat",
        }
      : undefined;
  }

  // Headers with API key
  return {
    Authorization: `Bearer ${apiKey}`,
    ...(providerType === "openrouter" && {
      "HTTP-Referer": globalThis.location?.origin || "http://localhost",
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
  finalContent: MessageContent,
  streamError: Error | null,
  usage: { promptTokens: number; completionTokens: number } | undefined,
  startTime: number,
  updateMessage: (id: string, updates: Partial<Message>) => void,
  setActiveStream: (messageId: string | null) => void,
): void {
  const endTime = Date.now();
  const durationSeconds = (endTime - startTime) / 1000;
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
  updateMessage(messageId, finalUpdates);
  setActiveStream(null);
  if (!streamError) {
    // Emit the event with the finalized message data
    modEvents.emit(ModEvent.RESPONSE_DONE, {
      message: { id: messageId, ...finalUpdates },
    });
  }
}
