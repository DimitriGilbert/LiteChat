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
  UseAiInteractionProps, // Import the new props interface
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
  createStreamUpdater,
  finalizeStreamedMessageUI,
} from "./stream-handler";
import { mapToCoreMessages } from "./message-mapper";
import { createSdkTools } from "./tool-handler";
import { performImageGeneration as performImageGenerationFunc } from "./image-generator"; // Rename imported function

/**
 * Hook for handling AI interactions with streaming, image generation, and tool calling capabilities.
 * Receives necessary state and actions as arguments.
 */
export function useAiInteraction({
  // Destructure props defined in UseAiInteractionProps
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  streamingThrottleRate,
  setLocalMessages,
  setIsAiStreaming, // This is the function passed from the store action
  setError,
  addDbMessage,
  abortControllerRef,
  getContextSnapshotForMod,
  bulkAddMessages,
}: UseAiInteractionProps): UseAiInteractionReturn {
  // --- Refs ---
  const contentRef = useRef<string>("");
  const placeholderRef = useRef<{
    id: string;
    timestamp: Date;
    providerId: string;
    modelId: string;
    conversationId: string;
  } | null>(null);

  // --- SDK Tools ---
  const sdkTools = useMemo(() => {
    // Placeholder: Access modTools differently or pass them as a prop
    const modToolsFromContext = new Map(); // Replace with actual access method
    return createSdkTools(modToolsFromContext, getContextSnapshotForMod);
  }, [getContextSnapshotForMod /*, modTools */]); // Add modTools dependency if passed

  // --- AI Stream Logic ---
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

      // Directly use the passed setIsAiStreaming function
      setIsAiStreaming(true);
      setError(null);
      contentRef.current = "";
      placeholderRef.current = null;

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

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
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      const throttledUpdate = createStreamUpdater(
        assistantMessageId,
        contentRef,
        setLocalMessages,
        streamingThrottleRate,
      );

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
          abortSignal: currentAbortController.signal,
        });

        for await (const part of result.fullStream as AsyncIterable<
          TextStreamPart<any>
        >) {
          if (currentAbortController.signal.aborted) {
            streamError = new Error("Stream aborted by user.");
            toast.info("AI response stopped.");
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

            setLocalMessages((prev) => [...prev, ...toolResultMessages]);

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
              setLocalMessages((prev) =>
                prev.map((msg) =>
                  toolResultMessages.find((trm) => trm.id === msg.id)
                    ? { ...msg, error: errorMsg }
                    : msg,
                ),
              );
            }
          }
        }

        if (!finalUsage) finalUsage = await result.usage;
        if (!finalFinishReason) finalFinishReason = await result.finishReason;
      } catch (err: unknown) {
        if ((err as any)?.name === "AbortError") {
          streamError = new Error("Stream aborted by user.");
          console.log("Stream aborted.");
        } else {
          streamError = err instanceof Error ? err : new Error(String(err));
          console.error("Error during streamText processing:", streamError);
          if (
            streamError &&
            !streamError.message.startsWith("Streaming error:")
          ) {
            setError(`Error: ${streamError.message}`);
            toast.error(`Error: ${streamError.message}`);
          }
        }
      } finally {
        console.log("Stream finally block executing.");
        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
        }
        // Directly use the passed setIsAiStreaming function
        setIsAiStreaming(false);

        finalizeStreamedMessageUI(
          assistantMessageId,
          contentRef.current,
          streamError,
          finalUsage,
          startTime,
          setLocalMessages,
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
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === placeholderData.id
                  ? { ...msg, error: dbErrorMessage }
                  : msg,
              ),
            );
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
      streamingThrottleRate,
      setLocalMessages,
      setIsAiStreaming,
      setError,
      addDbMessage,
      abortControllerRef,
      // getContextSnapshotForMod,
      bulkAddMessages,
      sdkTools,
    ],
  );

  // --- Image Generation ---
  const performImageGenerationCallback = useCallback(
    async (
      params: Omit<
        PerformImageGenerationParams,
        | "selectedModel"
        | "selectedProvider"
        | "getApiKeyForProvider"
        | "setLocalMessages"
        | "setIsAiStreaming"
        | "setError"
        | "addDbMessage"
        | "abortControllerRef"
      >,
    ): Promise<PerformImageGenerationResult> => {
      const currentSelectedModel = selectedModel;
      const currentSelectedProvider = selectedProvider;
      const apiKeyGetter = getApiKeyForProvider;

      return performImageGenerationFunc({
        ...params,
        selectedModel: currentSelectedModel,
        selectedProvider: currentSelectedProvider,
        getApiKeyForProvider: apiKeyGetter,
        setLocalMessages: setLocalMessages,
        setIsAiStreaming: setIsAiStreaming, // Pass the function directly
        setError: setError,
        addDbMessage: addDbMessage,
        abortControllerRef,
      });
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      setLocalMessages,
      setIsAiStreaming, // Add as dependency
      setError,
      addDbMessage,
      abortControllerRef,
    ],
  );

  return {
    performAiStream,
    performImageGeneration: performImageGenerationCallback,
  };
}
