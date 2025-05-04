// src/services/interaction.service.ts
// FULL FILE
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type {
  Interaction,
  InteractionStatus,
  InteractionType, // Import InteractionType
} from "@/types/litechat/interaction";
import { AIService, AIServiceCallbacks } from "./ai.service";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useConversationStore } from "@/store/conversation.store";
import { useVfsStore } from "@/store/vfs.store";
import { useSettingsStore } from "@/store/settings.store";
import { PersistenceService } from "./persistence.service";
import { runMiddleware, getContextSnapshot } from "@/lib/litechat/ai-helpers";
import {
  splitModelId,
  instantiateModelInstance,
} from "@/lib/litechat/provider-helpers";
import { emitter } from "@/lib/litechat/event-emitter";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { z } from "zod";
import {
  type ToolImplementation,
  ModMiddlewareHook,
  ModEvent,
} from "@/types/litechat/modding";
import {
  Tool,
  ToolCallPart,
  ToolResultPart,
  FinishReason,
  LanguageModelUsage,
  ProviderMetadata,
  LanguageModelV1,
  CoreMessage,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import type { fs as FsType } from "@zenfs/core"; // Import FsType

// Define the structure for options passed to executeInteraction
// Remove experimental_middlewares
interface AIServiceCallOptions {
  model: LanguageModelV1;
  messages: CoreMessage[];
  abortSignal: AbortSignal;
  system?: string;
  tools?: Record<string, Tool<any>>;
  toolChoice?:
    | "auto"
    | "none"
    | "required"
    | { type: "tool"; toolName: string };
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  maxSteps?: number;
}

export const InteractionService = {
  _activeControllers: new Map<string, AbortController>(),
  _streamingToolData: new Map<string, { calls: string[]; results: string[] }>(),
  _firstChunkTimestamps: new Map<string, number>(),
  _interactionStartTimes: new Map<string, number>(),

  async startInteraction(
    prompt: PromptObject,
    conversationId: string,
    initiatingTurnData: PromptTurnObject,
    // Add optional interactionType parameter
    interactionType: InteractionType = "message.user_assistant",
  ): Promise<string | null> {
    console.log(
      `[InteractionService] startInteraction called (Type: ${interactionType})`,
      prompt,
      conversationId,
      initiatingTurnData,
    );

    // 1. Run Middleware using enum member
    const startMiddlewareResult = await runMiddleware(
      ModMiddlewareHook.INTERACTION_BEFORE_START,
      { prompt, conversationId },
    );
    if (startMiddlewareResult === false) {
      console.log(
        "[InteractionService] Interaction start cancelled by middleware.",
      );
      return null;
    }
    const finalPrompt =
      startMiddlewareResult && typeof startMiddlewareResult === "object"
        ? (startMiddlewareResult as { prompt: PromptObject }).prompt
        : prompt;

    // 2. Prepare Interaction Record
    const interactionId = nanoid();
    const abortController = new AbortController();
    this._activeControllers.set(interactionId, abortController);
    this._streamingToolData.set(interactionId, { calls: [], results: [] });
    this._firstChunkTimestamps.delete(interactionId);
    this._interactionStartTimes.delete(interactionId);

    const interactionStoreState = useInteractionStore.getState();
    const currentInteractions = interactionStoreState.interactions;
    const conversationInteractions = currentInteractions.filter(
      (i) => i.conversationId === conversationId,
    );
    // Adjust index calculation for title generation (might not need display index)
    const newIndex =
      interactionType === "conversation.title_generation"
        ? -1 // Assign a special index or handle differently
        : conversationInteractions.reduce(
            (max, i) => Math.max(max, i.index),
            -1,
          ) + 1;
    const parentId =
      interactionType === "conversation.title_generation"
        ? null // Title generation doesn't have a direct parent in the chat flow
        : conversationInteractions.length > 0
          ? conversationInteractions[conversationInteractions.length - 1].id
          : null;

    const startTime = performance.now(); // Record start time
    this._interactionStartTimes.set(interactionId, startTime);

    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: interactionType, // Use the provided type
      prompt: { ...initiatingTurnData },
      response: null,
      status: "STREAMING",
      startedAt: new Date(), // Use current Date for DB
      endedAt: null,
      metadata: {
        ...(finalPrompt.metadata || {}),
        toolCalls: [],
        toolResults: [],
        reasoning: undefined, // Initialize reasoning
        timeToFirstToken: undefined, // Initialize timing
        generationTime: undefined, // Initialize timing
        // Add isTitleGeneration flag if type matches
        isTitleGeneration: interactionType === "conversation.title_generation",
      },
      index: newIndex,
      parentId: parentId,
    };

    // 3. Update State & Persistence (Initial)
    // Only add to visible interactions if it's not title generation
    if (interactionType !== "conversation.title_generation") {
      interactionStoreState._addInteractionToState(interactionData);
      interactionStoreState._addStreamingId(interactionId);
    } else {
      // For title generation, maybe just track the streaming ID without adding to the main list?
      // Or add it but filter it out in the UI layer. Let's add it for now for consistency.
      interactionStoreState._addInteractionToState(interactionData);
      interactionStoreState._addStreamingId(interactionId);
      console.log(
        `[InteractionService] Added title generation interaction ${interactionId} to state.`,
      );
    }
    PersistenceService.saveInteraction({ ...interactionData }).catch((e) => {
      console.error(
        `[InteractionService] Failed initial persistence for ${interactionId}`,
        e,
      );
    });

    // 4. Emit Event using enum member
    emitter.emit(ModEvent.INTERACTION_STARTED, {
      interactionId,
      conversationId,
      type: interactionData.type,
    });

    // 5. Prepare AI Call Options - Get Specific Model Instance
    const targetModelId = finalPrompt.metadata?.modelId;
    if (!targetModelId) {
      this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error("No model ID specified in prompt metadata."),
        interactionType, // Pass type
      );
      return null;
    }

    const { providerId, modelId: specificModelId } =
      splitModelId(targetModelId);
    if (!providerId || !specificModelId) {
      this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error(`Invalid combined model ID format: ${targetModelId}`),
        interactionType, // Pass type
      );
      return null;
    }

    const providerConfig = useProviderStore
      .getState()
      .dbProviderConfigs.find((p) => p.id === providerId);
    if (!providerConfig) {
      this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error(`Provider configuration not found for ID: ${providerId}`),
        interactionType, // Pass type
      );
      return null;
    }

    const apiKey = useProviderStore.getState().getApiKeyForProvider(providerId);
    const modelInstance = instantiateModelInstance(
      providerConfig,
      specificModelId,
      apiKey,
    );

    if (!modelInstance) {
      this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error(
          `Failed to instantiate model instance for ${targetModelId} from provider ${providerConfig.name}`,
        ),
        interactionType, // Pass type
      );
      return null;
    }
    console.log(
      `[InteractionService] Using model instance for ${targetModelId}`,
    );

    // Prepare Tools (Skip for title generation)
    const toolsWithExecute =
      interactionType !== "conversation.title_generation"
        ? (finalPrompt.metadata?.enabledTools ?? []).reduce(
            (acc, name) => {
              const allRegisteredTools = useControlRegistryStore
                .getState()
                .getRegisteredTools();
              const toolInfo = allRegisteredTools[name];
              if (toolInfo?.implementation) {
                const toolDefinition: Tool<any> = { ...toolInfo.definition };
                toolDefinition.execute = async (args: any) => {
                  const currentConvId =
                    useInteractionStore.getState().currentConversationId;
                  const conversation = currentConvId
                    ? useConversationStore
                        .getState()
                        .getConversationById(currentConvId)
                    : null;
                  const targetVfsKey = conversation?.projectId ?? "orphan";
                  let fsInstance: typeof FsType | undefined;
                  try {
                    fsInstance = await useVfsStore
                      .getState()
                      .initializeVFS(targetVfsKey, { force: true });
                  } catch (initError: any) {
                    return {
                      _isError: true,
                      error: `Filesystem error: ${initError.message}`,
                    };
                  }
                  try {
                    const contextSnapshot = getContextSnapshot();
                    const parsedArgs =
                      toolInfo.definition.parameters.parse(args);
                    const implementation: ToolImplementation<any> =
                      toolInfo.implementation!;
                    const contextWithFs = { ...contextSnapshot, fsInstance };
                    return await implementation(
                      parsedArgs,
                      contextWithFs as any,
                    );
                  } catch (e) {
                    const toolError =
                      e instanceof Error ? e.message : String(e);
                    if (e instanceof z.ZodError) {
                      return {
                        _isError: true,
                        error: `Invalid arguments: ${e.errors.map((err) => `${err.path.join(".")} (${err.message})`).join(", ")}`,
                      };
                    }
                    return { _isError: true, error: toolError };
                  }
                };
                acc[name] = toolDefinition;
              }
              return acc;
            },
            {} as Record<string, Tool<any>>,
          )
        : undefined;

    const maxSteps =
      finalPrompt.parameters?.maxSteps ??
      useSettingsStore.getState().toolMaxSteps;

    // Instantiate reasoning middleware
    const reasoningMiddleware = extractReasoningMiddleware({
      tagName: "reasoning",
    });

    // Wrap the model instance with the middleware
    const wrappedModel = wrapLanguageModel({
      model: modelInstance,
      middleware: reasoningMiddleware,
    });

    const callOptions: AIServiceCallOptions = {
      model: wrappedModel,
      messages: finalPrompt.messages,
      abortSignal: abortController.signal,
      system: finalPrompt.system,
      temperature: finalPrompt.parameters?.temperature,
      maxTokens: finalPrompt.parameters?.max_tokens,
      topP: finalPrompt.parameters?.top_p,
      topK: finalPrompt.parameters?.top_k,
      presencePenalty: finalPrompt.parameters?.presence_penalty,
      frequencyPenalty: finalPrompt.parameters?.frequency_penalty,
      maxSteps: maxSteps,
      ...(toolsWithExecute &&
        Object.keys(toolsWithExecute).length > 0 && {
          tools: toolsWithExecute,
        }),
      toolChoice:
        finalPrompt.toolChoice ??
        (toolsWithExecute && Object.keys(toolsWithExecute).length > 0
          ? "auto"
          : "none"),
    };

    // 6. Define Callbacks
    const callbacks: AIServiceCallbacks = {
      onChunk: (chunk) => this._handleChunk(interactionId, chunk),
      onToolCall: (toolCall) => this._handleToolCall(interactionId, toolCall),
      onToolResult: (toolResult) =>
        this._handleToolResult(interactionId, toolResult),
      onFinish: (details) =>
        this._handleFinish(interactionId, details, interactionType), // Pass type
      onError: (error) =>
        this._handleError(interactionId, error, interactionType), // Pass type
    };

    // 7. Trigger AIService
    console.log(
      `[InteractionService] Calling AIService.executeInteraction for ${interactionId}`,
    );
    AIService.executeInteraction(interactionId, callOptions, callbacks).catch(
      (execError) => {
        console.error(
          `[InteractionService] Error calling AIService.executeInteraction for ${interactionId}:`,
          execError,
        );
        this._handleError(
          interactionId,
          execError instanceof Error
            ? execError
            : new Error("Failed to start AI execution"),
          interactionType, // Pass type
        );
      },
    );

    return interactionId;
  },

  abortInteraction(interactionId: string): void {
    console.log(`[InteractionService] Aborting interaction ${interactionId}`);
    const controller = this._activeControllers.get(interactionId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      toast.info("Interaction cancelled.");
      // Finalization happens in _handleError when AbortError is caught
    } else {
      console.warn(
        `[InteractionService] No active controller found or already aborted for ${interactionId}.`,
      );
      const interactionStoreState = useInteractionStore.getState();
      const interaction = interactionStoreState.interactions.find(
        (i) => i.id === interactionId,
      );
      if (
        interactionStoreState.streamingInteractionIds.includes(interactionId)
      ) {
        console.warn(
          `[InteractionService] Forcing cleanup for potentially stuck interaction ${interactionId}`,
        );
        this._finalizeInteraction(
          interactionId,
          "CANCELLED",
          new Error("Interaction aborted manually (controller missing)"),
          interaction?.type ?? "message.user_assistant", // Use interaction type if available
        );
      }
    }
  },

  // --- Callback Implementations ---
  async _handleChunk(interactionId: string, chunk: string): Promise<void> {
    // Record timestamp of the very first chunk
    if (!this._firstChunkTimestamps.has(interactionId)) {
      this._firstChunkTimestamps.set(interactionId, performance.now());
    }

    const chunkPayload = { interactionId, chunk };
    // Use enum member for middleware hook name
    const chunkResult = await runMiddleware(
      ModMiddlewareHook.INTERACTION_PROCESS_CHUNK,
      chunkPayload,
    );
    if (chunkResult !== false) {
      const processedChunk =
        chunkResult && typeof chunkResult === "object" && "chunk" in chunkResult
          ? chunkResult.chunk
          : chunk;
      useInteractionStore
        .getState()
        .appendInteractionResponseChunk(interactionId, processedChunk);
      // Use enum member for event name
      emitter.emit(ModEvent.INTERACTION_STREAM_CHUNK, {
        interactionId,
        chunk: processedChunk,
      });
    }
  },

  _handleToolCall(interactionId: string, toolCall: ToolCallPart): void {
    try {
      const callString = JSON.stringify(toolCall);
      const currentData = this._streamingToolData.get(interactionId) || {
        calls: [],
        results: [],
      };
      currentData.calls.push(callString);
      this._streamingToolData.set(interactionId, currentData);
      useInteractionStore.getState()._updateInteractionInState(interactionId, {
        metadata: { toolCalls: [...currentData.calls] },
      });
    } catch (e) {
      console.error(
        `[InteractionService] Failed to process tool call for ${interactionId}:`,
        e,
      );
    }
  },

  _handleToolResult(interactionId: string, toolResult: ToolResultPart): void {
    try {
      const resultString = JSON.stringify(toolResult);
      const currentData = this._streamingToolData.get(interactionId) || {
        calls: [],
        results: [],
      };
      currentData.results.push(resultString);
      this._streamingToolData.set(interactionId, currentData);
      useInteractionStore.getState()._updateInteractionInState(interactionId, {
        metadata: { toolResults: [...currentData.results] },
      });
    } catch (e) {
      console.error(
        `[InteractionService] Failed to process tool result for ${interactionId}:`,
        e,
      );
    }
  },

  _handleFinish(
    interactionId: string,
    details: {
      finishReason: FinishReason;
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      reasoning?: string;
    },
    interactionType: InteractionType, // Receive type
  ): void {
    console.log(
      `[InteractionService] Finishing interaction ${interactionId} (Type: ${interactionType}). Reason: ${details.finishReason}`,
    );
    this._finalizeInteraction(
      interactionId,
      "COMPLETED",
      undefined,
      interactionType, // Pass type
      details,
    );
  },

  _handleError(
    interactionId: string,
    error: Error,
    interactionType: InteractionType, // Receive type
  ): void {
    console.error(
      `[InteractionService] Handling error for interaction ${interactionId} (Type: ${interactionType}):`,
      error,
    );
    const isAbort = error.name === "AbortError";
    this._finalizeInteraction(
      interactionId,
      isAbort ? "CANCELLED" : "ERROR",
      isAbort ? undefined : error,
      interactionType, // Pass type
    );
  },

  // --- Centralized Finalization Logic ---
  _finalizeInteraction(
    interactionId: string,
    status: InteractionStatus,
    error?: Error,
    interactionType: InteractionType = "message.user_assistant", // Default type
    finishDetails?: {
      finishReason: FinishReason;
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      reasoning?: string;
    },
  ): void {
    const interactionStore = useInteractionStore.getState();
    const currentInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId,
    );

    // Check if already finalized or not found (unless it's title gen which might not be in main list yet)
    if (
      !currentInteraction ||
      (currentInteraction.status !== "STREAMING" &&
        interactionType !== "conversation.title_generation")
    ) {
      console.warn(
        `[InteractionService] Interaction ${interactionId} already finalized or not found. Skipping finalization with status ${status}.`,
      );
      this._activeControllers.delete(interactionId);
      this._streamingToolData.delete(interactionId);
      this._interactionStartTimes.delete(interactionId);
      this._firstChunkTimestamps.delete(interactionId);
      return;
    }

    const finalBufferedContent =
      interactionStore.activeStreamBuffers[interactionId] ?? "";
    const toolData = this._streamingToolData.get(interactionId) || {
      calls: [],
      results: [],
    };
    const currentMetadata = currentInteraction?.metadata || {}; // Use optional chaining

    console.log(
      `[InteractionService] Finalizing ${interactionId}. Buffered Content Length: ${finalBufferedContent.length}`,
    );

    // Calculate timings
    const endTime = performance.now();
    const startTime = this._interactionStartTimes.get(interactionId);
    const firstChunkTime = this._firstChunkTimestamps.get(interactionId);
    const generationTime = startTime
      ? Math.round(endTime - startTime)
      : undefined;
    const timeToFirstToken =
      startTime && firstChunkTime
        ? Math.round(firstChunkTime - startTime)
        : undefined;

    // Extract reasoning from finishDetails (added by middleware)
    const reasoningData = finishDetails?.reasoning;

    const finalUpdates: Partial<Omit<Interaction, "id">> = {
      status: status,
      endedAt: new Date(),
      response: finalBufferedContent || null,
      metadata: {
        ...currentMetadata,
        ...(finishDetails?.usage && {
          promptTokens: finishDetails.usage.promptTokens,
          completionTokens: finishDetails.usage.completionTokens,
          totalTokens: finishDetails.usage.totalTokens,
        }),
        ...(finishDetails?.providerMetadata && {
          providerMetadata: finishDetails.providerMetadata,
        }),
        toolCalls: toolData.calls,
        toolResults: toolData.results,
        reasoning: reasoningData,
        timeToFirstToken: timeToFirstToken,
        generationTime: generationTime,
        ...((status === "ERROR" ||
          status === "WARNING" ||
          status === "CANCELLED") && {
          error: error?.message ?? "Interaction ended unexpectedly.",
        }),
      },
    };

    // --- Handle Title Generation Specifics ---
    if (
      interactionType === "conversation.title_generation" &&
      status === "COMPLETED" &&
      finalUpdates.response &&
      typeof finalUpdates.response === "string"
    ) {
      const generatedTitle = finalUpdates.response.trim().replace(/^"|"$/g, ""); // Clean up quotes
      if (generatedTitle && currentInteraction) {
        console.log(
          `[InteractionService] Updating conversation ${currentInteraction.conversationId} title to: "${generatedTitle}"`,
        );
        useConversationStore
          .getState()
          .updateConversation(currentInteraction.conversationId, {
            title: generatedTitle,
          })
          .catch((e) =>
            console.error("Failed to update conversation title:", e),
          );
        // Optionally remove the title generation interaction from state/DB after success?
        // interactionStore._removeInteractionFromState(interactionId);
        // PersistenceService.deleteInteraction(interactionId).catch(e => console.error("Failed to delete title gen interaction:", e));
      }
    }
    // --- End Title Generation Specifics ---

    // Update state (even for title gen, might be useful for debugging)
    interactionStore._updateInteractionInState(interactionId, finalUpdates);
    interactionStore._removeStreamingId(interactionId);

    const finalInteractionState = useInteractionStore
      .getState()
      .interactions.find((i) => i.id === interactionId);

    if (finalInteractionState) {
      console.log(
        `[InteractionService] Persisting final state for ${interactionId}. Response length: ${finalInteractionState.response?.length ?? 0}`,
      );
      PersistenceService.saveInteraction({ ...finalInteractionState }).catch(
        (e) => {
          console.error(
            `[InteractionService] Failed final persistence for ${interactionId}`,
            e,
          );
        },
      );
    } else {
      console.error(
        `[InteractionService] CRITICAL - Could not find final state for interaction ${interactionId} to persist.`,
      );
    }

    let parsedToolCalls: ToolCallPart[] = [];
    let parsedToolResults: ToolResultPart[] = [];
    try {
      parsedToolCalls = toolData.calls.map((s) => JSON.parse(s));
      parsedToolResults = toolData.results.map((s) => JSON.parse(s));
    } catch (e) {
      console.error(
        `[InteractionService] Failed to parse tool strings for event emitter:`,
        e,
      );
    }

    // Use enum member for event name
    emitter.emit(ModEvent.INTERACTION_COMPLETED, {
      interactionId,
      status: status,
      error: error?.message,
      toolCalls: parsedToolCalls,
      toolResults: parsedToolResults,
    });

    // Clean up maps
    this._activeControllers.delete(interactionId);
    this._streamingToolData.delete(interactionId);
    this._interactionStartTimes.delete(interactionId);
    this._firstChunkTimestamps.delete(interactionId);

    console.log(
      `[InteractionService] Finalized interaction ${interactionId} with status ${status}.`,
    );
  },
};
