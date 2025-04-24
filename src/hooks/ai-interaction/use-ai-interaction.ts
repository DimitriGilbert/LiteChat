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
  AiModelConfig,
  AiProviderConfig,
} from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";

import { validateAiParameters, handleStreamError } from "./error-handler";
import {
  getStreamHeaders,
  createAssistantPlaceholder,
  finalizeStreamedMessageUI,
} from "./stream-handler";
import { mapToCoreMessages } from "./message-mapper";
import { createSdkTools } from "./tool-handler";
import { performImageGeneration as performImageGenerationFunc } from "./image-generator";

import { useCoreChatStore } from "@/store/core-chat.store";
import { useSettingsStore } from "@/store/settings.store";
import { db } from "@/lib/db";
import {
  convertDbMessagesToCoreMessages,
  createAiModelConfig,
} from "@/utils/chat-utils";

export function useAiInteraction({
  // Destructure all props from UseAiInteractionProps
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  // streamingRefreshRateMs, // Not directly used here, handled by StreamingPortal
  addMessage,
  updateMessage,
  setIsAiStreaming,
  setError,
  addDbMessage,
  getContextSnapshotForMod,
  bulkAddMessages,
  // selectedItemId, // Not directly used here
  // selectedItemType, // Not directly used here
  dbProviderConfigs,
  // dbConversations, // Not directly used here
  // dbProjects, // Not directly used here
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
  const setActiveStream = useCoreChatStore((state) => state.setActiveStream);
  const updateActiveStreamContent = useCoreChatStore(
    (state) => state.updateActiveStreamContent,
  );

  // Refs for managing stream state
  const contentRef = useRef<string>(""); // Accumulates text content during stream
  const placeholderRef = useRef<{
    id: string;
    timestamp: Date;
    providerId: string;
    modelId: string;
    conversationId: string;
  } | null>(null); // Holds info about the placeholder message

  // Memoize SDK tools creation
  const sdkTools = useMemo(() => {
    // Assuming modTools are fetched/managed elsewhere (e.g., ModStore or context)
    const modToolsFromContext = new Map(); // Placeholder
    return createSdkTools(modToolsFromContext, getContextSnapshotForMod);
  }, [getContextSnapshotForMod]);

  /**
   * Performs the AI text streaming operation.
   */
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

      // Validate parameters before proceeding
      const validationError = validateAiParameters(
        conversationIdToUse,
        currentSelectedModel,
        currentSelectedProvider,
        apiKey,
        setError,
      );
      if (validationError) throw validationError;

      // Ensure model instance is valid
      if (!currentSelectedModel?.instance) {
        const errorMsg = "Selected model instance is invalid or not loaded.";
        setError(errorMsg);
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Check for tool support mismatch
      const hasTools = Object.keys(sdkTools).length > 0;
      if (hasTools && !currentSelectedModel?.supportsToolCalling) {
        const toolError = new Error(
          `Selected model "${currentSelectedModel?.name}" does not support tool calling, but tools are registered.`,
        );
        setError(toolError.message);
        toast.error(toolError.message);
        throw toolError;
      }

      // --- Setup Streaming State ---
      setIsAiStreaming(true);
      setError(null);
      contentRef.current = ""; // Reset accumulated content
      placeholderRef.current = null; // Reset placeholder info
      const currentAbortController = new AbortController();
      setAbortController(currentAbortController); // Store the controller

      // Create and add placeholder message
      const {
        id: assistantMessageId,
        message: assistantPlaceholder,
        timestamp: assistantTimestamp,
      } = createAssistantPlaceholder(
        conversationIdToUse,
        currentSelectedProvider!.id, // Assert non-null after validation
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
      setActiveStream(assistantMessageId, ""); // Set active stream in store

      // --- Prepare API Call ---
      const messagesForApi = mapToCoreMessages(
        messagesToSend as unknown as Message[], // Cast needed if type mismatch
      );
      const headers = getStreamHeaders(currentSelectedProvider!.type, apiKey);
      const startTime = Date.now();

      // --- Variables for Final State ---
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

        // --- Call AI SDK ---
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

        // --- Process Stream Parts ---
        for await (const part of result.fullStream as AsyncIterable<
          TextStreamPart<any> // Assuming TextStreamPart for simplicity, adjust if tools are complex
        >) {
          if (currentAbortController.signal.aborted) {
            streamError = new Error("Stream aborted by user.");
            toast.info("Stream stopped.");
            break; // Exit loop immediately on abort
          }

          switch (part.type) {
            case "text-delta":
              contentRef.current += part.textDelta;
              updateActiveStreamContent(part.textDelta); // Update store for UI
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
              // Capture the first error encountered
              if (!streamError) {
                streamError =
                  part.error instanceof Error
                    ? part.error
                    : new Error(String(part.error));
                setError(`Streaming error: ${streamError.message}`);
                toast.error(`Streaming error: ${streamError.message}`);
              }
              break;
            case "finish":
              finalUsage = part.usage;
              finalFinishReason = part.finishReason;
              break;
            // Handle other part types if necessary
          }
        } // End stream loop

        // --- Handle Tool Results (if any tools were called) ---
        if (!streamError && hasTools && finalToolCalls.length > 0) {
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
                isError: false, // Assuming success unless SDK indicates otherwise
              };
              const toolResultMessage: Message = {
                id: nanoid(), // Generate unique ID for tool result message
                role: "tool",
                content: [toolResultContentPart],
                tool_call_id: toolResult.toolCallId, // Link to the call
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
                content: toolResultMessage.content as MessageContent, // Cast okay here
                createdAt: toolResultMessage.createdAt ?? new Date(),
                tool_call_id: toolResultMessage.tool_call_id,
                // Ensure other optional fields are undefined
                vfsContextPaths: undefined,
                tool_calls: undefined,
                children: undefined,
                workflow: undefined,
                providerId: toolResultMessage.providerId,
                modelId: toolResultMessage.modelId,
                tokensInput: undefined,
                tokensOutput: undefined,
              });
            });

            // Add messages to UI and save to DB
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
              // Update UI messages with error
              toolResultMessages.forEach((trm) =>
                updateMessage(trm.id, { error: errorMsg }),
              );
            }
          }
        } // End tool result handling

        // --- Finalize Stream Data ---
        // Ensure final usage/reason are captured if not received during stream
        if (!finalUsage) finalUsage = await result.usage;
        if (!finalFinishReason) finalFinishReason = await result.finishReason;

        // Construct final content based on whether tools were called
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
          finalContent = parts.length > 0 ? parts : ""; // Avoid empty array
        } else {
          finalContent = contentRef.current; // Just the text
        }

        // Check for abort signal again after processing results
        if (currentAbortController.signal.aborted && !streamError) {
          streamError = new Error("Stream aborted by user.");
        }

        // If any error occurred during the process, throw it
        if (streamError) throw streamError;
      } catch (err: unknown) {
        // --- Handle Errors During Streaming ---
        // Use the dedicated error handler
        const [errorObj, accumulatedContent] = handleStreamError(
          err,
          setError,
          contentRef.current,
        );
        streamError = errorObj;
        finalContent = accumulatedContent; // Use potentially partial content
      } finally {
        // --- Cleanup and Final State Update ---
        console.log("Stream finally block executing.");
        // Clear abort controller reference *only if* it's the one we set
        if (
          useCoreChatStore.getState().abortController === currentAbortController
        ) {
          setAbortController(null);
        }

        // Finalize the UI message state
        finalizeStreamedMessageUI(
          assistantMessageId,
          finalContent, // Use potentially partial content on error
          streamError,
          finalUsage,
          startTime,
          updateMessage,
          setActiveStream,
        );

        // --- Save Final Message to DB ---
        const placeholderData = placeholderRef.current;
        if (placeholderData) {
          console.log(
            `Attempting to save final message (ID: ${placeholderData.id}), Error: ${streamError?.message || "None"}`,
          );
          const dbMessageToSave: DbMessage = {
            id: placeholderData.id,
            conversationId: placeholderData.conversationId,
            role: "assistant",
            content: finalContent, // Save final content (potentially partial on error)
            createdAt: placeholderData.timestamp,
            tool_calls:
              finalToolCalls.length > 0
                ? finalToolCalls.map((tc) => ({
                    id: tc.toolCallId,
                    type: "function", // Assuming 'function' type for now
                    function: {
                      name: tc.toolName,
                      arguments: JSON.stringify(tc.args), // Store args as string
                    },
                  }))
                : undefined,
            tokensInput: finalUsage?.promptTokens,
            tokensOutput: finalUsage?.completionTokens,
            providerId: placeholderData.providerId,
            modelId: placeholderData.modelId,
            // Ensure other optional fields are undefined
            vfsContextPaths: undefined,
            tool_call_id: undefined,
            children: undefined,
            workflow: undefined,
          };

          try {
            await addDbMessage(dbMessageToSave); // Use addDbMessage from store
            console.log(
              "Saved final assistant message to DB:",
              placeholderData.id,
            );
          } catch (dbErr: unknown) {
            const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
            console.error("Failed to save final assistant message:", dbErr);
            setError(`Error saving response: ${dbErrorMessage}`);
            toast.error(`Failed to save response: ${dbErrorMessage}`);
            // Update UI message again if DB save fails
            updateMessage(placeholderData.id, { error: dbErrorMessage });
          }
        } else {
          // This case should ideally not happen if placeholderRef is managed correctly
          console.error(
            `[Finally Block] Critical error: Placeholder data ref was null. Cannot save message. Stream Error: ${streamError?.message || "None"}`,
          );
          setError("Internal error: Failed to finalize message for saving.");
          toast.error("Internal error: Failed to finalize message for saving.");
        }
        // Reset placeholder ref after use
        placeholderRef.current = null;
        // Ensure global streaming state is false if no other streams are active
        // This might be handled by finalizeStreamedMessageUI's setActiveStream(null)
        // but double-checking here can be safer.
        if (!useCoreChatStore.getState().activeStreamId) {
          setIsAiStreaming(false);
        }
      } // End finally block
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
      bulkAddMessages,
      sdkTools,
      setAbortController,
      setActiveStream,
      updateActiveStreamContent,
    ],
  );

  /**
   * Performs image generation.
   */
  const performImageGenerationCallback = useCallback(
    async (
      params: Omit<
        PerformImageGenerationParams,
        // Omit props that are provided by the hook's closure
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

      // Create a new AbortController specifically for this image generation
      const imageAbortController = new AbortController();
      // Use a temporary ref object to pass to the function
      const abortControllerRefForImage = { current: imageAbortController };

      try {
        // Call the imported image generation function with all necessary props
        const result = await performImageGenerationFunc({
          ...params,
          selectedModel: currentSelectedModel,
          selectedProvider: currentSelectedProvider,
          getApiKeyForProvider: apiKeyGetter,
          addMessage: addMessage,
          updateMessage: updateMessage,
          setIsAiStreaming: setIsAiStreaming,
          setError: setError,
          addDbMessage: addDbMessage, // Pass the action from the store
          abortControllerRef: abortControllerRefForImage, // Pass the ref
        });
        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown image generation error";
        setError(message); // Set global error state
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
      addDbMessage, // Include addDbMessage dependency
    ],
  );

  /**
   * Handles the form submission, deciding whether to start a workflow,
   * generate an image, or perform a standard text stream.
   */
  const handleFormSubmit = useCallback(
    // FIX: Add promptValue parameter to match the expected signature
    async (
      promptValue: string,
      _files: File[], // Files are processed into contentToSendToAI earlier
      _vfsPaths: string[], // VFS paths are processed into contentToSendToAI earlier
      context: {
        selectedItemId: string | null; // Conversation ID
        contentToSendToAI: MessageContent; // Pre-processed content
        vfsContextPaths?: string[]; // VFS paths included
      },
    ) => {
      // *** ADD CHECK: Ensure context.selectedItemId is valid ***
      if (!context.selectedItemId) {
        const errorMsg =
          "handleFormSubmit received null conversation ID in context.";
        console.error(`[useAiInteraction] ${errorMsg}`);
        toast.error(errorMsg);
        setError(errorMsg);
        return;
      }

      const conversationId = context.selectedItemId;
      // Use promptValue (original input) for command matching
      const commandMatch = promptValue.match(/^\/(\w+)\s*(.*)/s);

      const isWorkflowCommand =
        commandMatch &&
        ["race", "sequence", "parallel"].includes(commandMatch[1]);
      // Use promptValue for image command check as well
      const isImageCommand = promptValue.startsWith("/imagine ");

      // --- Workflow Execution ---
      if (isWorkflowCommand) {
        const fullCommand = promptValue; // Use original promptValue for the command
        try {
          // Helper functions to get provider/model info needed by workflow service
          const getProviderFunc = (
            id: string,
          ): AiProviderConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === id);
            if (!config) return undefined;
            // Return a simplified AiProviderConfig structure
            return {
              id: config.id,
              name: config.name,
              type: config.type,
              models: [], // Models aren't needed at this level for the service
              allAvailableModels: config.fetchedModels || [], // Pass available models
            };
          };
          const getModelFunc = (
            provId: string,
            modId: string,
          ): AiModelConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === provId);
            if (!config) return undefined;
            const currentApiKey = getApiKeyForProvider(config.id);
            // Use utility to create the full AiModelConfig with instance
            return createAiModelConfig(config, modId, currentApiKey);
          };

          // Call the core workflow starter function from the store/props
          await startWorkflowCore(
            conversationId,
            fullCommand,
            getApiKeyForProvider,
            getProviderFunc,
            getModelFunc,
            dbProviderConfigs, // Pass current DB configs
          );
          inputActions.clearAllInput(); // Clear input on successful start
        } catch (err) {
          console.error("Error starting workflow:", err);
          toast.error(
            `Error starting workflow: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      // --- Image Generation ---
      else if (isImageCommand) {
        try {
          const imagePrompt = promptValue.substring("/imagine ".length).trim(); // Use original promptValue
          // Call the core image generation handler from the store/props
          await handleImageGenerationCore(conversationId, imagePrompt);
          inputActions.clearAllInput(); // Clear input on successful start
        } catch (err) {
          console.error("Error in image generation flow:", err);
          toast.error(
            `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      // --- Standard Text Streaming ---
      else {
        try {
          // Submit the user message first (using pre-processed content)
          await handleSubmitCore(
            conversationId,
            context.contentToSendToAI, // Use the processed content here
            context.vfsContextPaths,
          );

          const currentMessages = useCoreChatStore.getState().messages;
          const settings = useSettingsStore.getState();
          const activeSystemPrompt =
            getContextSnapshotForMod().activeSystemPrompt;

          const messagesForApi =
            convertDbMessagesToCoreMessages(currentMessages);

          // Perform the AI stream
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
          inputActions.clearAllInput(); // Clear input on successful completion
        } catch (err) {
          console.error("Error during form submission flow:", err);
        }
      }
    },
    [
      setError, // Added setError dependency
      startWorkflowCore,
      handleImageGenerationCore,
      handleSubmitCore,
      performAiStream,
      inputActions,
      dbProviderConfigs, // Add dependency
      getApiKeyForProvider, // Add dependency
      getContextSnapshotForMod, // Add dependency
    ],
  );

  /**
   * Stops the currently active AI stream or workflow.
   */
  const stopStreaming = useCallback(
    (parentMessageId: string | null = null) => {
      // Call the core stop function from the store/props
      stopStreamingCore(parentMessageId);
    },
    [stopStreamingCore],
  );

  /**
   * Regenerates an assistant's response or re-runs a workflow/image generation.
   */
  const regenerateMessage = useCallback(
    async (messageId: string) => {
      try {
        // 1. Get the original message and context
        const originalMessage = await db.messages.get(messageId);
        if (!originalMessage) {
          toast.error("Cannot regenerate: Original message not found in DB.");
          return;
        }
        const conversationId = originalMessage.conversationId;

        // 2. Prepare UI and potentially delete old message (handled by core)
        await regenerateMessageCore(messageId);

        // 3. Fetch history *before* the message to regenerate
        const historyBefore = await db.messages
          .where("[conversationId+createdAt]")
          .between(
            [conversationId, Dexie.minKey],
            [conversationId, originalMessage.createdAt], // Get messages up to *but not including* the original
            false, // lower bound exclusive (minKey)
            false, // upper bound exclusive (original message time)
          )
          .sortBy("createdAt");

        // 4. Determine regeneration type and re-trigger
        if (originalMessage.workflow) {
          // --- Re-run Workflow ---
          toast.info("Re-running workflow...");
          const originalCommand = originalMessage.content as string; // Assuming command is stored in content
          // Helper functions (same as in handleFormSubmit)
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
            return createAiModelConfig(config, modId, currentApiKey);
          };
          // Call core workflow starter
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
          // --- Regenerate User Image Prompt (Unusual Case) ---
          toast.warning(
            "Regenerating user image prompts not typical. Regenerate the assistant response instead.",
          );
        } else if (originalMessage.role === "assistant") {
          // --- Regenerate Assistant Response (Text or Image) ---
          // Find the user message that *immediately* preceded this assistant message
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
            // --- Re-trigger Image Generation ---
            const imagePrompt = precedingUserMessage.content
              .substring("/imagine ".length)
              .trim();
            await handleImageGenerationCore(conversationId, imagePrompt);
          } else {
            // --- Re-trigger Text Generation ---
            const historyForApi =
              convertDbMessagesToCoreMessages(historyBefore);
            const settings = useSettingsStore.getState();
            const activeSystemPrompt =
              getContextSnapshotForMod().activeSystemPrompt; // Get current system prompt

            await performAiStream({
              conversationIdToUse: conversationId,
              messagesToSend: historyForApi, // Send history *before* the message
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
      dbProviderConfigs, // Add dependency
      getApiKeyForProvider, // Add dependency
      getContextSnapshotForMod, // Add dependency
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
