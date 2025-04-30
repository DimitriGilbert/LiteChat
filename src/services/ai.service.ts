// src/services/ai.service.ts
// Entire file content provided
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type { ToolImplementation } from "@/types/litechat/modding";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import { nanoid } from "nanoid";
import {
  streamText,
  StreamTextResult,
  LanguageModelV1,
  CoreMessage,
  LanguageModelUsage,
  ProviderMetadata,
  ToolCallPart,
  ToolResultPart,
  TextPart,
  ImagePart,
  CoreUserMessage,
  Tool,
  TextStreamPart,
  FinishReason,
} from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store";
import { toast } from "sonner";
import { z } from "zod";
import { PersistenceService } from "@/services/persistence.service";
import { type AttachedFileMetadata } from "@/store/input.store";
// Import helpers from the new file
import {
  runMiddleware,
  getContextSnapshot,
  processFileMetaToUserContent, // Keep this helper
} from "@/lib/litechat/ai-helpers";
// Import VFS operations and the global VFS instance
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { useConversationStore } from "@/store/conversation.store"; // Import ConversationStore
import type { fs as FsType } from "@zenfs/core"; // Import fs type
// Import VfsStore ONLY to check the configured key
import { useVfsStore } from "@/store/vfs.store";

export class AIService {
  private static activeStreams = new Map<string, AbortController>();

