// src/hooks/use-ai-interaction.ts
import { useCallback, useRef } from "react";
import { streamText, type CoreMessage } from "ai";
import type { AiModelConfig, AiProviderConfig, Message } from "@/lib/types";
import { throttle } from "@/lib/throttle";
import { nanoid } from "nanoid";
import { toast } from "sonner";

interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  streamingThrottleRate: number;
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (error: string | null) => void;
  addDbMessage: (
    messageData: Omit<import("@/lib/types").DbMessage, "id" | "createdAt"> &
      Partial<Pick<import("@/lib/types").DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
}

interface PerformAiStreamParams {
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

interface UseAiInteractionReturn {
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export function useAiInteraction({
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  streamingThrottleRate,
  setLocalMessages,
  setIsAiStreaming,
  setError,
  addDbMessage,
}: UseAiInteractionProps): UseAiInteractionReturn {
  const abortControllerRef = useRef<AbortController | null>(null);

  const performAiStream = useCallback(
    async ({
      conversationIdToUse,
      messagesToSend,
      currentTemperature,
      currentMaxTokens,
      currentTopP,
      currentTopK,
      currentPresencePenalty,
      currentFrequencyPenalty,
      systemPromptToUse,
    }: PerformAiStreamParams) => {
      if (!conversationIdToUse) {
        const err = new Error(
          "Internal Error: No active conversation ID provided.",
        );
        setError(err.message);
        throw err;
      }
      if (!selectedModel || !selectedProvider) {
        const err = new Error("AI provider or model not selected.");
        setError(err.message);
        throw err;
      }

      const apiKey = getApiKeyForProvider(selectedProvider.id);
      const needsKey =
        selectedProvider.requiresApiKey ?? selectedProvider.id !== "mock"; // Assume non-mock needs key unless specified otherwise
      if (needsKey && !apiKey) {
        const err = new Error(
          `API Key for ${selectedProvider.name} is not set or selected.`,
        );
        setError(err.message);
        toast.error(err.message); // Also show toast for visibility
        throw err;
      }

      const assistantMessageId = nanoid();
      const assistantPlaceholderTimestamp = new Date();
      const assistantPlaceholder: Message = {
        id: assistantMessageId,
        conversationId: conversationIdToUse,
        role: "assistant",
        content: "", // Start with empty content
        createdAt: assistantPlaceholderTimestamp,
        isStreaming: true,
        streamedContent: "", // Initialize streamed content
        error: null,
      };

      // Add placeholder immediately to local state for UI update
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      setIsAiStreaming(true);
      setError(null); // Clear previous errors

      abortControllerRef.current = new AbortController();

      // Throttle UI updates for streamed content
      const throttledStreamUpdate = throttle((streamedContentChunk: string) => {
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  // Append chunk to the streamed content
                  streamedContent:
                    (msg.streamedContent || "") + streamedContentChunk,
                }
              : msg,
          ),
        );
      }, streamingThrottleRate);

      let finalContent = "";
      let streamError: Error | null = null;

      try {
        const messagesForApi: CoreMessage[] = [];
        // Add system prompt if provided
        if (systemPromptToUse) {
          messagesForApi.push({ role: "system", content: systemPromptToUse });
        }
        // Add user/assistant messages, filtering out any potential system messages from history
        messagesForApi.push(
          ...messagesToSend.filter((m) => m.role !== "system"),
        );

        console.log(
          "Sending messages to AI:",
          JSON.stringify(messagesForApi, null, 2),
        );

        // Call the Vercel AI SDK
        const result = streamText({
          model: selectedModel.instance,
          messages: messagesForApi,
          abortSignal: abortControllerRef.current.signal,
          // Pass through AI parameters
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined, // Use undefined if null
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
          // Add other parameters like tools if needed:
          // tools: selectedModel.tools,
        });

        // Process the stream
        for await (const delta of result.textStream) {
          finalContent += delta;
          throttledStreamUpdate(delta); // Update UI via throttled function
        }
        console.log("Stream finished. Final raw content:", finalContent);
      } catch (err: any) {
        streamError = err;
        if (err.name === "AbortError") {
          console.log("Stream aborted by user.");
          // Capture the content streamed so far before finalizing state
          setLocalMessages((prev) => {
            const abortedMsg = prev.find((m) => m.id === assistantMessageId);
            finalContent = abortedMsg?.streamedContent || "Stopped"; // Use streamed content or "Stopped"
            return prev; // No state change here, just reading
          });
          streamError = null; // Clear error as it was intentional
        } else {
          console.error("streamText error:", err);
          finalContent = `Error: ${err.message || "Failed to get response"}`;
          setError(`AI Error: ${finalContent}`); // Set global error state
          toast.error(`AI Error: ${err.message || "Unknown error"}`);
        }
      } finally {
        abortControllerRef.current = null; // Clear the abort controller ref
        setIsAiStreaming(false); // Update streaming status

        console.log("Finalizing message state. Content:", finalContent);

        // Final update to the message in local state
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: finalContent, // Set the final content
                  isStreaming: false, // Mark as not streaming
                  streamedContent: undefined, // Clear intermediate streamed content
                  error: streamError ? streamError.message : null, // Set error if one occurred
                }
              : msg,
          ),
        );

        // Save the final message to DB if there was no stream error
        if (!streamError && finalContent.trim() !== "") {
          // Avoid saving empty/error messages
          try {
            await addDbMessage({
              id: assistantMessageId, // Use the same ID
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent,
              createdAt: assistantPlaceholderTimestamp, // Use original timestamp
            });
            console.log("Assistant message saved to DB:", assistantMessageId);
          } catch (dbErr: any) {
            console.error(
              "Failed to save final assistant message to DB:",
              dbErr,
            );
            setError(`Error saving response: ${dbErr.message}`);
            toast.error(`Failed to save response: ${dbErr.message}`);
            // Optionally update the message state again to show save error
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, error: `Save failed: ${dbErr.message}` }
                  : msg,
              ),
            );
          }
        } else if (streamError) {
          // If there was a stream error, ensure the error state is set
          setError(`AI Error: ${streamError.message}`);
        }
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      streamingThrottleRate,
      setLocalMessages,
      setIsAiStreaming,
      setError,
      addDbMessage, // Include addDbMessage dependency
    ],
  );

  return {
    performAiStream,
    abortControllerRef,
  };
}
