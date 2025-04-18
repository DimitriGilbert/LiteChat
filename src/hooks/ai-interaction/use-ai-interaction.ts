// src/hooks/ai-interaction/use-ai-interaction.ts
import { useCallback } from "react";
import { toast } from "sonner";
import { ModEvent, modEvents } from "@/mods/events";
import { type CoreMessage } from "ai";
import { Message } from "@/lib/types";

import { 
  UseAiInteractionProps, 
  PerformAiStreamParams,
  UseAiInteractionReturn 
} from "./types";

import {
  validateAiParameters,
  handleStreamError
} from "./error-handler";

import {
  createAssistantPlaceholder,
  createStreamUpdater,
  getStreamHeaders,
  finalizeStreamedMessage,
  executeAiStream
} from "./stream-handler";

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
      messagesToSend,
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
        setError
      );
      
      if (validationError) {
        throw validationError;
      }

      // 2. Create placeholder message for streaming
      const { id: assistantMessageId, message: assistantPlaceholder, timestamp: assistantPlaceholderTimestamp } = 
        createAssistantPlaceholder(
          conversationIdToUse,
          selectedProvider!.id, // Non-null assertion is safe after validation
          selectedModel!.id     // Non-null assertion is safe after validation
        );

      // 3. Add placeholder message to UI
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);
      setIsAiStreaming(true);
      setError(null);

      // 4. Setup abort controller for streaming
      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      // 5. References to track state during streaming
      const contentRef = { current: "" };
      let streamError: Error | null = null;
      let finalContent = "";
      let finalMessageObject: Message | null = null;
      
      // 6. Create throttled update function
      const throttledStreamUpdate = createStreamUpdater(
        assistantMessageId,
        contentRef,
        setLocalMessages,
        streamingThrottleRate
      );

      const startTime = Date.now();
      
      // 7. Prepare system message if provided
      const messagesForApi: CoreMessage[] = [];
      if (systemPromptToUse) {
        messagesForApi.push({ role: "system", content: systemPromptToUse });
      }
      messagesForApi.push(
        ...messagesToSend.filter((m) => m.role !== "system")
      );

      try {
        // 8. Get API headers
        const headers = getStreamHeaders(selectedProvider!.type, apiKey);
        
        // 9. Execute streaming
        await executeAiStream(
          messagesForApi,
          currentAbortController.signal,
          currentTemperature,
          currentMaxTokens,
          currentTopP,
          currentTopK,
          currentPresencePenalty,
          currentFrequencyPenalty,
          selectedModel!.instance,
          headers,
          conversationIdToUse,
          contentRef,
          throttledStreamUpdate
        );
        
        // If we get here, streaming completed successfully
        finalContent = contentRef.current;
      } catch (err: unknown) {
        // 10. Handle streaming errors
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
          finalContent,
          streamError,
          messagesToSend,
          startTime,
          setLocalMessages
        );

        // 13. Save to database if successful
        if (!streamError && finalContent.trim() !== "") {
          try {
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent,
              createdAt: assistantPlaceholderTimestamp,
              // TODO: Add provider/model info to DbMessage schema if needed
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
                  : msg
              )
            );
          }
        } else if (streamError) {
          // Error already handled in catch block
        } else {
          console.log("DB save skipped due to empty final content.");
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
    ]
  );

  return {
    performAiStream,
  };
}