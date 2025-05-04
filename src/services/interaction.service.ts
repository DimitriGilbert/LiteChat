// src/services/interaction.service.ts
// FULL FILE
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type {
  Interaction,
  InteractionStatus,
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
  // Add map to store first chunk timestamps and start times
  _firstChunkTimestamps: new Map<string, number>(),
  _interactionStartTimes: new Map<string, number>(),

  async startInteraction(
    prompt: PromptObject,
    conversationId: string,
    initiatingTurnData: PromptTurnObject,
  ): Promise<string | null> {
    console.log(
      "[InteractionService] startInteraction called",
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
    // Clear any previous timestamps for this ID
    this._firstChunkTimestamps.delete(interactionId);
    this._interactionStartTimes.delete(interactionId);

    const interactionStoreState = useInteractionStore.getState();
    const currentInteractions = interactionStoreState.interactions;
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

    const startTime = performance.now(); // Record start time
    this._interactionStartTimes.set(interactionId, startTime);

    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
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
      },
      index: newIndex,
      parentId: parentId,
    };

    // 3. Update State & Persistence (Initial)
    interactionStoreState._addInteractionToState(interactionData);
    interactionStoreState._addStreamingId(interactionId);
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
      );
      return null;
    }
    console.log(
      `[InteractionService] Using model instance for ${targetModelId}`,
    );

    // Prepare Tools
    const allRegisteredTools = useControlRegistryStore
      .getState()
      .getRegisteredTools();
    const enabledToolNames = finalPrompt.metadata?.enabledTools ?? [];

    const toolsWithExecute = enabledToolNames.reduce(
      (acc, name) => {
        const toolInfo = allRegisteredTools[name];
        if (toolInfo?.implementation) {
          const toolDefinition: Tool<any> = { ...toolInfo.definition };
          toolDefinition.execute = async (args: any) => {
            // VFS Readiness Check using forced initialization
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
              console.log(
                `[InteractionService Tool Execute] Ensuring VFS ready for key "${targetVfsKey}"...`,
              );
              // Force initialize VFS for the required key
              // Wrap in try...catch as initializeVFS now throws
              fsInstance = await useVfsStore
                .getState()
                .initializeVFS(targetVfsKey, { force: true });

              console.log(
                `[InteractionService Tool Execute] VFS ready for key "${targetVfsKey}".`,
              );
            } catch (initError: any) {
              console.error(
                `[InteractionService Tool Execute] VFS initialization error for key "${targetVfsKey}":`,
                initError,
              );
              // Return error structure if VFS fails
              return {
                _isError: true,
                error: `Filesystem error: ${initError.message}`,
              };
            }

            // Execute Original Implementation, passing the fsInstance
            try {
              const contextSnapshot = getContextSnapshot();
              const parsedArgs = toolInfo.definition.parameters.parse(args);
              const implementation: ToolImplementation<any> =
                toolInfo.implementation!;
              // Pass fsInstance via context
              const contextWithFs = { ...contextSnapshot, fsInstance };

              return await implementation(parsedArgs, contextWithFs as any);
            } catch (e) {
              const toolError = e instanceof Error ? e.message : String(e);
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
    );

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
      // Use the wrapped model
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
      ...(Object.keys(toolsWithExecute).length > 0 && {
        tools: toolsWithExecute,
      }),
      toolChoice:
        finalPrompt.toolChoice ??
        (Object.keys(toolsWithExecute).length > 0 ? "auto" : "none"),
      // experimental_middlewares removed
    };

    // 6. Define Callbacks
    const callbacks: AIServiceCallbacks = {
      onChunk: (chunk) => this._handleChunk(interactionId, chunk),
      onToolCall: (toolCall) => this._handleToolCall(interactionId, toolCall),
      onToolResult: (toolResult) =>
        this._handleToolResult(interactionId, toolResult),
      onFinish: (details) => this._handleFinish(interactionId, details),
      onError: (error) => this._handleError(interactionId, error),
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
    } else {
      console.warn(
        `[InteractionService] No active controller found or already aborted for ${interactionId}.`,
      );
      const interactionStoreState = useInteractionStore.getState();
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
      // Middleware might add custom fields here
      reasoning?: string;
    },
  ): void {
    console.log(
      `[InteractionService] Finishing interaction ${interactionId}. Reason: ${details.finishReason}`,
    );
    this._finalizeInteraction(interactionId, "COMPLETED", undefined, details);
  },

  _handleError(interactionId: string, error: Error): void {
    console.error(
      `[InteractionService] Handling error for interaction ${interactionId}:`,
      error,
    );
    const isAbort = error.name === "AbortError";
    this._finalizeInteraction(
      interactionId,
      isAbort ? "CANCELLED" : "ERROR",
      isAbort ? undefined : error,
    );
  },

  // --- Centralized Finalization Logic ---
  _finalizeInteraction(
    interactionId: string,
    status: InteractionStatus,
    error?: Error,
    finishDetails?: {
      finishReason: FinishReason;
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      // Include reasoning here if middleware adds it
      reasoning?: string;
    },
  ): void {
    const interactionStore = useInteractionStore.getState();
    const currentInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId,
    );
    if (!currentInteraction || currentInteraction.status !== "STREAMING") {
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
    const currentMetadata = currentInteraction.metadata || {};

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
        // Store extracted reasoning
        reasoning: reasoningData,
        // Store timings
        timeToFirstToken: timeToFirstToken,
        generationTime: generationTime,
        ...((status === "ERROR" ||
          status === "WARNING" ||
          status === "CANCELLED") && {
          error: error?.message ?? "Interaction ended unexpectedly.",
        }),
      },
    };

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
