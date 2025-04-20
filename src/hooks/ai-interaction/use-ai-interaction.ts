// src/hooks/ai-interaction/use-ai-interaction.ts
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  streamText,
  StreamTextResult,
  ToolCallPart,
  ToolResultPart, // Import ToolResultPart from 'ai'
} from "ai";
import { useModContext } from "@/context/mod-context";

import {
  UseAiInteractionProps,
  PerformAiStreamParams,
  PerformImageGenerationParams,
  PerformImageGenerationResult,
  UseAiInteractionReturn,
} from "./types";

// Import specific part types and MessageContent
import {
  DbMessage,
  Message,
  MessageContent,
  TextPart, // Import TextPart
  ToolCallPart as LocalToolCallPartType, // Alias to avoid name clash
  ToolResultPart as LocalToolResultPartType, // Alias to avoid name clash
} from "@/lib/types";

import { validateAiParameters } from "./error-handler";
import {
  getStreamHeaders,
  createAssistantPlaceholder,
  createStreamUpdater,
  finalizeStreamedMessageUI, // Renamed import
} from "./stream-handler"; // Import necessary functions
import { mapToCoreMessages } from "./message-mapper";
import { createSdkTools } from "./tool-handler";
import { performImageGeneration } from "./image-generator";
import { modEvents, ModEvent } from "@/mods/events"; // Import mod events
import { nanoid } from "nanoid"; // Import nanoid

/**
 * Hook for handling AI interactions with streaming, image generation, and tool calling capabilities
 */
