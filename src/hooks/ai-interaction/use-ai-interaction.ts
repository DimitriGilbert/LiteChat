// src/hooks/ai-interaction/use-ai-interaction.ts
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  streamText,
  StreamTextResult,
  ToolCallPart,
  ToolResultPart,
  TextStreamPart,
} from "ai";
import { nanoid } from "nanoid";

// Type Imports
import {
  PerformAiStreamParams,
  PerformImageGenerationParams,
  PerformImageGenerationResult,
  UseAiInteractionReturn,
  UseAiInteractionProps,
} from "./types";
import {
  DbMessage,
  Message,
  MessageContent,
  TextPart as LocalTextPart,
  ToolCallPart as LocalToolCallPartType,
  ToolResultPart as LocalToolResultPartType,
} from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";

// Helper Imports
import { validateAiParameters } from "./error-handler";
import {
  getStreamHeaders,
  createAssistantPlaceholder,
  finalizeStreamedMessageUI,
} from "./stream-handler";
import { mapToCoreMessages } from "./message-mapper";
import { createSdkTools } from "./tool-handler";
import { performImageGeneration as performImageGenerationFunc } from "./image-generator";
import { throttle } from "@/lib/throttle";
import { useCoreChatStore } from "@/store/core-chat.store"; // Import store

