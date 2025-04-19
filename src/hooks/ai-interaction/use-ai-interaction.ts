// src/hooks/ai-interaction/use-ai-interaction.ts
import { useCallback } from "react";
import { toast } from "sonner";
import { ModEvent, modEvents } from "@/mods/events";
// Use the aliased/re-exported CoreMessage from our types
import { Message, CoreMessage } from "@/lib/types";

import {
  UseAiInteractionProps,
  PerformAiStreamParams,
  UseAiInteractionReturn,
} from "./types";

import { validateAiParameters, handleStreamError } from "./error-handler";

import {
  createAssistantPlaceholder,
  createStreamUpdater,
  getStreamHeaders,
  finalizeStreamedMessage,
  executeAiStream, // Assuming this function exists in stream-handler.ts
} from "./stream-handler"; // Assuming this path

/**
 * Hook for handling AI interactions with streaming capabilities
 */
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
      messagesToSend, // This is CoreMessage[] and SHOULD contain the correct structure
      currentTemperature,
      currentMaxTokens,
      currentTopP,
      currentTopK,
      currentPresencePenalty,
      currentFrequencyPenalty,
      systemPromptToUse,
    }: PerformAiStreamParams) => {
      // 1. Validate required parameters
      const apiKey = getApiKeyForProvider();
      const validationError = validateAiParameters(
        conversationIdToUse,
        selectedModel,
        selectedProvider,
        apiKey,
        setError,
      );

      if (validationError) {
        throw validationError; // Re-throw to be caught by caller (useMessageHandling)
      }

      // 2. Create placeholder message for streaming
      const {
        id: assistantMessageId,
        message: assistantPlaceholder,
        timestamp: assistantPlaceholderTimestamp,
      } = createAssistantPlaceholder(
        conversationIdToUse,
        selectedProvider!.id, // Non-null assertion is safe after validation
        selectedModel!.id, // Non-null assertion is safe after validation
      );

      // 3. Add placeholder message to UI
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);
      setIsAiStreaming(true);
      setError(null);

      // 4. Setup abort controller for streaming
      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      // 5. References to track state during streaming
      const contentRef = { current: "" }; // Tracks the streamed *text* content
      let streamError: Error | null = null;
      let finalContent = ""; // Stores the final aggregated text content
      let finalMessageObject: Message | null = null;

      // 6. Create throttled update function
      const throttledStreamUpdate = createStreamUpdater(
        assistantMessageId,
        contentRef,
        setLocalMessages,
        streamingThrottleRate,
      );

      const startTime = Date.now();

      // 7. Prepare messages for API (already CoreMessage[] including multi-modal user message)
      const messagesForApi: CoreMessage[] = [];
      if (systemPromptToUse) {
        messagesForApi.push({ role: "system", content: systemPromptToUse });
      }
      messagesForApi.push(...messagesToSend.filter((m) => m.role !== "system"));

      // --- CRITICAL DEBUGGING STEP ---
      // Log the exact structure being passed to the execution function
      console.log(
        "--- Preparing to call executeAiStream ---",
        "\nProvider:",
        selectedProvider?.name,
        "\nModel:",
        selectedModel?.name,
        "\nMessages Structure:",
        JSON.stringify(messagesForApi, null, 2), // Log the full structure
      );
      // --- END DEBUGGING STEP ---

      try {
        // 8. Get API headers
        const headers = getStreamHeaders(selectedProvider!.type, apiKey);

        // 9. Execute streaming
        // Ensure executeAiStream is called with the CORRECT messagesForApi structure.
        // The implementation of executeAiStream itself needs to handle this correctly
        // when calling the underlying AI SDK function (e.g., streamText).
        await executeAiStream(
          messagesForApi, // Pass the CoreMessage[] array directly
          currentAbortController.signal,
          currentTemperature,
          currentMaxTokens,
          currentTopP,
          currentTopK,
          currentPresencePenalty,
          currentFrequencyPenalty,
          selectedModel!.instance, // The provider model instance from AI SDK
          headers,
          conversationIdToUse,
          contentRef, // contentRef tracks the text part of the response
          throttledStreamUpdate,
        );

        // If we get here, streaming completed successfully
        finalContent = contentRef.current; // Final text content
      } catch (err: unknown) {
        // 10. Handle streaming errors
        console.error("Error during executeAiStream call:", err); // Log the actual error
        [streamError, finalContent] = handleStreamError(err, setError);
      } finally {
        // 11. Clean up controller reference
        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
        }
        setIsAiStreaming(false);

        // 12. Update message with final content
        finalMessageObject = finalizeStreamedMessage(
          assistantMessageId,
          finalContent, // Use the aggregated text content
          streamError,
          messagesToSend, // Pass original messages for context if needed
          startTime,
          setLocalMessages,
        );

        // 13. Save to database if successful
        if (!streamError && finalContent.trim() !== "") {
          try {
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent, // Save the final text content
              createdAt: assistantPlaceholderTimestamp,
            });

            if (finalMessageObject) {
              modEvents.emit(ModEvent.RESPONSE_DONE, {
                message: finalMessageObject,
              });
            }
          } catch (dbErr: unknown) {
            const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
            console.error("Failed to save final assistant message:", dbErr);
            setError(`Error saving response: ${dbErrorMessage}`);
            toast.error(`Failed to save response: ${dbErrorMessage}`);
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, error: dbErrorMessage }
                  : msg,
              ),
            );
          }
        } else if (streamError) {
          // Error already handled
        } else {
          if (!streamError) {
            setLocalMessages((prev) =>
              prev.filter((msg) => msg.id !== assistantMessageId),
            );
            console.log(
              "DB save skipped and placeholder removed due to empty final content.",
            );
          } else {
            console.log("DB save skipped due to empty final content.");
          }
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
      addDbMessage,
      abortControllerRef,
    ],
  );

  return {
    performAiStream,
  };
}