export function useAiInteraction({
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  streamingThrottleRate, // Added throttle rate
  setLocalMessages,
  setIsAiStreaming,
  setError,
  addDbMessage,
  abortControllerRef,
  getContextSnapshotForMod,
  bulkAddMessages, // Keep bulkAddMessages prop
}: UseAiInteractionProps): UseAiInteractionReturn {
  const { modTools } = useModContext();
  const contentRef = useRef<string>(""); // Ref to accumulate streamed content
  const placeholderRef = useRef<{
    id: string;
    timestamp: Date;
    providerId: string;
    modelId: string;
    conversationId: string;
  } | null>(null); // Ref to store placeholder details

  // Create SDK-compatible tools from registered mod tools
  const sdkTools = useMemo(
    () => createSdkTools(modTools, getContextSnapshotForMod),
    [modTools, getContextSnapshotForMod],
  );

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
      const apiKey = getApiKeyForProvider();
      const validationError = validateAiParameters(
        conversationIdToUse,
        selectedModel,
        selectedProvider,
        apiKey,
        setError,
      );
      if (validationError) throw validationError;

      const hasTools = Object.keys(sdkTools).length > 0;
      if (hasTools && !selectedModel?.supportsToolCalling) {
        const toolError = new Error(
          `Selected model "${selectedModel?.name}" does not support tool calling, but tools are registered.`,
        );
        setError(toolError.message);
        toast.error(toolError.message);
        throw toolError;
      }

      setIsAiStreaming(true);
      setError(null);
      contentRef.current = ""; // Reset accumulated content
      placeholderRef.current = null; // Reset placeholder ref

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      // Create placeholder message
      const {
        id: assistantMessageId,
        message: assistantPlaceholder,
        timestamp: assistantTimestamp,
      } = createAssistantPlaceholder(
        conversationIdToUse,
        selectedProvider!.id,
        selectedModel!.id,
      );
      // Store placeholder details in ref
      placeholderRef.current = {
        id: assistantMessageId,
        timestamp: assistantTimestamp,
        providerId: selectedProvider!.id,
        modelId: selectedModel!.id,
        conversationId: conversationIdToUse,
      };
      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      // Create throttled UI updater
      const throttledUpdate = createStreamUpdater(
        assistantMessageId,
        contentRef,
        setLocalMessages,
        streamingThrottleRate,
      );

      const messagesForApi = mapToCoreMessages(
        messagesToSend as unknown as Message[],
      );
      const headers = getStreamHeaders(selectedProvider!.type, apiKey);
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

        // Provide the correct type arguments for StreamTextResult (TOOLS, PARTIAL_OUTPUT = never)
        const result: StreamTextResult<typeof sdkTools, never> =
          await streamText({
            model: selectedModel!.instance,
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
            // Removed onFinish callback here
          });

        // Process the stream parts that ARE yielded during iteration
        for await (const part of result.fullStream) {
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
              // Collect tool calls as they appear in the stream
              finalToolCalls.push(part);
              toast.info(`Calling tool: ${part.toolName}...`);
              break;
            // --- REMOVED 'tool-result' case ---
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
            case "finish": // Handle finish event if provided by SDK stream part
              finalUsage = part.usage;
              finalFinishReason = part.finishReason;
              break;
            // Other cases like 'step-start', 'step-finish' can be handled if needed
          }
        } // End of for await loop

        // --- Process Tool Results AFTER the stream loop ---
        if (!streamError && hasTools) {
          // Await the results promise
          const toolResults: ToolResultPart[] = await result.toolResults;
          if (toolResults && toolResults.length > 0) {
            const toolResultMessages: Message[] = [];
            const toolResultDbMessages: DbMessage[] = [];
            const now = new Date();

            // Explicitly type toolResult here
            toolResults.forEach((toolResult: ToolResultPart) => {
              const toolResultContentPart: LocalToolResultPartType = {
                type: "tool-result",
                toolCallId: toolResult.toolCallId, // No TS error
                toolName: toolResult.toolName, // No TS error
                result: toolResult.result, // No TS error
                isError: false, // Assuming success if no error thrown by SDK
              };
              const toolResultMessage: Message = {
                id: nanoid(),
                role: "tool",
                content: [toolResultContentPart],
                tool_call_id: toolResult.toolCallId, // No TS error
                createdAt: now,
                conversationId: conversationIdToUse,
                providerId: selectedProvider?.id,
                modelId: selectedModel?.id,
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

            // Update UI with all tool results at once
            setLocalMessages((prev) => [...prev, ...toolResultMessages]);

            // Save tool results to DB
            try {
              await bulkAddMessages(toolResultDbMessages);
              console.log(
                "Saved tool result messages to DB:",
                toolResultDbMessages.map((m) => m.id),
              );
            } catch (dbErr) {
              console.error("Failed to save tool result messages:", dbErr);
              toast.error("Failed to save tool results.");
              // Optionally update UI messages with error
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

        // Get final usage/reason if not already captured by 'finish' part
        if (!finalUsage) finalUsage = await result.usage;
        if (!finalFinishReason) finalFinishReason = await result.finishReason;
      } catch (err: unknown) {
        // Handle errors from streamText or result promises
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
        setIsAiStreaming(false);

        // Finalize the UI state for the streaming message
        finalizeStreamedMessageUI(
          assistantMessageId, // Use the ID stored at the start
          contentRef.current, // Use accumulated content
          streamError,
          finalUsage,
          startTime,
          setLocalMessages,
        );

        // Construct the final message object for DB saving *directly*
        // using the known ID and accumulated content.
        const placeholderData = placeholderRef.current;
        if (placeholderData && !streamError) {
          console.log(
            `Attempting to save final message with ID: ${placeholderData.id}`,
          );

          let finalDbContent: MessageContent;
          if (finalToolCalls.length > 0) {
            const parts: Array<TextPart | LocalToolCallPartType> = [];
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
            createdAt: placeholderData.timestamp, // Use original timestamp
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
            // Update the UI message with the DB error (still needed)
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
            `Skipping DB save for assistant message (ID: ${placeholderData?.id || "unknown"}) due to stream error:`,
            streamError.message,
          );
        } else {
          // This case means placeholderRef.current was null, which shouldn't happen
          console.error(
            // @ts-expect-error If*ing do not care if streamError is Never XD
            `[Finally Block] Critical error: Placeholder data ref was null. Cannot save message. Stream Error: ${streamError?.message || "None"}`,
          );
          setError("Internal error: Failed to finalize message for saving.");
          toast.error("Internal error: Failed to finalize message for saving.");
        }
        placeholderRef.current = null; // Clear the ref after use
      } // End finally
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      setLocalMessages,
      setIsAiStreaming,
      setError,
      abortControllerRef,
      sdkTools,
      bulkAddMessages, // Keep for saving tool results
      addDbMessage, // Use for saving final assistant message
      streamingThrottleRate,
    ],
  );

  // Image generation remains the same
  const performImageGenerationCallback = useCallback(
    async (
      params: PerformImageGenerationParams,
    ): Promise<PerformImageGenerationResult> => {
      return performImageGeneration({
        ...params,
        selectedModel,
        selectedProvider,
        getApiKeyForProvider,
        setLocalMessages,
        setIsAiStreaming,
        setError,
        addDbMessage,
        abortControllerRef,
      });
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
    performImageGeneration: performImageGenerationCallback,
  };
}
