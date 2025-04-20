// src/hooks/ai-interaction/use-ai-interaction.ts
import { useCallback } from "react";
import { toast } from "sonner";
import { ModEvent, modEvents } from "@/mods/events";
// Use the aliased/re-exported CoreMessage from our types
import { Message, CoreMessage, ImagePart } from "@/lib/types";
import { experimental_generateImage as generateImage } from "ai"; // Import generateImage

import {
  UseAiInteractionProps,
  PerformAiStreamParams,
  PerformImageGenerationParams, // Import new type
  PerformImageGenerationResult, // Import new type
  UseAiInteractionReturn,
} from "./types";

import { validateAiParameters, handleStreamError } from "./error-handler";

import {
  createAssistantPlaceholder,
  createStreamUpdater,
  getStreamHeaders,
  finalizeStreamedMessage,
  executeAiStream,
} from "./stream-handler";
import { nanoid } from "nanoid";

/**
 * Hook for handling AI interactions with streaming and image generation capabilities
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
  // --- Text Streaming Logic (performAiStream) ---
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
        selectedProvider!.id,
        selectedModel!.id,
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
        streamingThrottleRate,
      );

      const startTime = Date.now();

      // 7. Prepare messages for API
      const messagesForApi: CoreMessage[] = [];
      if (systemPromptToUse) {
        messagesForApi.push({ role: "system", content: systemPromptToUse });
      }
      messagesForApi.push(...messagesToSend.filter((m) => m.role !== "system"));

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
          throttledStreamUpdate,
        );

        finalContent = contentRef.current;
      } catch (err: unknown) {
        console.error("Error during executeAiStream call:", err);
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
          setLocalMessages,
        );

        // 13. Save to database if successful
        if (!streamError && finalContent.trim() !== "") {
          try {
            // Only save fields defined in DbMessage
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent,
              createdAt: assistantPlaceholderTimestamp,
              // vfsContextPaths: finalMessageObject?.vfsContextPaths, // If needed
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
          // Remove placeholder if stream ended with empty content and no error
          setLocalMessages((prev) =>
            prev.filter((msg) => msg.id !== assistantMessageId),
          );
          console.log(
            "DB save skipped and placeholder removed due to empty final content.",
          );
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

  // --- Image Generation Logic (performImageGeneration) ---
  const performImageGeneration = useCallback(
    async ({
      conversationIdToUse,
      prompt,
      n = 1, // Default to 1 image
      size = "1024x1024", // Default size
      aspectRatio,
    }: PerformImageGenerationParams): Promise<PerformImageGenerationResult> => {
      // 1. Validate parameters
      const apiKey = getApiKeyForProvider();
      const validationError = validateAiParameters(
        conversationIdToUse,
        selectedModel,
        selectedProvider,
        apiKey,
        setError,
        true, // isImageGeneration = true
      );

      if (validationError) {
        return { error: validationError.message };
      }

      // Ensure model instance exists and supports image generation
      if (!selectedModel?.instance || !selectedModel?.supportsImageGeneration) {
        const errorMsg = "Selected model does not support image generation.";
        setError(errorMsg);
        return { error: errorMsg };
      }

      // 2. Set loading state and clear errors
      setIsAiStreaming(true); // Use the same flag for general loading state
      setError(null);

      // 3. Setup abort controller
      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      // 4. Create placeholder message (optional, could show a "Generating image..." text)
      const placeholderId = nanoid();
      const placeholderTimestamp = new Date();
      const placeholderMessage: Message = {
        id: placeholderId,
        conversationId: conversationIdToUse,
        role: "assistant",
        content: `Generating image for: "${prompt}"...`,
        isStreaming: true, // Use isStreaming to indicate loading
        createdAt: placeholderTimestamp,
        providerId: selectedProvider!.id,
        modelId: selectedModel!.id,
      };
      setLocalMessages((prev) => [...prev, placeholderMessage]);

      try {
        // 5. Call the AI SDK generateImage function
        console.log(
          `--- Calling generateImage ---
Provider: ${selectedProvider?.name}
Model: ${selectedModel?.name}
Prompt: ${prompt}
n: ${n}
Size: ${size}
AspectRatio: ${aspectRatio}`,
        );

        // Use type assertion 'as any' to bypass strict literal checks
        const { images, warnings } = await generateImage({
          model: selectedModel.instance, // Pass the model instance
          prompt: prompt,
          n: n,
          size: size as any, // Use type assertion
          aspectRatio: aspectRatio as any, // Use type assertion
          // Pass API key if needed via headers (depends on provider setup in model instance)
          headers: getStreamHeaders(selectedProvider!.type, apiKey),
          abortSignal: currentAbortController.signal,
          // providerOptions: {} // Add provider-specific options if necessary
        });

        console.log("--- generateImage Response ---", { images, warnings });

        // 6. Process the result - Convert to ImagePart[] with base64
        const imageParts: ImagePart[] = images.map((img) => ({
          type: "image",
          image: `data:${img.mimeType ?? "image/png"};base64,${img.base64}`, // Create data URL
          mediaType: img.mimeType ?? "image/png",
        }));

        // 7. Update the placeholder message with the actual images
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId
              ? {
                  ...msg,
                  content: imageParts, // Set content to the array of image parts
                  isStreaming: false,
                  error: null,
                }
              : msg,
          ),
        );

        // 8. Save the final message to DB
        try {
          // Only save fields defined in DbMessage
          await addDbMessage({
            id: placeholderId,
            conversationId: conversationIdToUse,
            role: "assistant",
            content: imageParts, // Save the array of image parts
            createdAt: placeholderTimestamp,
            // vfsContextPaths: undefined, // If needed
          });
          // Emit event if needed
          // modEvents.emit(ModEvent.RESPONSE_DONE, { message: finalMessageObject });
        } catch (dbErr: unknown) {
          const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
          console.error("Failed to save image generation message:", dbErr);
          setError(`Error saving image: ${dbErrorMessage}`);
          toast.error(`Failed to save image: ${dbErrorMessage}`);
          setLocalMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId
                ? { ...msg, error: dbErrorMessage, isStreaming: false }
                : msg,
            ),
          );
        }

        return { images: imageParts, warnings };
      } catch (err: unknown) {
        // 9. Handle errors
        console.error("Error during generateImage call:", err);
        const error = err instanceof Error ? err : new Error(String(err));
        const errorMessage = `Image generation failed: ${error.message}`;
        setError(errorMessage);
        toast.error(errorMessage);

        // Update placeholder with error
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId
              ? { ...msg, error: errorMessage, isStreaming: false, content: "" } // Clear content on error
              : msg,
          ),
        );

        return { error: errorMessage };
      } finally {
        // 10. Clean up
        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
        }
        setIsAiStreaming(false);
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      setLocalMessages,
      setIsAiStreaming,
      setError,
      addDbMessage,
      abortControllerRef,
    ],
  );

  return {
    performAiStream,
    performImageGeneration, // Return the new function
  };
}
