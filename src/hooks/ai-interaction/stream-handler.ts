// src/hooks/ai-interaction/stream-handler.ts
import { nanoid } from "nanoid";
import { streamText, type CoreMessage } from "ai";
import { Message } from "@/lib/types";
import { throttle } from "@/lib/throttle";
import { modEvents, ModEvent } from "@/mods/events";

/**
 * Creates an assistant message placeholder for streaming
 */
export function createAssistantPlaceholder(
  conversationId: string,
  providerId: string,
  modelId: string
): { id: string, message: Message, timestamp: Date } {
  const assistantMessageId = nanoid();
  const assistantPlaceholderTimestamp = new Date();
  const assistantPlaceholder: Message = {
    id: assistantMessageId,
    conversationId: conversationId,
    role: "assistant",
    content: "",
    createdAt: assistantPlaceholderTimestamp,
    isStreaming: true,
    streamedContent: "", // Start empty
    error: null,
    providerId: providerId,
    modelId: modelId,
  };

  return { 
    id: assistantMessageId, 
    message: assistantPlaceholder,
    timestamp: assistantPlaceholderTimestamp 
  };
}

/**
 * Creates a throttled function to update the streamed content in the UI
 */
export function createStreamUpdater(
  assistantMessageId: string,
  contentRef: { current: string },
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  throttleRate: number
) {
  return throttle(() => {
    const currentAccumulatedContent = contentRef.current;
    setLocalMessages((prev) => {
      const targetMessageIndex = prev.findIndex(
        (msg) => msg.id === assistantMessageId
      );
      if (
        targetMessageIndex === -1 ||
        !prev[targetMessageIndex].isStreaming
      ) {
        return prev;
      }
      const updatedMessages = [...prev];
      updatedMessages[targetMessageIndex] = {
        ...prev[targetMessageIndex],
        streamedContent: currentAccumulatedContent,
      };
      return updatedMessages;
    });
  }, throttleRate);
}

/**
 * Handles getting API headers for different providers
 */
export function getStreamHeaders(
  providerType: string,
  apiKey: string | undefined
): Record<string, string> | undefined {
  if (!apiKey) {
    // For providers that don't need a key or optional OpenRouter headers
    return providerType === "openrouter"
      ? {
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "LiteChat",
        }
      : undefined;
  }

  // Headers with API key
  return {
    Authorization: `Bearer ${apiKey}`,
    // Add OpenRouter headers if needed
    ...(providerType === "openrouter" && {
      "HTTP-Referer": "http://localhost:5173",
      "X-Title": "LiteChat",
    }),
  };
}

/**
 * Updates the message list with the final message content after streaming
 */
export function finalizeStreamedMessage(
  messageId: string,
  finalContent: string,
  streamError: Error | null,
  messagesToSend: CoreMessage[],
  startTime: number,
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>
): Message | null {
  let finalMessageObject: Message | null = null;

  setLocalMessages((prev) =>
    prev.map((msg) => {
      if (msg.id === messageId) {
        finalMessageObject = {
          ...msg,
          content: finalContent,
          isStreaming: false,
          streamedContent: undefined,
          error: streamError ? streamError.message : null,
          // providerId and modelId already set in placeholder
          tokensInput: messagesToSend.reduce(
            (sum, m) => sum + (m.content.length || 0),
            0
          ),
          tokensOutput: finalContent.length,
          tokensPerSecond:
            streamError || !startTime
              ? undefined
              : finalContent.length / ((Date.now() - startTime) / 1000 || 1),
        };
        return finalMessageObject;
      }
      return msg;
    })
  );

  return finalMessageObject;
}

/**
 * Executes the AI stream and processes the response
 */
export async function executeAiStream(
  messagesToSend: CoreMessage[],
  abortSignal: AbortSignal,
  temperature: number,
  maxTokens: number | null,
  topP: number | null,
  topK: number | null,
  presencePenalty: number | null,
  frequencyPenalty: number | null,
  modelInstance: any,
  headers: Record<string, string> | undefined,
  conversationId: string,
  contentRef: { current: string },
  throttledUpdate: () => void
): Promise<void> {
  modEvents.emit(ModEvent.RESPONSE_START, {
    conversationId: conversationId,
  });

  const result = streamText({
    model: modelInstance,
    messages: messagesToSend,
    abortSignal: abortSignal,
    temperature: temperature,
    maxTokens: maxTokens ?? undefined,
    topP: topP ?? undefined,
    topK: topK ?? undefined,
    presencePenalty: presencePenalty ?? undefined,
    frequencyPenalty: frequencyPenalty ?? undefined,
    headers: headers,
  });

  for await (const delta of result.textStream) {
    contentRef.current += delta;
    modEvents.emit(ModEvent.RESPONSE_CHUNK, {
      chunk: delta,
      conversationId: conversationId,
    });
    throttledUpdate();
  }
}