export function useAiInteraction({
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  streamingRefreshRateMs,
  addMessage,
  updateMessage,
  setIsAiStreaming,
  setError,
  addDbMessage,
  // abortControllerRef removed from props
  getContextSnapshotForMod,
  bulkAddMessages,
}: Omit<UseAiInteractionProps, "abortControllerRef">): UseAiInteractionReturn {
  // Get the action from the store
  const setAbortController = useCoreChatStore(
    (state) => state.setAbortController,
  );
  const contentRef = useRef<string>("");
  const placeholderRef = useRef<{
    id: string;
    timestamp: Date;
    providerId: string;
    modelId: string;
    conversationId: string;
  } | null>(null);

  const sdkTools = useMemo(() => {
    const modToolsFromContext = new Map(); // Placeholder for actual mod tools
    return createSdkTools(modToolsFromContext, getContextSnapshotForMod);
  }, [getContextSnapshotForMod]);

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
      const currentSelectedModel = selectedModel;
      const currentSelectedProvider = selectedProvider;
      const apiKey = getApiKeyForProvider();

      const validationError = validateAiParameters(
        conversationIdToUse,
        currentSelectedModel,
        currentSelectedProvider,
        apiKey,
        setError,
      );
      if (validationError) throw validationError;

      if (!currentSelectedModel?.instance) {
        const errorMsg = "Selected model instance is invalid or not loaded.";
        setError(errorMsg);
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const hasTools = Object.keys(sdkTools).length > 0;
      if (hasTools && !currentSelectedModel?.supportsToolCalling) {
        const toolError = new Error(
          `Selected model "${currentSelectedModel?.name}" does not support tool calling, but tools are registered.`,
        );
        setError(toolError.message);
        toast.error(toolError.message);
        throw toolError;
      }

      setIsAiStreaming(true);
      setError(null);
      contentRef.current = "";
      placeholderRef.current = null;

      // Create and set the controller in the store
      const currentAbortController = new AbortController();
      setAbortController(currentAbortController);

      const {
        id: assistantMessageId,
        message: assistantPlaceholder,
        timestamp: assistantTimestamp,
      } = createAssistantPlaceholder(
        conversationIdToUse,
        currentSelectedProvider!.id,
        currentSelectedModel.id,
      );
      placeholderRef.current = {
        id: assistantMessageId,
        timestamp: assistantTimestamp,
        providerId: currentSelectedProvider!.id,
        modelId: currentSelectedModel.id,
        conversationId: conversationIdToUse,
      };
      addMessage(assistantPlaceholder);

      const { throttled: throttledUpdate, cancel: cancelThrottledUpdate } =
        throttle(() => {
          const currentAccumulatedContent = contentRef.current;
          updateMessage(assistantMessageId, {
            streamedContent: currentAccumulatedContent,
            isStreaming: true,
          });
        }, streamingRefreshRateMs);

      const messagesForApi = mapToCoreMessages(
        messagesToSend as unknown as Message[],
      );
      const headers = getStreamHeaders(currentSelectedProvider!.type, apiKey);
      const startTime = Date.now();
      let streamError: Error | null = null;
      let finalUsage:
        | { promptTokens: number; completionTokens: number }
        | undefined = undefined;
      let finalFinishReason: string | undefined = undefined;
      const finalToolCalls: ToolCallPart[] = [];

      try {
        modEvents.emit(ModEvent.RESPONSE_START, {
          conversationId: conversationIdToUse,
        });

        const result: StreamTextResult<any, any> = await streamText({
          model: currentSelectedModel.instance,
          messages: messagesForApi,
          system: systemPromptToUse ?? undefined,
          tools: hasTools ? sdkTools : undefined,
          toolChoice: hasTools ? "auto" : undefined,
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined,
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
          headers,
          abortSignal: currentAbortController.signal, // Use the controller from store
        });

        for await (const part of result.fullStream as AsyncIterable<
          TextStreamPart<any>
        >) {
          if (currentAbortController.signal.aborted) {
            // Error is set by stopStreamingCore, no need to set streamError here
            break;
          }

          switch (part.type) {
            case "text-delta":
              contentRef.current += part.textDelta;
              modEvents.emit(ModEvent.RESPONSE_CHUNK, {
                chunk: part.textDelta,
                conversationId: conversationIdToUse,
              });
              throttledUpdate();
              break;
            case "tool-call":
              finalToolCalls.push(part);
              toast.info(`Calling tool: ${part.toolName}...`);
              break;
            case "error":
              streamError =
                part.error instanceof Error
                  ? part.error
                  : new Error(String(part.error));
              setError(
                `Streaming error: ${streamError ? streamError.message : "Unknown error"}`,
              );
              toast.error(
                `Streaming error: ${streamError ? streamError.message : "Unknown error"}`,
              );
              break;
            case "finish":
              finalUsage = part.usage;
              finalFinishReason = part.finishReason;
              break;
          }
        }

        if (!streamError && hasTools) {
          const toolResults: ToolResultPart[] = await result.toolResults;
          if (toolResults && toolResults.length > 0) {
            const toolResultMessages: Message[] = [];
            const toolResultDbMessages: DbMessage[] = [];
            const now = new Date();

            toolResults.forEach((toolResult: ToolResultPart) => {
              const toolResultContentPart: LocalToolResultPartType = {
                type: "tool-result",
                toolCallId: toolResult.toolCallId,
                toolName: toolResult.toolName,
                result: toolResult.result,
                isError: false,
              };
              const toolResultMessage: Message = {
                id: nanoid(),
                role: "tool",
                content: [toolResultContentPart],
                tool_call_id: toolResult.toolCallId,
                createdAt: now,
                conversationId: conversationIdToUse,
                providerId: currentSelectedProvider?.id,
                modelId: currentSelectedModel?.id,
                isStreaming: false,
                error: null,
              };
              toolResultMessages.push(toolResultMessage);
              toolResultDbMessages.push({
                id: toolResultMessage.id,
                conversationId: conversationIdToUse,
                role: "tool",
                content: toolResultMessage.content as MessageContent,
                createdAt: toolResultMessage.createdAt ?? new Date(),
                tool_call_id: toolResultMessage.tool_call_id,
              });
            });

            toolResultMessages.forEach(addMessage);

            try {
              await bulkAddMessages(toolResultDbMessages);
              console.log(
                "Saved tool result messages to DB:",
                toolResultDbMessages.map((m) => m.id),
              );
            } catch (dbErr) {
              console.error("Failed to save tool result messages:", dbErr);
              toast.error("Failed to save tool results.");
              const errorMsg = `DB save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown"}`;
              toolResultMessages.forEach((trm) =>
                updateMessage(trm.id, { error: errorMsg }),
              );
            }
          }
        }

        if (!finalUsage) finalUsage = await result.usage;
        if (!finalFinishReason) finalFinishReason = await result.finishReason;
      } catch (err: unknown) {
        if ((err as any)?.name === "AbortError") {
          // Check if the abort came from our controller (button press)
          if (!currentAbortController.signal.aborted) {
            // Abort likely came from outside (e.g., network timeout)
            streamError = new Error("Stream aborted.");
            console.log("Stream aborted (external source).");
          } else {
            // Abort came from button press, handled by store action
            console.log("Stream aborted by user action (handled by store).");
          }
        } else {
          streamError = err instanceof Error ? err : new Error(String(err));
          console.error("Error during streamText processing:", streamError);
          setError(`Error: ${streamError.message}`);
          toast.error(`Error: ${streamError.message}`);
        }
      } finally {
        console.log("Stream finally block executing.");
        // Clear the controller from the store only if it's the one we set
        if (
          useCoreChatStore.getState().abortController === currentAbortController
        ) {
          setAbortController(null);
        }

        cancelThrottledUpdate();

        finalizeStreamedMessageUI(
          assistantMessageId,
          contentRef.current,
          streamError,
          finalUsage,
          startTime,
          updateMessage,
        );

        const placeholderData = placeholderRef.current;
        if (placeholderData && !streamError) {
          console.log(
            `Attempting to save final message with ID: ${placeholderData.id}`,
          );

          let finalDbContent: MessageContent;
          if (finalToolCalls.length > 0) {
            const parts: Array<LocalTextPart | LocalToolCallPartType> = [];
            if (contentRef.current) {
              parts.push({ type: "text", text: contentRef.current });
            }
            finalToolCalls.forEach((tc) => {
              parts.push({
                type: "tool-call",
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              });
            });
            finalDbContent = parts.length > 0 ? parts : "";
          } else {
            finalDbContent = contentRef.current;
          }

          const dbMessageToSave: DbMessage = {
            id: placeholderData.id,
            conversationId: placeholderData.conversationId,
            role: "assistant",
            content: finalDbContent,
            createdAt: placeholderData.timestamp,
            tool_calls:
              finalToolCalls.length > 0
                ? finalToolCalls.map((tc) => ({
                    id: tc.toolCallId,
                    type: "function",
                    function: {
                      name: tc.toolName,
                      arguments: JSON.stringify(tc.args),
                    },
                  }))
                : undefined,
            tokensInput: finalUsage?.promptTokens,
            tokensOutput: finalUsage?.completionTokens,
            providerId: placeholderData.providerId,
            modelId: placeholderData.modelId,
          };

          try {
            await addDbMessage(dbMessageToSave);
            console.log(
              "Saved final assistant message to DB:",
              placeholderData.id,
            );
          } catch (dbErr: unknown) {
            const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
            console.error("Failed to save final assistant message:", dbErr);
            setError(`Error saving response: ${dbErrorMessage}`);
            toast.error(`Failed to save response: ${dbErrorMessage}`);
            updateMessage(placeholderData.id, { error: dbErrorMessage });
          }
        } else if (streamError) {
          console.log(
            `Skipping DB save for assistant message (ID: ${placeholderData?.id || "unknown"}) due to stream error: ${streamError?.message || "Unknown stream error"}`,
          );
        } else {
          console.error(
            `[Finally Block] Critical error: Placeholder data ref was null. Cannot save message. Stream Error: ${streamError || "None"}`,
          );
          setError("Internal error: Failed to finalize message for saving.");
          toast.error("Internal error: Failed to finalize message for saving.");
        }
        placeholderRef.current = null;
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      streamingRefreshRateMs,
      addMessage,
      updateMessage,
      setIsAiStreaming,
      setError,
      addDbMessage,
      getContextSnapshotForMod,
      bulkAddMessages,
      sdkTools,
      setAbortController, // Added store action dependency
    ],
  );

  const performImageGenerationCallback = useCallback(
    async (
      params: Omit<
        PerformImageGenerationParams,
        | "selectedModel"
        | "selectedProvider"
        | "getApiKeyForProvider"
        | "addMessage"
        | "updateMessage"
        | "setIsAiStreaming"
        | "setError"
        | "addDbMessage"
        | "abortControllerRef" // Removed from Omit
      >,
    ): Promise<PerformImageGenerationResult> => {
      const currentSelectedModel = selectedModel;
      const currentSelectedProvider = selectedProvider;
      const apiKeyGetter = getApiKeyForProvider;

      const imageAbortController = new AbortController();
      const abortControllerRefForImage = { current: imageAbortController };

      // TODO: Integrate image generation cancellation with the global stop button/store controller if desired.

      try {
        const result = await performImageGenerationFunc({
          ...params,
          selectedModel: currentSelectedModel,
          selectedProvider: currentSelectedProvider,
          getApiKeyForProvider: apiKeyGetter,
          addMessage: addMessage,
          updateMessage: updateMessage,
          setIsAiStreaming: setIsAiStreaming,
          setError: setError,
          addDbMessage: addDbMessage,
          abortControllerRef: abortControllerRefForImage, // Pass the local ref
        });
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown image generation error";
        setError(message);
        return { error: message };
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      addMessage,
      updateMessage,
      setIsAiStreaming,
      setError,
      addDbMessage,
      // No dependency on the store's abortController here yet
    ],
  );

  return {
    performAiStream,
    performImageGeneration: performImageGenerationCallback,
  };
}
