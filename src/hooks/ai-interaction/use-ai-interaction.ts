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
import Dexie from "dexie";

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
  // Add types needed by interaction handlers
  AiModelConfig,
  AiProviderConfig,
} from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";

import { validateAiParameters } from "./error-handler";
import {
  getStreamHeaders,
  createAssistantPlaceholder,
  finalizeStreamedMessageUI,
} from "./stream-handler";
import { mapToCoreMessages } from "./message-mapper";
import { createSdkTools } from "./tool-handler";
import { performImageGeneration as performImageGenerationFunc } from "./image-generator";

import { useCoreChatStore } from "@/store/core-chat.store"; // Import store
import { useSettingsStore } from "@/store/settings.store"; // Import settings store
import { db } from "@/lib/db"; // Import db
import {
  convertDbMessagesToCoreMessages,
  createAiModelConfig, // Import the new utility
} from "@/utils/chat-utils"; // Import util

export function useAiInteraction({
  // Destructure all props from UseAiInteractionProps
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  // REMOVED: streamingRefreshRateMs,
  addMessage,
  updateMessage,
  setIsAiStreaming,
  setError,
  addDbMessage,
  getContextSnapshotForMod,
  bulkAddMessages,
  // selectedItemId,
  // selectedItemType,
  dbProviderConfigs,
  // dbConversations, // Not directly needed, context snapshot handles it
  // dbProjects, // Not directly needed, context snapshot handles it
  inputActions,
  handleSubmitCore,
  handleImageGenerationCore,
  stopStreamingCore,
  regenerateMessageCore,
  startWorkflowCore,
}: UseAiInteractionProps): UseAiInteractionReturn {
  // Get the actions from the store
  const setAbortController = useCoreChatStore(
    (state) => state.setAbortController,
  );
  // Get actions for managing active stream state
  const setActiveStream = useCoreChatStore((state) => state.setActiveStream);
  const updateActiveStreamContent = useCoreChatStore(
    (state) => state.updateActiveStreamContent,
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
      const apiKey = getApiKeyForProvider(currentSelectedProvider?.id || "");

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

      // Set global streaming state (might be redundant if setActiveStream does it)
      setIsAiStreaming(true);
      setError(null);
      contentRef.current = ""; // Reset accumulated content
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

      // Add the placeholder message to the main list (marks it as streaming)
      addMessage(assistantPlaceholder);

      // Set the active stream state
      setActiveStream(assistantMessageId, "");

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
      let finalContent: MessageContent = ""; // Initialize final content

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
            break;
          }

          switch (part.type) {
            case "text-delta":
              contentRef.current += part.textDelta; // Accumulate locally
              updateActiveStreamContent(part.textDelta); // Update isolated stream state
              modEvents.emit(ModEvent.RESPONSE_CHUNK, {
                chunk: part.textDelta,
                conversationId: conversationIdToUse,
              });
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

        // --- Tool Result Handling (after main stream loop) ---
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
                isError: false, // Assuming success unless error handling is added
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

            // Add tool result messages to UI and DB
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
        // --- End Tool Result Handling ---

        if (!finalUsage) finalUsage = await result.usage;
        if (!finalFinishReason) finalFinishReason = await result.finishReason;

        // Determine final content structure
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
          finalContent = parts.length > 0 ? parts : "";
        } else {
          finalContent = contentRef.current;
        }

        // Check for abort after loop
        if (currentAbortController.signal.aborted && !streamError) {
          streamError = new Error("Stream aborted by user.");
        }
        if (streamError) throw streamError; // Throw if any error occurred
      } catch (err: unknown) {
        if ((err as any)?.name === "AbortError") {
          if (!currentAbortController.signal.aborted) {
            streamError = new Error("Stream aborted.");
          } else {
            // Handled by store action
          }
        } else {
          streamError = err instanceof Error ? err : new Error(String(err));
          console.error("Error during streamText processing:", streamError);
          setError(`Error: ${streamError.message}`);
          toast.error(`Error: ${streamError.message}`);
        }
        // Set final content to accumulated content even on error
        finalContent = contentRef.current;
      } finally {
        console.log("Stream finally block executing.");
        if (
          useCoreChatStore.getState().abortController === currentAbortController
        ) {
          setAbortController(null);
        }

        // Finalize the message in the main list
        finalizeStreamedMessageUI(
          assistantMessageId,
          finalContent, // Pass final content (text or parts)
          streamError,
          finalUsage,
          startTime,
          updateMessage,
          setActiveStream, // Pass action to clear active stream
        );

        const placeholderData = placeholderRef.current;
        if (placeholderData && !streamError) {
          console.log(
            `Attempting to save final message with ID: ${placeholderData.id}`,
          );
          const dbMessageToSave: DbMessage = {
            id: placeholderData.id,
            conversationId: placeholderData.conversationId,
            role: "assistant",
            content: finalContent, // Save final content
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
          // Optionally save the errored message placeholder to DB if needed
          if (placeholderData) {
            try {
              await addDbMessage({
                id: placeholderData.id,
                conversationId: placeholderData.conversationId,
                role: "assistant",
                content: finalContent, // Save partial content
                createdAt: placeholderData.timestamp,
                providerId: placeholderData.providerId,
                modelId: placeholderData.modelId,
                // Mark error in DB? Depends on schema/requirements
              });
            } catch (dbErr) {
              console.error(
                "Failed to save errored message placeholder:",
                dbErr,
              );
            }
          }
        } else {
          console.error(
            `[Finally Block] Critical error: Placeholder data ref was null. Cannot save message. Stream Error: ${streamError || "None"}`,
          );
          setError("Internal error: Failed to finalize message for saving.");
          toast.error("Internal error: Failed to finalize message for saving.");
        }
        placeholderRef.current = null;
        // Global streaming state is reset by setActiveStream(null) in finalize
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      // REMOVED: streamingRefreshRateMs,
      addMessage,
      updateMessage,
      setIsAiStreaming,
      setError,
      addDbMessage,
      bulkAddMessages,
      sdkTools,
      setAbortController,
      setActiveStream, // Add dependency
      updateActiveStreamContent, // Add dependency
    ],
  );

  // performImageGenerationCallback remains largely the same
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
        | "abortControllerRef"
      >,
    ): Promise<PerformImageGenerationResult> => {
      const currentSelectedModel = selectedModel;
      const currentSelectedProvider = selectedProvider;
      const apiKeyGetter = getApiKeyForProvider;

      const imageAbortController = new AbortController();
      const abortControllerRefForImage = { current: imageAbortController };

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
          abortControllerRef: abortControllerRefForImage,
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
    ],
  );

  // handleFormSubmit remains largely the same, but uses performAiStream
  const handleFormSubmit = useCallback(
    async (
      promptValue: string,
      _files: File[],
      _vfsPaths: string[],
      context: {
        selectedItemId: string | null;
        contentToSendToAI: MessageContent;
        vfsContextPaths?: string[];
      },
    ) => {
      if (!context.selectedItemId) {
        toast.error("Failed to determine active conversation for submission.");
        setError("Failed to determine active conversation for submission.");
        return;
      }

      const conversationId = context.selectedItemId;
      const commandMatch = promptValue.match(/^\/(\w+)\s*(.*)/s);
      const isWorkflowCommand =
        commandMatch &&
        ["race", "sequence", "parallel"].includes(commandMatch[1]);
      const isImageCommand = promptValue.startsWith("/imagine ");

      if (isWorkflowCommand) {
        const fullCommand = promptValue;
        try {
          const getProviderFunc = (
            id: string,
          ): AiProviderConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === id);
            if (!config) return undefined;
            return {
              id: config.id,
              name: config.name,
              type: config.type,
              models: [],
              allAvailableModels: config.fetchedModels || [],
            };
          };
          const getModelFunc = (
            provId: string,
            modId: string,
          ): AiModelConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === provId);
            if (!config) return undefined;
            const currentApiKey = getApiKeyForProvider(config.id);
            // Use the utility function
            return createAiModelConfig(config, modId, currentApiKey);
          };
          await startWorkflowCore(
            conversationId,
            fullCommand,
            getApiKeyForProvider,
            getProviderFunc,
            getModelFunc,
            dbProviderConfigs,
          );
          inputActions.clearAllInput();
        } catch (err) {
          console.error("Error starting workflow:", err);
          toast.error(
            `Error starting workflow: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else if (isImageCommand) {
        try {
          const imagePrompt = promptValue.substring("/imagine ".length).trim();
          await handleImageGenerationCore(conversationId, imagePrompt);
          inputActions.clearAllInput();
        } catch (err) {
          console.error("Error in image generation flow:", err);
          toast.error(
            `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        try {
          // Submit the user message first
          await handleSubmitCore(
            conversationId,
            context.contentToSendToAI,
            context.vfsContextPaths,
          );
          // Get the *updated* message list *after* submitting the user message
          const currentMessages = useCoreChatStore.getState().messages;
          const settings = useSettingsStore.getState();
          const activeSystemPrompt =
            getContextSnapshotForMod().activeSystemPrompt;
          const messagesForApi =
            convertDbMessagesToCoreMessages(currentMessages);

          // Now call performAiStream with the updated history
          await performAiStream({
            conversationIdToUse: conversationId,
            messagesToSend: messagesForApi,
            currentTemperature: settings.temperature,
            currentMaxTokens: settings.maxTokens,
            currentTopP: settings.topP,
            currentTopK: settings.topK,
            currentPresencePenalty: settings.presencePenalty,
            currentFrequencyPenalty: settings.frequencyPenalty,
            systemPromptToUse: activeSystemPrompt,
          });
          inputActions.clearAllInput();
        } catch (err) {
          console.error("Error during form submission flow:", err);
          // Error handling is done within performAiStream or handleSubmitCore
        }
      }
    },
    [
      setError,
      startWorkflowCore,
      handleImageGenerationCore,
      handleSubmitCore,
      performAiStream,
      inputActions,
      dbProviderConfigs,
      getApiKeyForProvider,
      getContextSnapshotForMod,
    ],
  );

  // stopStreaming and regenerateMessage remain the same, using core actions
  const stopStreaming = useCallback(
    (parentMessageId: string | null = null) => {
      stopStreamingCore(parentMessageId);
    },
    [stopStreamingCore],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      try {
        const originalMessage = await db.messages.get(messageId);
        if (!originalMessage) {
          toast.error("Cannot regenerate: Original message not found in DB.");
          return;
        }
        const conversationId = originalMessage.conversationId;

        // Prepare UI by removing the message to be regenerated
        await regenerateMessageCore(messageId);

        // Get the history *before* the regenerated message
        const historyBefore = await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [conversationId, Dexie.minKey],
            [conversationId, originalMessage.createdAt],
            false, // lower bound exclusive
            true, // upper bound exclusive
          )
          .sortBy("createdAt");

        if (originalMessage.workflow) {
          toast.info("Re-running workflow...");
          const originalCommand = originalMessage.content as string;
          const getProviderFunc = (
            id: string,
          ): AiProviderConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === id);
            if (!config) return undefined;
            return {
              id: config.id,
              name: config.name,
              type: config.type,
              models: [],
              allAvailableModels: config.fetchedModels || [],
            };
          };
          const getModelFunc = (
            provId: string,
            modId: string,
          ): AiModelConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === provId);
            if (!config) return undefined;
            const currentApiKey = getApiKeyForProvider(config.id);
            // Use the utility function
            return createAiModelConfig(config, modId, currentApiKey);
          };
          await startWorkflowCore(
            conversationId,
            originalCommand,
            getApiKeyForProvider,
            getProviderFunc,
            getModelFunc,
            dbProviderConfigs,
          );
        } else if (
          originalMessage.role === "user" &&
          typeof originalMessage.content === "string" &&
          originalMessage.content.startsWith("/imagine ")
        ) {
          toast.warning(
            "Regenerating user image prompts not typical. Regenerate the assistant response instead.",
          );
        } else if (originalMessage.role === "assistant") {
          // Find the user message that preceded this assistant message
          let precedingUserMessage: DbMessage | undefined;
          for (let i = historyBefore.length - 1; i >= 0; i--) {
            if (historyBefore[i].role === "user") {
              precedingUserMessage = historyBefore[i];
              break;
            }
          }

          if (
            precedingUserMessage &&
            typeof precedingUserMessage.content === "string" &&
            precedingUserMessage.content.startsWith("/imagine ")
          ) {
            // Re-trigger image generation
            const imagePrompt = precedingUserMessage.content
              .substring("/imagine ".length)
              .trim();
            await handleImageGenerationCore(conversationId, imagePrompt);
          } else {
            // Re-trigger text generation
            const historyForApi =
              convertDbMessagesToCoreMessages(historyBefore);
            const settings = useSettingsStore.getState();
            const activeSystemPrompt =
              getContextSnapshotForMod().activeSystemPrompt;
            await performAiStream({
              conversationIdToUse: conversationId,
              messagesToSend: historyForApi,
              currentTemperature: settings.temperature,
              currentMaxTokens: settings.maxTokens,
              currentTopP: settings.topP,
              currentTopK: settings.topK,
              currentPresencePenalty: settings.presencePenalty,
              currentFrequencyPenalty: settings.frequencyPenalty,
              systemPromptToUse: activeSystemPrompt,
            });
          }
        } else {
          toast.error("Cannot regenerate this message type.");
        }
      } catch (err) {
        console.error("Error during regeneration flow:", err);
        toast.error(
          `Regeneration failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [
      regenerateMessageCore,
      startWorkflowCore,
      handleImageGenerationCore,
      performAiStream,
      dbProviderConfigs,
      getApiKeyForProvider,
      getContextSnapshotForMod,
    ],
  );

  return {
    performAiStream,
    performImageGeneration: performImageGenerationCallback,
    handleFormSubmit,
    stopStreaming,
    regenerateMessage,
  };
}
