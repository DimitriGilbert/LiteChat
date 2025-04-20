// src/hooks/ai-interaction/use-ai-interaction.ts
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { ModEvent, modEvents } from "@/mods/events";
import {
  Message,
  CoreMessage,
  ImagePart as LocalImagePart, // Alias local ImagePart
  DbMessage,
  MessageContent,
  ToolCallPart as LocalToolCallPart, // Alias local ToolCallPart
  ToolResultPart as LocalToolResultPart, // Alias local ToolResultPart
  TextPart as LocalTextPart, // Alias local TextPart
  Role,
} from "@/lib/types";
// Import necessary types from 'ai'
import {
  experimental_generateImage as generateImage,
  streamText,
  tool,
  Tool as VercelTool,
  ToolExecutionOptions,
  ImageModelCallWarning,
  StreamTextResult,
  ResponseMessage,
  StepResult,
  FinishReason,
  LanguageModelUsage,
  ProviderMetadata,
  TextPart, // Use SDK TextPart
  ImagePart, // Use SDK ImagePart
  ToolCallPart, // Use SDK ToolCallPart
  ToolResultPart, // Use SDK ToolResultPart
} from "ai";
import { nanoid } from "nanoid";
import { useModContext, RegisteredToolEntry } from "@/context/mod-context";

import {
  UseAiInteractionProps,
  PerformAiStreamParams,
  PerformImageGenerationParams,
  PerformImageGenerationResult,
  UseAiInteractionReturn,
} from "./types";

import { validateAiParameters } from "./error-handler";
import { getStreamHeaders } from "./stream-handler";

/**
 * Hook for handling AI interactions with streaming, image generation, and tool calling capabilities
 */
