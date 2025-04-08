// src/hooks/use-ai-interaction.ts
import { useCallback, useRef } from "react";
import { streamText, type CoreMessage } from "ai";
import type { AiModelConfig, AiProviderConfig, Message } from "@/lib/types";
import { throttle } from "@/lib/throttle"; // Your throttle implementation
import { nanoid } from "nanoid";
import { toast } from "sonner";

// --- Interfaces remain the same ---
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
  abortControllerRef: React.MutableRefObject<AbortController | null>;
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
  abortControllerRef,
}: UseAiInteractionProps): UseAiInteractionReturn {
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
      // --- Boilerplate checks remain the same ---
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
        selectedProvider.requiresApiKey ?? selectedProvider.id !== "mock";
      if (needsKey && !apiKey) {
        const err = new Error(
          `API Key for ${selectedProvider.name} is not set or selected.`,
        );
        setError(err.message);
        toast.error(err.message);
        throw err;
      }

      const assistantMessageId = nanoid();
      const assistantPlaceholderTimestamp = new Date();
      const assistantPlaceholder: Message = {
        id: assistantMessageId,
        conversationId: conversationIdToUse,
        role: "assistant",
        content: "",
        createdAt: assistantPlaceholderTimestamp,
        isStreaming: true,
        streamedContent: "", // Start empty
        error: null,
      };

      // console.log(
      //   `[AI Stream ${assistantMessageId}] Adding placeholder message.`,
      // );
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      setIsAiStreaming(true);
      setError(null);

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;
      // console.log(`[AI Stream ${assistantMessageId}] Created AbortController.`);

      // This variable holds the *true* accumulated content.
      let finalContent = "";

      // --- Throttled Update Function (Corrected Logic) ---
      // It no longer needs the chunk as an argument.
      const throttledStreamUpdate = throttle(() => {
        // It reads the *current* value of finalContent from the outer scope.
        const currentAccumulatedContent = finalContent;

        setLocalMessages((prev) => {
          const targetMessageIndex = prev.findIndex(
            (msg) => msg.id === assistantMessageId,
          );
          if (targetMessageIndex === -1) {
            return prev; // Message gone
          }

          const targetMessage = prev[targetMessageIndex];

          // Check if still streaming (prevents updates after finally block)
          if (!targetMessage.isStreaming) {
            // console.log(
            //   `[AI Stream ${assistantMessageId}] Throttled update skipped: Message no longer streaming.`,
            // );
            return prev;
          }

          const updatedMessages = [...prev];
          updatedMessages[targetMessageIndex] = {
            ...targetMessage,
            streamedContent: currentAccumulatedContent, // Use the up-to-date accumulated string
          };
          return updatedMessages;
        });
      }, streamingThrottleRate);

      let streamError: Error | null = null;
      let deltaCount = 0;

      try {
        // --- Stream preparation remains the same ---
        const messagesForApi: CoreMessage[] = [];
        if (systemPromptToUse) {
          messagesForApi.push({ role: "system", content: systemPromptToUse });
        }
        messagesForApi.push(
          ...messagesToSend.filter((m) => m.role !== "system"),
        );

        // console.log(
        //   `[AI Stream ${assistantMessageId}] Sending ${messagesForApi.length} messages to AI. Model: ${selectedModel.id}`,
        // );

        const result = streamText({
          model: selectedModel.instance,
          messages: messagesForApi,
          abortSignal: currentAbortController.signal,
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined,
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
        });

        // console.log(`[AI Stream ${assistantMessageId}] Starting stream loop.`);
        for await (const delta of result.textStream) {
          deltaCount++;
          // *** Accumulate the ground truth here ***
          finalContent += delta;
          // *** Trigger the throttled UI update (without passing the delta) ***
          throttledStreamUpdate();
        }
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Stream loop finished normally after ${deltaCount} deltas. Final content length: ${finalContent.length}`,
        // );
      } catch (err: any) {
        // --- Error handling remains the same ---
        streamError = err;
        if (err.name === "AbortError") {
          // console.log(
          //   `[AI Stream ${assistantMessageId}] Stream aborted by user after ${deltaCount} deltas.`,
          // );
          // Use the finalContent accumulated up to the abort point
          // console.log(
          //   `[AI Stream ${assistantMessageId}] Abort final content set to (from finalContent): "${finalContent}"`,
          // );
          streamError = null;
        } else {
          console.error(
            `[AI Stream ${assistantMessageId}] streamText error after ${deltaCount} deltas:`,
            err,
          );
          finalContent = `Error: ${err.message || "Failed to get response"}`;
          setError(`AI Error: ${finalContent}`);
          toast.error(`AI Error: ${err.message || "Unknown error"}`);
        }
      } finally {
        // --- Finally block remains the same ---
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Entering finally block. StreamError: ${streamError?.message}`,
        // );

        // Optional: Cancel throttled calls if your throttle function supports it
        // (throttledStreamUpdate as any).cancel?.();

        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
          // console.log(
          //   `[AI Stream ${assistantMessageId}] Cleared matching AbortController ref.`,
          // );
        } else {
          // console.log(
          //   `[AI Stream ${assistantMessageId}] AbortController ref did not match or was already null.`,
          // );
        }

        setIsAiStreaming(false);

        // console.log(
        //   `[AI Stream ${assistantMessageId}] Finalizing message state. Using finalContent (length ${finalContent.length}): "${finalContent.substring(0, 100)}..."`,
        // );

        // Final UI state update uses the complete finalContent
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: finalContent, // The ground truth
                  isStreaming: false,
                  streamedContent: undefined, // Clear the intermediate buffer
                  error: streamError ? streamError.message : null,
                }
              : msg,
          ),
        );
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Final UI state update dispatched.`,
        // );

        // --- DB Save Logic remains the same (uses finalContent) ---
        if (!streamError && finalContent.trim() !== "") {
          // console.log(
          //   `[AI Stream ${assistantMessageId}] Attempting to save final message to DB.`,
          // );
          try {
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent, // Save the ground truth
              createdAt: assistantPlaceholderTimestamp,
            });
            // console.log(
            //   `[AI Stream ${assistantMessageId}] Assistant message saved to DB successfully.`,
            // );
          } catch (dbErr: any) {
            const dbErrorMessage = `Save failed: ${dbErr.message}`;
            console.error(
              `[AI Stream ${assistantMessageId}] Failed to save final assistant message to DB:`,
              dbErr,
            );
            setError(`Error saving response: ${dbErr.message}`);
            toast.error(`Failed to save response: ${dbErr.message}`);
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, error: dbErrorMessage }
                  : msg,
              ),
            );
            // console.log(
            //   `[AI Stream ${assistantMessageId}] Updated message in UI state with DB save error.`,
            // );
          }
        } else if (streamError) {
          setError(`AI Error: ${streamError.message}`);
          // console.log(
          //   `[AI Stream ${assistantMessageId}] DB save skipped due to stream error.`,
          // );
        } else {
          console.log(
            `[AI Stream ${assistantMessageId}] DB save skipped due to empty or whitespace-only final content.`,
          );
        }
        // console.log(
        //   `[AI Stream ${assistantMessageId}] Exiting finally block.`,
        // );
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
      addDbMessage,
      abortControllerRef,
    ],
  );

  return {
    performAiStream,
  };
}