  static async startInteraction(
    aiPayload: PromptObject,
    initiatingTurnData: PromptTurnObject,
  ): Promise<string | null> {
    const interactionStoreStateAndActions = useInteractionStore.getState();
    const conversationStoreState = useConversationStore.getState(); // Get conversation store state
    const conversationId =
      interactionStoreStateAndActions.currentConversationId;
    if (!conversationId) {
      interactionStoreStateAndActions.setError("No active conversation.");
      toast.error("Cannot start interaction: No active conversation.");
      return null;
    }

    const startMiddlewareResult = await runMiddleware(
      "middleware:interaction:beforeStart",
      { prompt: aiPayload, conversationId },
    );
    if (startMiddlewareResult === false) {
      console.log("AIService: Interaction start cancelled by middleware.");
      return null;
    }
    const finalPayload =
      startMiddlewareResult && typeof startMiddlewareResult === "object"
        ? (startMiddlewareResult as { prompt: PromptObject }).prompt
        : aiPayload;

    const interactionId = nanoid();
    const abortController = new AbortController();
    this.activeStreams.set(interactionId, abortController);

    const currentInteractions = interactionStoreStateAndActions.interactions;
    const conversationInteractions = currentInteractions.filter(
      (i) => i.conversationId === conversationId,
    );
    const newIndex =
      conversationInteractions.reduce((max, i) => Math.max(max, i.index), -1) +
      1;
    const parentId =
      conversationInteractions.length > 0
        ? conversationInteractions[conversationInteractions.length - 1].id
        : null;

    // --- Process Files into User Message ---
    const finalMessages: CoreMessage[] = [...finalPayload.messages];
    let lastUserMessageIndex = -1;
    for (let i = finalMessages.length - 1; i >= 0; i--) {
      if (finalMessages[i].role === "user") {
        lastUserMessageIndex = i;
        break;
      }
    }

    const attachedFilesMeta = initiatingTurnData.metadata?.attachedFiles ?? [];

    if (lastUserMessageIndex !== -1 && attachedFilesMeta.length > 0) {
      const userMessage = finalMessages[
        lastUserMessageIndex
      ] as CoreUserMessage;
      const fileContentParts: (TextPart | ImagePart)[] = [];

      // --- Determine VFS Key and Ensure VFS is Ready (if needed) ---
      let vfsInstance: typeof FsType | null = null; // Use FsType here
      let targetVfsKey: string | null = null;
      const needsVfs = attachedFilesMeta.some((f) => f.source === "vfs");

      if (needsVfs) {
        const currentConversation =
          conversationStoreState.getConversationById(conversationId);
        targetVfsKey = currentConversation?.projectId ?? "orphan"; // Use project ID or 'orphan'
        console.log(
          `[AIService] VFS files detected. Target VFS key: ${targetVfsKey}`,
        );

        // Check if the globally configured VFS matches the target key
        const currentConfiguredKey = useVfsStore.getState().configuredVfsKey;
        if (
          VfsOps.VFS && // Check if the global VFS instance exists
          currentConfiguredKey === targetVfsKey
        ) {
          console.log(
            `[AIService] Using existing VFS instance for key: ${targetVfsKey}`,
          );
          vfsInstance = VfsOps.VFS; // Use the existing global instance
        } else {
          // If not configured or key mismatch, attempt direct initialization
          console.log(
            `[AIService] Existing VFS instance mismatch or unavailable (Configured: ${currentConfiguredKey}, Needed: ${targetVfsKey}). Attempting direct initialization...`,
          );
          try {
            // Use VfsOps.initializeFsOp directly
            vfsInstance = await VfsOps.initializeFsOp(targetVfsKey);
            if (!vfsInstance) {
              throw new Error(
                `Direct VFS initialization failed for key ${targetVfsKey}.`,
              );
            }
            console.log(
              `[AIService] Direct VFS initialization successful for key ${targetVfsKey}.`,
            );
            // Note: This initialized instance might differ from the global VfsOps.VFS
            // if the store's desired key changes again before this finishes.
            // We will use this *specific* instance for reading files below.
          } catch (vfsError) {
            console.error(
              `[AIService] Failed to ensure VFS ready for key ${targetVfsKey} via direct init:`,
              vfsError,
            );
            toast.error(
              `Filesystem error: Could not access files for key ${targetVfsKey}.`,
            );
            vfsInstance = null; // Ensure instance is null on failure
          }
        }
      }
      // --- End VFS Readiness Check ---

      // --- Process each attached file ---
      for (const fileMeta of attachedFilesMeta as AttachedFileMetadata[]) {
        let contentPart: TextPart | ImagePart | null = null;
        try {
          if (fileMeta.source === "direct") {
            // Process directly uploaded file content
            contentPart = processFileMetaToUserContent(fileMeta);
          } else if (
            fileMeta.source === "vfs" &&
            vfsInstance && // Check if we have a valid instance for the target key
            fileMeta.path
          ) {
            // Fetch content from VFS using the obtained instance
            console.log(`[AIService] Fetching VFS file: ${fileMeta.path}`);
            // Use the obtained vfsInstance with VfsOps.readFileOp
            // Note: VfsOps functions use the global fs by default,
            // but we assume initializeFsOp configures the global one correctly
            // for the duration of this operation if direct init was needed.
            // If ZenFS allows passing an instance, that would be safer.
            // For now, rely on initializeFsOp setting the global context.
            const contentBytes = await VfsOps.readFileOp(fileMeta.path);
            // Now process the fetched content using the helper
            contentPart = processFileMetaToUserContent({
              ...fileMeta,
              contentBytes: contentBytes,
              contentText: undefined,
              contentBase64: undefined,
            });
          } else if (fileMeta.source === "vfs") {
            // Handle case where VFS was needed but not ready/initialized
            console.warn(
              `[AIService] Skipping VFS file ${fileMeta.name} as VFS instance for key ${targetVfsKey} could not be obtained.`,
            );
            contentPart = {
              type: "text",
              text: `[Skipped VFS file: ${fileMeta.name} - Filesystem unavailable]`,
            };
          }

          if (contentPart) {
            fileContentParts.push(contentPart);
          }
        } catch (processingError) {
          console.error(
            `[AIService] Error processing file ${fileMeta.name}:`,
            processingError,
          );
          // Add an error placeholder to the message
          fileContentParts.push({
            type: "text",
            text: `[Error processing file: ${fileMeta.name}]`,
          });
        }
      }
      // --- End File Processing Loop ---

      let userMessageContentParts: (TextPart | ImagePart)[] = [];
      if (typeof userMessage.content === "string") {
        if (userMessage.content.trim()) {
          userMessageContentParts.push({
            type: "text",
            text: userMessage.content,
          });
        }
      } else if (Array.isArray(userMessage.content)) {
        userMessageContentParts = (userMessage.content as any[]).filter(
          (part): part is TextPart | ImagePart =>
            part &&
            typeof part === "object" &&
            "type" in part &&
            (part.type === "text" || part.type === "image"),
        );
      }

      // Combine file content parts with existing text/image parts
      // Place file parts *before* the user's text message content
      finalMessages[lastUserMessageIndex] = {
        ...userMessage,
        content: [...fileContentParts, ...userMessageContentParts],
      };
      console.log(
        `AIService: Added ${fileContentParts.length} file part(s) to user message content.`,
      );
    }
    // --- End File Processing ---

    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
      prompt: { ...initiatingTurnData }, // Store the original turn data
      response: null,
      status: "STREAMING",
      startedAt: new Date(),
      endedAt: null,
      metadata: {
        ...finalPayload.metadata, // Metadata from the final AI payload
        // Store only basic file info (no content) in interaction metadata
        attachedFiles: initiatingTurnData.metadata.attachedFiles?.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ contentBase64, contentText, ...rest }) => rest,
        ),
        toolCalls: [], // Initialize as empty arrays
        toolResults: [], // Initialize as empty arrays
      },
      index: newIndex,
      parentId: parentId,
    };

    // Add interaction to state and persist initial record
    interactionStoreStateAndActions._addInteractionToState(interactionData);
    interactionStoreStateAndActions._addStreamingId(interactionId);
    PersistenceService.saveInteraction({ ...interactionData }).catch((e) => {
      console.error(
        `AIService: Failed initial persistence for ${interactionId}`,
        e,
      );
    });

    emitter.emit("interaction:started", {
      interactionId,
      conversationId,
      type: interactionData.type,
    });

    let streamResult: StreamTextResult<any, any> | undefined;
    let finalStatus: Interaction["status"] = "ERROR";
    let finalErrorMessage: string | undefined = undefined;
    let finalUsage: LanguageModelUsage | undefined = undefined;
    let finalProviderMetadata: ProviderMetadata | undefined = undefined;
    let finalFinishReason: FinishReason | undefined = undefined;

    // Store tool calls/results as JSON strings during streaming
    const currentToolCallStrings: string[] = [];
    const currentToolResultStrings: string[] = [];

    try {
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance;
      if (!modelInstance) {
        throw new Error("Selected model instance not available.");
      }

      // --- Tool Setup ---
      const allRegisteredTools = useControlRegistryStore
        .getState()
        .getRegisteredTools();
      const enabledToolNames = finalPayload.metadata?.enabledTools ?? [];

      const toolsWithExecute = enabledToolNames.reduce(
        (acc, name) => {
          const toolInfo = allRegisteredTools[name];
          if (toolInfo) {
            const toolDefinition: Tool<any> = { ...toolInfo.definition };
            if (toolInfo.implementation) {
              // Wrap implementation to handle errors and context
              toolDefinition.execute = async (args: any) => {
                try {
                  const contextSnapshot = getContextSnapshot(); // Use helper
                  const parsedArgs = toolInfo.definition.parameters.parse(args);
                  const implementation: ToolImplementation<any> =
                    toolInfo.implementation!;
                  return await implementation(parsedArgs, contextSnapshot);
                } catch (e) {
                  console.error(
                    `[AIService] Error executing tool ${name} via SDK:`,
                    e,
                  );
                  const toolError = e instanceof Error ? e.message : String(e);
                  // Provide structured error for Zod validation issues
                  if (e instanceof z.ZodError) {
                    return {
                      _isError: true,
                      error: `Invalid arguments: ${e.errors.map((err) => `${err.path.join(".")} (${err.message})`).join(", ")}`,
                    };
                  }
                  // Return generic error structure
                  return { _isError: true, error: toolError };
                }
              };
            }
            acc[name] = toolDefinition;
          }
          return acc;
        },
        {} as Record<string, Tool<any>>,
      );
      // --- End Tool Setup ---

      // --- StreamText Options Setup ---
      const maxSteps =
        finalPayload.parameters?.maxSteps ??
        useSettingsStore.getState().toolMaxSteps;

      const streamOptions: Parameters<typeof streamText>[0] = {
        model: modelInstance as LanguageModelV1,
        messages: finalMessages, // Use messages with processed file content
        abortSignal: abortController.signal,
        maxSteps: maxSteps,
      };

      if (Object.keys(toolsWithExecute).length > 0) {
        streamOptions.tools = toolsWithExecute;
      }

      // Determine toolChoice based on payload or presence of tools
      streamOptions.toolChoice =
        finalPayload.toolChoice ??
        (Object.keys(toolsWithExecute).length > 0 ? "auto" : "none");

      // Add optional parameters
      if (finalPayload.system) {
        streamOptions.system = finalPayload.system;
      }
      if (finalPayload.parameters) {
        if (finalPayload.parameters.temperature !== undefined)
          streamOptions.temperature = finalPayload.parameters.temperature;
        if (finalPayload.parameters.max_tokens !== undefined)
          streamOptions.maxTokens = finalPayload.parameters.max_tokens;
        if (finalPayload.parameters.top_p !== undefined)
          streamOptions.topP = finalPayload.parameters.top_p;
        if (finalPayload.parameters.top_k !== undefined)
          streamOptions.topK = finalPayload.parameters.top_k;
        if (finalPayload.parameters.presence_penalty !== undefined)
          streamOptions.presencePenalty =
            finalPayload.parameters.presence_penalty;
        if (finalPayload.parameters.frequency_penalty !== undefined)
          streamOptions.frequencyPenalty =
            finalPayload.parameters.frequency_penalty;
      }
      // --- End StreamText Options Setup ---

      console.log(
        `AIService: Calling streamText with options for ${interactionId}:`,
        {
          // Log relevant options, avoid logging full messages/instance
          modelId: finalPayload.metadata?.modelId,
          system: !!streamOptions.system,
          messageCount: streamOptions?.messages?.length,
          temperature: streamOptions.temperature,
          maxTokens: streamOptions.maxTokens,
          toolChoice: streamOptions.toolChoice,
          tools: streamOptions.tools
            ? Object.keys(streamOptions.tools)
            : undefined,
          maxSteps: streamOptions.maxSteps,
        },
      );

      // --- Stream Processing Loop ---
      streamResult = await streamText(streamOptions);

      for await (const part of streamResult.fullStream as AsyncIterable<
        TextStreamPart<any>
      >) {
        if (abortController.signal.aborted) {
          console.log(`AIService: Stream ${interactionId} aborted by signal.`);
          finalFinishReason = "stop";
          throw new Error("Stream aborted by user.");
        }

        switch (part.type) {
          case "text-delta": {
            const chunkPayload = { interactionId, chunk: part.textDelta };
            const chunkResult = await runMiddleware(
              "middleware:interaction:processChunk",
              chunkPayload,
            );
            if (chunkResult !== false) {
              const processedChunk =
                chunkResult &&
                typeof chunkResult === "object" &&
                "chunk" in chunkResult
                  ? chunkResult.chunk
                  : part.textDelta;
              // Append chunk to buffer in store
              useInteractionStore
                .getState()
                .appendInteractionResponseChunk(interactionId, processedChunk);
              emitter.emit("interaction:stream_chunk", {
                interactionId,
                chunk: processedChunk,
              });
            }
            break;
          }
          case "tool-call": {
            // Store the raw tool call part as a JSON string
            const callString = JSON.stringify(part);
            currentToolCallStrings.push(callString);
            // Update interaction metadata in state immediately
            useInteractionStore
              .getState()
              ._updateInteractionInState(interactionId, {
                metadata: {
                  toolCalls: [...currentToolCallStrings], // Pass the updated array
                },
              });
            console.log(
              `[AIService] Tool call observed: ${part.toolName}`,
              part.args,
            );
            break;
          }
          case "tool-result": {
            // Store the raw tool result part as a JSON string
            const resultString = JSON.stringify(part);
            currentToolResultStrings.push(resultString);
            // Update interaction metadata in state immediately
            useInteractionStore
              .getState()
              ._updateInteractionInState(interactionId, {
                metadata: {
                  toolResults: [...currentToolResultStrings], // Pass the updated array
                },
              });
            console.log(
              `[AIService] Tool result observed for ${part.toolName} (Call ID: ${part.toolCallId})`,
              part.result,
            );
            break;
          }
          case "finish":
            console.log("[AIService] Stream finish part received:", part);
            finalFinishReason = part.finishReason;
            finalUsage = part.usage;
            finalProviderMetadata = part.providerMetadata;
            break;
          case "error":
            console.error("[AIService] Stream error part:", part.error);
            finalFinishReason = "error";
            throw new Error(
              `AI Stream Error: ${part.error instanceof Error ? part.error.message : part.error}`,
            );
          // Ignore other part types for now
          case "reasoning":
          case "reasoning-signature":
          case "redacted-reasoning":
          case "source":
          case "file":
          case "tool-call-streaming-start":
          case "tool-call-delta":
          case "step-start":
          case "step-finish":
            break;
        }
      }
      // --- End Stream Processing Loop ---

      if (abortController.signal.aborted) {
        finalFinishReason = "stop";
        throw new Error("Stream aborted by user.");
      }

      // Handle cases where the stream ends without a 'finish' part
      if (finalFinishReason === undefined) {
        console.warn(
          `[AIService] Stream loop finished for ${interactionId} without receiving a 'finish' part. Inferring reason.`,
        );
        // Infer finish reason based on content or tool calls
        const finalBuffer =
          useInteractionStore.getState().activeStreamBuffers[interactionId] ||
          "";
        if (currentToolCallStrings.length > 0) {
          finalFinishReason = "tool-calls";
        } else if (finalBuffer.trim()) {
          finalFinishReason = "stop"; // Assume normal stop if content exists
        } else {
          finalFinishReason = "other"; // Unknown reason if no content/tools
        }
      }
    } catch (error: unknown) {
      console.error(
        `AIService: Error during interaction ${interactionId}:`,
        error,
      );
      const isAbort =
        error instanceof Error && error.message === "Stream aborted by user.";
      // Set finish reason if not already set by an error part
      finalFinishReason = finalFinishReason ?? (isAbort ? "stop" : "error");
      finalErrorMessage = isAbort
        ? undefined // No error message for user abort
        : error instanceof Error
          ? error.message
          : String(error);

      if (isAbort) {
        console.log(`AIService: Interaction ${interactionId} cancelled.`);
        toast.info("Interaction cancelled.");
      } else {
        toast.error(`AI Interaction Error: ${finalErrorMessage}`);
      }
    } finally {
      // --- Finalization Logic ---
      this.activeStreams.delete(interactionId);
      const finalBufferedContent =
        useInteractionStore.getState().activeStreamBuffers[interactionId] || "";

      // Determine final status based on finish reason and content
      switch (finalFinishReason) {
        case "stop":
        case "length": // Treat length limit as completed
        case "tool-calls": // Treat tool calls finish as completed
          finalStatus = "COMPLETED";
          break;
        case "error":
          finalStatus = "ERROR";
          break;
        case "other": // Handle unknown/other reasons
        default:
          // If there's content or tool activity, consider it completed but log warning
          if (
            finalBufferedContent.trim() ||
            currentToolCallStrings.length > 0
          ) {
            finalStatus = "COMPLETED";
            console.warn(
              `[AIService] Interaction ${interactionId} finished with reason '${finalFinishReason || "unknown"}', but content/tools exist. Marking COMPLETED.`,
            );
          } else {
            // If no content/tools and unknown reason, mark as warning
            finalStatus = "WARNING";
            finalErrorMessage =
              finalErrorMessage ?? "Stream ended unexpectedly without output.";
            console.warn(
              `[AIService] Interaction ${interactionId} finished with reason '${finalFinishReason || "unknown"}' and no content/tools. Marking WARNING.`,
            );
          }
          break;
      }

      // Prepare final updates for the interaction object
      const currentInteractionMetadata =
        useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId)?.metadata ||
        interactionData.metadata; // Fallback to initial metadata

      const finalUpdates: Partial<Interaction> = {
        status: finalStatus,
        endedAt: new Date(),
        response: finalBufferedContent, // Set final response from buffer
        metadata: {
          ...currentInteractionMetadata, // Start with existing metadata
          // Add usage info if available
          ...(finalUsage && {
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.totalTokens,
          }),
          // Add provider metadata if available
          ...(finalProviderMetadata && {
            providerMetadata: finalProviderMetadata,
          }),
          // Add error message if status is ERROR or WARNING
          ...((finalStatus === "ERROR" || finalStatus === "WARNING") && {
            error: finalErrorMessage,
          }),
          // Store final tool calls/results as JSON strings
          toolCalls: currentToolCallStrings,
          toolResults: currentToolResultStrings,
          // Ensure basic file info (without content) is preserved
          attachedFiles: interactionData.metadata.attachedFiles?.map(
            // @ts-expect-error Do not remove !
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            ({ contentBase64, contentText, ...rest }) => rest,
          ),
        },
      };

      // Update state synchronously and remove from streaming list/buffer
      useInteractionStore
        .getState()
        ._updateInteractionInState(interactionId, finalUpdates);
      useInteractionStore.getState()._removeStreamingId(interactionId);

      // Persist the final state asynchronously
      const finalInteractionState = useInteractionStore
        .getState()
        .interactions.find((i) => i.id === interactionId);

      if (finalInteractionState) {
        useInteractionStore
          .getState()
          .updateInteractionAndPersist({ ...finalInteractionState })
          .catch((e) => {
            console.error(
              `AIService: Failed final persistence for ${interactionId}`,
              e,
            );
          });
      } else {
        console.error(
          `AIService: CRITICAL - Could not find final state for interaction ${interactionId} to persist after updates. State might be inconsistent.`,
        );
      }

      let parsedToolCalls: ToolCallPart[] = [];
      let parsedToolResults: ToolResultPart[] = [];
      try {
        parsedToolCalls = currentToolCallStrings.map((s) => JSON.parse(s));
        parsedToolResults = currentToolResultStrings.map((s) => JSON.parse(s));
      } catch (e) {
        console.error(
          `[AIService] Failed to parse tool strings for event emitter:`,
          e,
        );
      }

      emitter.emit("interaction:completed", {
        interactionId,
        status: finalStatus,
        error: finalErrorMessage ?? undefined,
        toolCalls: parsedToolCalls,
        toolResults: parsedToolResults,
      });
      console.log(
        `AIService: Finalized interaction ${interactionId} with status ${finalStatus}.`,
      );
      // --- End Finalization Logic ---
    }
    return interactionId;
  }

  static stopInteraction(interactionId: string) {
    const controller = this.activeStreams.get(interactionId);
    const interactionStoreActions = useInteractionStore.getState();

    if (controller && !controller.signal.aborted) {
      console.log(`AIService: Aborting interaction ${interactionId}...`);
      controller.abort(); // This will trigger the finally block in startInteraction
    } else {
      console.log(
        `AIService: No active controller found or already aborted for interaction ${interactionId}. Attempting store cleanup if needed.`,
      );
      // If the stream was already aborted/finished but the state wasn't cleaned up
      const interaction = interactionStoreActions.interactions.find(
        (i) => i.id === interactionId,
      );
      if (interaction && interaction.status === "STREAMING") {
        console.warn(
          `AIService: Forcing CANCELLED status for interaction ${interactionId} found in STREAMING state without active controller.`,
        );

        const finalBufferedContent =
          interactionStoreActions.activeStreamBuffers[interactionId] || "";

        const finalUpdates: Partial<Interaction> = {
          status: "CANCELLED", // Use CANCELLED status
          endedAt: new Date(),
          response: finalBufferedContent,
          metadata: {
            ...(interaction.metadata || {}),
            error: "Manually stopped (controller missing)",
          },
        };

        interactionStoreActions._updateInteractionInState(
          interactionId,
          finalUpdates,
        );
        interactionStoreActions._removeStreamingId(interactionId); // Clean up buffer/list

        const finalInteractionState = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);
        if (finalInteractionState) {
          interactionStoreActions
            .updateInteractionAndPersist({ ...finalInteractionState })
            .catch((e) => {
              console.error(
                `AIService: Failed persistence for forced cancel of ${interactionId}`,
                e,
              );
            });
        }
      }
    }
  }
}