export function useAiInteraction({
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  setLocalMessages,
  setIsAiStreaming,
  setError,
  addDbMessage,
  abortControllerRef,
  getContextSnapshotForMod,
  bulkAddMessages,
}: UseAiInteractionProps): UseAiInteractionReturn {
  const { modTools } = useModContext();
  const streamingMessageIdRef = useRef<string | null>(null);

  const sdkTools = useMemo(() => {
    const toolsForSdk: Record<string, VercelTool<any, any>> = {};
    modTools.forEach(
      (registeredTool: RegisteredToolEntry, toolName: string) => {
        if (!registeredTool.definition.parameters) {
          console.error(
            `Tool "${toolName}" is missing parameters definition. Skipping.`,
          );
          return;
        }
        const originalExecuteFn =
          registeredTool.implementation ?? registeredTool.definition.execute;
        if (!originalExecuteFn) {
          console.error(
            `Tool "${toolName}" is missing an implementation or execute function. Skipping.`,
          );
          return;
        }
        toolsForSdk[toolName] = tool({
          description: registeredTool.definition.description,
          parameters: registeredTool.definition.parameters,
          execute: async (args: any, options: ToolExecutionOptions) => {
            const contextSnapshot = getContextSnapshotForMod();
            try {
              const result = await originalExecuteFn(args, contextSnapshot);
              return result;
            } catch (error) {
              console.error(`Error executing tool "${toolName}":`, error);
              throw error;
            }
          },
        });
      },
    );
    return toolsForSdk;
  }, [modTools, getContextSnapshotForMod]);

  const mapToCoreMessages = useCallback(
    (localMessages: Message[]): CoreMessage[] => {
      return localMessages
        .filter((m) => m.role !== "system")
        .map((m): CoreMessage | null => {
          try {
            if (m.role === "user") {
              let coreContent: CoreMessage["content"];
              if (typeof m.content === "string") {
                coreContent = m.content;
              } else if (Array.isArray(m.content)) {
                coreContent = m.content
                  .map((part) => {
                    if (part.type === "text") return part as TextPart;
                    if (part.type === "image") {
                      const base64Data = part.image.startsWith("data:")
                        ? part.image.split(",")[1]
                        : part.image;
                      if (!base64Data) return null;
                      return {
                        type: "image" as const,
                        image: base64Data,
                        mimeType: part.mediaType,
                      } as ImagePart;
                    }
                    return null;
                  })
                  .filter((p): p is TextPart | ImagePart => p !== null);
              } else {
                coreContent = "";
              }
              return { role: "user", content: coreContent };
            } else if (m.role === "assistant") {
              const contentParts: Array<TextPart | ToolCallPart> = [];
              if (typeof m.content === "string") {
                contentParts.push({ type: "text", text: m.content });
              } else if (Array.isArray(m.content)) {
                m.content.forEach((part) => {
                  if (part.type === "text") contentParts.push(part as TextPart);
                  else if (part.type === "tool-call")
                    contentParts.push({
                      type: "tool-call",
                      toolCallId: part.toolCallId,
                      toolName: part.toolName,
                      args: part.args,
                    } as ToolCallPart);
                });
              }
              if (
                m.tool_calls &&
                !contentParts.some((p) => p.type === "tool-call")
              ) {
                m.tool_calls.forEach((tc) => {
                  try {
                    contentParts.push({
                      type: "tool-call",
                      toolCallId: tc.id,
                      toolName: tc.function.name,
                      args: JSON.parse(tc.function.arguments || "{}"),
                    } as ToolCallPart);
                  } catch (e) {
                    console.error(
                      "Failed to parse tool call arguments:",
                      tc.function.arguments,
                      e,
                    );
                  }
                });
              }
              return { role: "assistant", content: contentParts };
            } else if (m.role === "tool") {
              const toolResultPart = Array.isArray(m.content)
                ? (m.content.find((p) => p.type === "tool-result") as
                    | LocalToolResultPart
                    | undefined)
                : undefined;
              if (!toolResultPart || !m.tool_call_id) return null;
              return {
                role: "tool",
                content: [
                  {
                    type: "tool-result",
                    toolCallId: m.tool_call_id,
                    toolName: toolResultPart.toolName,
                    result: toolResultPart.result,
                    isError: toolResultPart.isError,
                  } as ToolResultPart,
                ],
              };
            }
            return null;
          } catch (error) {
            console.error("Error mapping message to CoreMessage:", m, error);
            return null;
          }
        })
        .filter((m): m is CoreMessage => m !== null);
    },
    [],
  ); // No dependencies needed for this pure function

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
      streamingMessageIdRef.current = null; // Reset ref

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      const messagesForApi: CoreMessage[] = mapToCoreMessages(messagesToSend);
      const headers = getStreamHeaders(selectedProvider!.type, apiKey);

      try {
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

            onFinish: async (event) => {
              console.log("streamText onFinish event:", event);
              const lastStep = event.steps[event.steps.length - 1];
              if (!lastStep) {
                console.error("onFinish: No last step found.");
                setError("Stream finish error: No final step data.");
                toast.error("Error processing stream finish.");
                if (streamingMessageIdRef.current) {
                  const finalId = streamingMessageIdRef.current;
                  setLocalMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === finalId
                        ? {
                            ...msg,
                            isStreaming: false,
                            error: "Stream finish error",
                          }
                        : msg,
                    ),
                  );
                }
                return;
              }

              const finalMessagesFromStep: ResponseMessage[] =
                lastStep.response?.messages ?? [];
              console.log(
                "onFinish: Final messages from last step:",
                finalMessagesFromStep,
              );

              if (finalMessagesFromStep.length === 0) {
                console.warn("onFinish: No messages in last step response.");
                if (streamingMessageIdRef.current) {
                  const finalId = streamingMessageIdRef.current;
                  setLocalMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === finalId
                        ? {
                            ...msg,
                            isStreaming: false,
                            tokensInput: event.usage.promptTokens,
                            tokensOutput: event.usage.completionTokens,
                          }
                        : msg,
                    ),
                  );
                }
                return;
              }

              const now = new Date();
              const messagesToSave: DbMessage[] = [];
              const finalMessageObjects = new Map<string, Message>(); // Store final Message objects for state update

              finalMessagesFromStep.forEach((responseMsg) => {
                let dbContent: MessageContent;
                if (typeof responseMsg.content === "string")
                  dbContent = responseMsg.content;
                else if (Array.isArray(responseMsg.content)) {
                  dbContent = responseMsg.content
                    .map((part) => {
                      if (part.type === "text") return part as LocalTextPart;
                      if (part.type === "tool-call")
                        return part as LocalToolCallPart;
                      if (part.type === "tool-result")
                        return part as LocalToolResultPart;
                      return null;
                    })
                    .filter((p) => p !== null) as MessageContent;
                } else dbContent = "";

                const baseDbMessage = {
                  id: responseMsg.id,
                  conversationId: conversationIdToUse,
                  role: responseMsg.role as Role,
                  content: dbContent,
                  createdAt: now,
                  providerId: selectedProvider?.id,
                  modelId: selectedModel?.id,
                  tokensInput:
                    responseMsg.role === "assistant"
                      ? event.usage.promptTokens
                      : undefined,
                  tokensOutput:
                    responseMsg.role === "assistant"
                      ? event.usage.completionTokens
                      : undefined,
                };

                let tool_calls: Message["tool_calls"] | undefined = undefined;
                let tool_call_id: string | undefined = undefined;

                if (responseMsg.role === "assistant") {
                  tool_calls = Array.isArray(responseMsg.content)
                    ? responseMsg.content
                        .filter(
                          (part): part is ToolCallPart =>
                            part.type === "tool-call",
                        )
                        .map((tc) => ({
                          id: tc.toolCallId,
                          type: "function" as const,
                          function: {
                            name: tc.toolName,
                            arguments:
                              typeof tc.args === "string"
                                ? tc.args
                                : JSON.stringify(tc.args),
                          },
                        }))
                    : undefined;
                  messagesToSave.push({
                    ...baseDbMessage,
                    role: "assistant",
                    tool_calls,
                  });
                } else if (responseMsg.role === "tool") {
                  const toolResultPart = Array.isArray(responseMsg.content)
                    ? responseMsg.content.find(
                        (part): part is ToolResultPart =>
                          part.type === "tool-result",
                      )
                    : undefined;
                  tool_call_id = toolResultPart?.toolCallId;
                  messagesToSave.push({
                    ...baseDbMessage,
                    role: "tool",
                    tool_call_id,
                  });
                }

                // Store the final Message object shape for UI update
                finalMessageObjects.set(responseMsg.id, {
                  ...baseDbMessage, // Spread the common fields
                  tool_calls, // Add specific fields
                  tool_call_id,
                  isStreaming: false, // Final state
                  error: null,
                });
              });

              if (messagesToSave.length > 0) {
                console.log(
                  "onFinish: Attempting to save messages to DB:",
                  messagesToSave,
                );
                try {
                  await bulkAddMessages(messagesToSave);
                  console.log(
                    "onFinish: Successfully saved messages to DB:",
                    messagesToSave.map((m) => m.id),
                  );

                  // --- Refined State Update ---
                  setLocalMessages((prevLocalMessages) => {
                    const streamingId = streamingMessageIdRef.current;
                    let streamingMessageReplaced = false;

                    // Map over previous messages, replacing based on final data
                    const updatedMessages = prevLocalMessages.map(
                      (localMsg) => {
                        if (finalMessageObjects.has(localMsg.id)) {
                          // Replace with the final version from DB save
                          const finalMsg = finalMessageObjects.get(
                            localMsg.id,
                          )!;
                          finalMessageObjects.delete(localMsg.id); // Remove from map
                          if (localMsg.id === streamingId) {
                            streamingMessageReplaced = true;
                          }
                          return finalMsg;
                        }
                        return localMsg; // Keep other messages
                      },
                    );

                    // If the streaming message wasn't in the final batch (error?), ensure it's finalized
                    if (streamingId && !streamingMessageReplaced) {
                      console.warn(
                        `[onFinish] Finalizing streaming message ${streamingId} which wasn't in final save batch.`,
                      );
                      const index = updatedMessages.findIndex(
                        (m) => m.id === streamingId,
                      );
                      if (index > -1) {
                        updatedMessages[index] = {
                          ...updatedMessages[index],
                          isStreaming: false,
                        };
                      }
                    }

                    // Add any remaining new messages (e.g., tool results not seen during stream)
                    finalMessageObjects.forEach((finalMsg) => {
                      updatedMessages.push(finalMsg);
                    });

                    return updatedMessages;
                  });
                  // --- End Refined State Update ---

                  const finalAssistantDbMsg = messagesToSave.find(
                    (m) => m.role === "assistant",
                  );
                  if (finalAssistantDbMsg) {
                    const finalAssistantMsgForEvent: Message =
                      finalMessageObjects.get(finalAssistantDbMsg.id) || {
                        // Fallback if somehow not in map
                        id: finalAssistantDbMsg.id,
                        role: "assistant",
                        content: finalAssistantDbMsg.content,
                        tool_calls: finalAssistantDbMsg.tool_calls,
                        createdAt: finalAssistantDbMsg.createdAt,
                        conversationId: finalAssistantDbMsg.conversationId,
                        providerId: finalAssistantDbMsg.providerId,
                        modelId: finalAssistantDbMsg.modelId,
                        tokensInput: finalAssistantDbMsg.tokensInput,
                        tokensOutput: finalAssistantDbMsg.tokensOutput,
                        isStreaming: false,
                      };
                    modEvents.emit(ModEvent.RESPONSE_DONE, {
                      message: finalAssistantMsgForEvent,
                    });
                  }
                } catch (dbErr: unknown) {
                  const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
                  console.error("onFinish: Failed to save messages:", dbErr);
                  setError(`Error saving response: ${dbErrorMessage}`);
                  toast.error(`Failed to save response: ${dbErrorMessage}`);
                  const savedIds = messagesToSave.map((m) => m.id);
                  setLocalMessages((prev) =>
                    prev.map((m) =>
                      savedIds.includes(m.id) ||
                      m.id === streamingMessageIdRef.current
                        ? { ...m, error: dbErrorMessage, isStreaming: false }
                        : m,
                    ),
                  );
                }
              } else {
                console.log(
                  "onFinish: No messages derived from SDK response to save.",
                );
                if (streamingMessageIdRef.current) {
                  const finalId = streamingMessageIdRef.current;
                  setLocalMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === finalId ? { ...msg, isStreaming: false } : msg,
                    ),
                  );
                }
              }
            }, // End of onFinish
          }); // End of streamText call

        // --- Stream Processing for UI Updates ---
        console.log("Starting stream processing loop...");
        for await (const part of result.fullStream) {
          if (currentAbortController.signal.aborted) {
            console.log("Stream aborted by user.");
            toast.info("AI response stopped.");
            break;
          }

          setLocalMessages((prevMessages) => {
            const currentStreamingId = streamingMessageIdRef.current;

            // Create Assistant Message ONLY on the very first relevant part
            if (
              !currentStreamingId &&
              (part.type === "text-delta" || part.type === "tool-call")
            ) {
              const newId = nanoid();
              streamingMessageIdRef.current = newId; // Set the ID for this stream
              let initialContent: MessageContent = "";
              let initialToolCalls: Message["tool_calls"] | undefined =
                undefined;

              if (part.type === "text-delta") initialContent = part.textDelta;
              else {
                // part.type === 'tool-call'
                const toolCallContentPart: LocalToolCallPart = {
                  type: "tool-call",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  args: part.args,
                };
                initialContent = [toolCallContentPart];
                initialToolCalls = [
                  {
                    id: part.toolCallId,
                    type: "function",
                    function: {
                      name: part.toolName,
                      arguments: JSON.stringify(part.args),
                    },
                  },
                ];
                toast.info(`Calling tool: ${part.toolName}...`);
              }
              const newMessage: Message = {
                id: newId,
                role: "assistant",
                content: initialContent,
                tool_calls: initialToolCalls,
                isStreaming: true,
                createdAt: new Date(),
                conversationId: conversationIdToUse,
                providerId: selectedProvider?.id,
                modelId: selectedModel?.id,
              };
              console.log(`[${part.type}] CREATED message ${newId}`);
              return [...prevMessages, newMessage];
            }

            // Update Existing Assistant Message if ID matches
            if (currentStreamingId) {
              let messageFoundAndUpdate = false;
              const updatedMessages = prevMessages.map((msg) => {
                if (msg.id === currentStreamingId) {
                  messageFoundAndUpdate = true;
                  let newContent = msg.content;
                  let newToolCalls = msg.tool_calls;
                  let changed = false;

                  if (part.type === "text-delta") {
                    let currentText = "";
                    let contentArray: Array<LocalTextPart | LocalToolCallPart> =
                      [];
                    if (typeof newContent === "string")
                      currentText = newContent;
                    else if (Array.isArray(newContent)) {
                      contentArray = newContent as Array<
                        LocalTextPart | LocalToolCallPart
                      >;
                      const lastPart = contentArray[contentArray.length - 1];
                      if (lastPart?.type === "text")
                        currentText = lastPart.text;
                    }

                    const updatedText = currentText + part.textDelta;

                    if (typeof newContent === "string")
                      newContent = updatedText;
                    else if (Array.isArray(newContent)) {
                      const lastPart = newContent[newContent.length - 1];
                      if (lastPart?.type === "text")
                        newContent = [
                          ...newContent.slice(0, -1),
                          { ...lastPart, text: updatedText },
                        ];
                      else
                        newContent = [
                          ...newContent,
                          { type: "text", text: part.textDelta },
                        ];
                    } else newContent = updatedText; // Fallback
                    changed = true;
                  } else if (part.type === "tool-call") {
                    const toolCallContentPart: LocalToolCallPart = {
                      type: "tool-call",
                      toolCallId: part.toolCallId,
                      toolName: part.toolName,
                      args: part.args,
                    };
                    const toolCallForState = {
                      id: part.toolCallId,
                      type: "function" as const,
                      function: {
                        name: part.toolName,
                        arguments: JSON.stringify(part.args),
                      },
                    };
                    const currentContentArray = Array.isArray(newContent)
                      ? newContent
                      : typeof newContent === "string" && newContent.length > 0
                        ? [{ type: "text" as const, text: newContent }]
                        : [];

                    if (
                      !currentContentArray.some(
                        (p) =>
                          p.type === "tool-call" &&
                          p.toolCallId === part.toolCallId,
                      )
                    ) {
                      newContent = [
                        ...currentContentArray,
                        toolCallContentPart,
                      ];
                      newToolCalls = [
                        ...(newToolCalls ?? []),
                        toolCallForState,
                      ];
                      toast.info(`Calling tool: ${part.toolName}...`);
                      changed = true;
                    }
                  }
                  // Only return new object if changed
                  return changed
                    ? {
                        ...msg,
                        content: newContent,
                        tool_calls: newToolCalls,
                        isStreaming: true,
                      }
                    : msg;
                }
                return msg;
              });
              // If the message was found and potentially updated, return the new array
              if (messageFoundAndUpdate) return updatedMessages;
            }

            // Handle Tool Result (Always creates a new message)
            if (part.type === "tool-result") {
              const toolResultContentPart: LocalToolResultPart = {
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                result: part.result,
                isError: (part as any).isError ?? false,
              };
              const toolResultMessage: Message = {
                id: nanoid(),
                role: "tool",
                content: [toolResultContentPart],
                tool_call_id: part.toolCallId,
                createdAt: new Date(),
                conversationId: conversationIdToUse,
              };
              console.log(
                `[tool-result] ADDED tool result message for ${part.toolName} (${part.toolCallId})`,
              );
              return [...prevMessages, toolResultMessage];
            }

            // Handle Error
            if (part.type === "error") {
              const errorMsg =
                part.error instanceof Error
                  ? part.error.message
                  : String(part.error);
              setError(`Streaming error: ${errorMsg}`);
              toast.error(`Streaming error: ${errorMsg}`);
              if (currentStreamingId) {
                console.log(
                  `[error] Marking message ${currentStreamingId} with error: ${errorMsg}`,
                );
                return prevMessages.map((msg) =>
                  msg.id === currentStreamingId
                    ? {
                        ...msg,
                        error: `Streaming error: ${errorMsg}`,
                        isStreaming: false,
                      }
                    : msg,
                );
              }
              return prevMessages;
            }

            // Ignore other part types for UI updates
            return prevMessages;
          }); // End of setLocalMessages functional update
        } // End of for await loop

        console.log("Finished iterating stream parts.");
      } catch (err: unknown) {
        // --- Catch block ---
        if ((err as any)?.name === "AbortError") console.log("Stream aborted.");
        else {
          console.error("Error during streamText processing:", err);
          const error = err instanceof Error ? err : new Error(String(err));
          if (!error.message.startsWith("Streaming error:")) {
            setError(`Error: ${error.message}`);
            toast.error(`Error: ${error.message}`);
          }
          if (streamingMessageIdRef.current) {
            const finalId = streamingMessageIdRef.current;
            console.log(
              `[catch] Marking message ${finalId} with error: ${error.message}`,
            );
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === finalId
                  ? { ...msg, error: error.message, isStreaming: false }
                  : msg,
              ),
            );
          }
        }
      } finally {
        // --- Finally block ---
        console.log("Stream finally block executing.");
        if (abortControllerRef.current === currentAbortController)
          abortControllerRef.current = null;
        setIsAiStreaming(false);

        // Final check to ensure the streaming message's flag is false
        if (streamingMessageIdRef.current) {
          const finalId = streamingMessageIdRef.current;
          console.log(
            `[finally] Setting message ${finalId} isStreaming to false`,
          );
          setLocalMessages((prev) =>
            prev.map((msg) =>
              msg.id === finalId && msg.isStreaming
                ? { ...msg, isStreaming: false }
                : msg,
            ),
          );
        }
        streamingMessageIdRef.current = null; // Clear ref
      }
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
      bulkAddMessages,
      getContextSnapshotForMod,
      mapToCoreMessages,
    ],
  );

  // --- performImageGeneration (remains the same) ---
  const performImageGeneration = useCallback(
    async ({
      conversationIdToUse,
      prompt,
      n = 1,
      size = "1024x1024",
      aspectRatio,
    }: PerformImageGenerationParams): Promise<PerformImageGenerationResult> => {
      const apiKey = getApiKeyForProvider();
      const validationError = validateAiParameters(
        conversationIdToUse,
        selectedModel,
        selectedProvider,
        apiKey,
        setError,
        true,
      );
      if (validationError) return { error: validationError.message };
      if (!selectedModel?.instance || !selectedModel?.supportsImageGeneration) {
        const errorMsg = "Selected model does not support image generation.";
        setError(errorMsg);
        toast.error(errorMsg);
        return { error: errorMsg };
      }

      setIsAiStreaming(true);
      setError(null);
      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;
      const placeholderId = nanoid();
      const placeholderTimestamp = new Date();
      const placeholderMessage: Message = {
        id: placeholderId,
        conversationId: conversationIdToUse,
        role: "assistant",
        content: `Generating image with prompt: "${prompt}"...`,
        isStreaming: true,
        createdAt: placeholderTimestamp,
        providerId: selectedProvider!.id,
        modelId: selectedModel!.id,
      };
      setLocalMessages((prev) => [...prev, placeholderMessage]);

      try {
        const { images, warnings } = await generateImage({
          model: selectedModel.instance,
          prompt: prompt,
          n: n,
          size: size as `${number}x${number}`,
          aspectRatio: aspectRatio as `${number}:${number}`,
          headers: getStreamHeaders(selectedProvider!.type, apiKey),
          abortSignal: currentAbortController.signal,
        });

        if (warnings && warnings.length > 0)
          warnings.forEach((warning: ImageModelCallWarning) =>
            toast.warning(
              `Image generation warning: ${JSON.stringify(warning)}`,
            ),
          );

        const imageParts: LocalImagePart[] = images.map((img) => ({
          type: "image",
          image: `data:${img.mimeType ?? "image/png"};base64,${img.base64}`,
          mediaType: img.mimeType ?? "image/png",
        }));
        const finalImageMessageData = {
          id: placeholderId,
          role: "assistant" as Role,
          content: imageParts as MessageContent,
          createdAt: placeholderTimestamp,
          conversationId: conversationIdToUse,
          providerId: selectedProvider!.id,
          modelId: selectedModel!.id,
        };

        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId
              ? { ...finalImageMessageData, isStreaming: false, error: null }
              : msg,
          ),
        );

        try {
          await addDbMessage(finalImageMessageData);
          console.log("Saved image generation message to DB:", placeholderId);
          modEvents.emit(ModEvent.RESPONSE_DONE, {
            message: { ...finalImageMessageData, isStreaming: false },
          });
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
          return { error: dbErrorMessage, warnings };
        }
        return { images: imageParts, warnings };
      } catch (err: unknown) {
        if ((err as any)?.name === "AbortError") {
          console.log("Image generation aborted.");
          toast.info("Image generation stopped.");
          setLocalMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId
                ? {
                    ...msg,
                    content: "Image generation cancelled.",
                    isStreaming: false,
                    error: "Cancelled by user.",
                  }
                : msg,
            ),
          );
          return { error: "Cancelled by user." };
        } else {
          const error = err instanceof Error ? err : new Error(String(err));
          const errorMessage = `Image generation failed: ${error.message}`;
          setError(errorMessage);
          toast.error(errorMessage);
          setLocalMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId
                ? {
                    ...msg,
                    error: errorMessage,
                    isStreaming: false,
                    content: "",
                  }
                : msg,
            ),
          );
          return { error: errorMessage };
        }
      } finally {
        if (abortControllerRef.current === currentAbortController)
          abortControllerRef.current = null;
        setIsAiStreaming(false);
        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId && msg.isStreaming
              ? { ...msg, isStreaming: false }
              : msg,
          ),
        );
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

  return { performAiStream, performImageGeneration };
}
