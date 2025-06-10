// src/services/interaction.service.ts
// FULL FILE
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type {
  Interaction,
  InteractionStatus,
  InteractionType,
} from "@/types/litechat/interaction";
import { AIService, AIServiceCallbacks } from "./ai.service";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useProviderStore } from "@/store/provider.store";
import { useConversationStore } from "@/store/conversation.store";
import { useVfsStore } from "@/store/vfs.store";
import { useSettingsStore } from "@/store/settings.store";
import { usePromptStateStore } from "@/store/prompt.store";
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
  type ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import { interactionEvent } from "@/types/litechat/events/interaction.events";
import {
  type Tool,
  type ToolCallPart,
  type ToolResultPart,
  type FinishReason,
  type LanguageModelUsage,
  type ProviderMetadata,
  type LanguageModelV1,
  type CoreMessage,
} from "ai";
import type { fs } from "@zenfs/core";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { canvasEvent,} from "@/types/litechat/events/canvas.events";
import { ConversationService } from "@/services/conversation.service";

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
  providerOptions?: Record<string, any>;
}

type ToolContext = ReadonlyChatContextSnapshot & {
  fsInstance?: typeof fs;
};

export const InteractionService = {
  _activeControllers: new Map<string, AbortController>(),
  _streamingToolData: new Map<string, { calls: string[]; results: string[] }>(),
  _firstChunkTimestamps: new Map<string, number>(),
  _interactionStartTimes: new Map<string, number>(),
  _pendingRegenerations: new Set<string>(),

  initializeCanvasEventHandlers(): void {
    emitter.on(
      canvasEvent.copyInteractionResponseRequest,
      async (payload) => {
        const { interactionId } = payload;
        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(`Copy failed: Interaction ${interactionId} not found.`);
          console.warn(
            `[InteractionService] Copy request for unknown interaction ${interactionId}`
          );
          return;
        }

        const contentToCopy = interaction.response ?? "";
        if (typeof contentToCopy !== "string" || contentToCopy.trim() === "") {
          toast.info("No response content to copy.");
          return;
        }

        try {
          await navigator.clipboard.writeText(contentToCopy);
          toast.success("Response copied!");
          // Optionally emit another event for UI update if needed, e.g., canvasEvent.interactionResponseCopied
        } catch (err) {
          toast.error("Failed to copy response.");
          console.error("[InteractionService] Error copying response:", err);
        }
      }
    );

    emitter.on(
      canvasEvent.regenerateInteractionRequest,
      async (payload) => {
        const { interactionId } = payload;
        console.log(`[InteractionService] Received regenerateInteractionRequest for ${interactionId}`);

        if (this._pendingRegenerations.has(interactionId)) {
          console.warn(`[InteractionService] Regeneration already pending for ${interactionId}. Ignoring request.`);
          return;
        }

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Regeneration failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Regeneration request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks: is it the last one? Is global streaming off?
        // The module should ideally enforce this via `disabled` state,
        // but double-checking here can be good.
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot regenerate while another response is streaming.");
          return;
        }

        // Check if it's the last interaction on the main spine
        const conversationInteractions = interactionStoreState.interactions.filter(
          (i) => i.conversationId === interaction.conversationId && 
                 i.parentId === null && // Only main spine interactions
                 (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
        ).sort((a, b) => a.index - b.index);
        
        const lastInteractionOnSpine = conversationInteractions.length > 0 
          ? conversationInteractions[conversationInteractions.length - 1] 
          : null;

        if (lastInteractionOnSpine?.id !== interactionId) {
          toast.info("Can only regenerate the last response in the conversation.");
          return;
        }

        try {
          this._pendingRegenerations.add(interactionId);
          console.log(`[InteractionService] Starting ConversationService.regenerateInteraction for ${interactionId}`);
          await ConversationService.regenerateInteraction(interactionId);
          console.log(`[InteractionService] Finished ConversationService.regenerateInteraction for ${interactionId}`);
          // Feedback for starting regeneration might be good, or handled by UI changes
        } catch (error) {
          toast.error(`Failed to regenerate response: ${String(error)}`);
          console.error(
            `[InteractionService] Error regenerating interaction ${interactionId}:`,
            error
          );
        } finally {
          this._pendingRegenerations.delete(interactionId);
        }
      }
    );

    emitter.on(
      canvasEvent.regenerateInteractionWithModelRequest,
      async (payload) => {
        const { interactionId, modelId } = payload;
        console.log(`[InteractionService] Received regenerateInteractionWithModelRequest for ${interactionId} with model ${modelId}`);

        if (this._pendingRegenerations.has(interactionId)) {
          console.warn(`[InteractionService] Regeneration already pending for ${interactionId}. Ignoring request.`);
          return;
        }

        const interaction = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);

        if (!interaction) {
          toast.error(
            `Regeneration failed: Interaction ${interactionId} not found.`
          );
          console.warn(
            `[InteractionService] Regeneration request for unknown interaction ${interactionId}`
          );
          return;
        }

        // Add safety checks: is it the last one? Is global streaming off?
        const interactionStoreState = useInteractionStore.getState();
        const globalStreamingStatus = interactionStoreState.status;
        if (globalStreamingStatus === "streaming") {
          toast.info("Cannot regenerate while another response is streaming.");
          return;
        }

        // Check if it's the last interaction on the main spine
        const conversationInteractions = interactionStoreState.interactions.filter(
          (i) => i.conversationId === interaction.conversationId && 
                 i.parentId === null && // Only main spine interactions
                 (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
        ).sort((a, b) => a.index - b.index);
        
        const lastInteractionOnSpine = conversationInteractions.length > 0 
          ? conversationInteractions[conversationInteractions.length - 1] 
          : null;

        if (lastInteractionOnSpine?.id !== interactionId) {
          toast.info("Can only regenerate the last response in the conversation.");
          return;
        }

        try {
          this._pendingRegenerations.add(interactionId);
          
          // Store the current model ID to restore later
          const promptState = usePromptStateStore.getState();
          const originalModelId = promptState.modelId;
          
          console.log(`[InteractionService] Temporarily setting model to ${modelId} for regeneration`);
          
          // Temporarily set the selected model for regeneration
          promptState.setModelId(modelId);
          
          try {
            console.log(`[InteractionService] Starting ConversationService.regenerateInteraction for ${interactionId} with model ${modelId}`);
            await ConversationService.regenerateInteraction(interactionId);
            console.log(`[InteractionService] Finished ConversationService.regenerateInteraction for ${interactionId}`);
          } finally {
            // Always restore the original model ID, whether success or failure
            console.log(`[InteractionService] Restoring original model ${originalModelId}`);
            promptState.setModelId(originalModelId);
          }
          
        } catch (error) {
          toast.error(`Failed to regenerate response: ${String(error)}`);
          console.error(
            `[InteractionService] Error regenerating interaction ${interactionId}:`,
            error
          );
        } finally {
          this._pendingRegenerations.delete(interactionId);
        }
      }
    );

    // Handler for copyCodeBlockRequest
    emitter.on(
      canvasEvent.copyCodeBlockRequest,
      async (payload) => {
        const { content, interactionId, codeBlockId, language } = payload;
        if (!content || content.trim() === "") {
          toast.info("No code to copy.");
          return;
        }
        try {
          await navigator.clipboard.writeText(content);
          toast.success(`Code block ${language ? `(${language}) ` : ''}copied!`);
          console.log(
            `[InteractionService] Code block copied. InteractionID: ${interactionId}, CodeBlockID: ${codeBlockId}, Language: ${language}`
          );
          // Optionally emit canvasEvent.codeBlockCopied if specific UI feedback is needed beyond toast
        } catch (err) {
          toast.error("Failed to copy code block.");
          console.error("[InteractionService] Error copying code block:", err);
        }
      }
    );

    // TODO: Add listeners for other canvas events like regenerate, rate, etc.
    // emitter.on(canvasEvent.regenerateInteractionRequest, async (payload) => { ... });
    // emitter.on(canvasEvent.rateInteractionRequest, async (payload) => { ... });
  },

  async startInteraction(
    prompt: PromptObject,
    conversationId: string,
    initiatingTurnData: PromptTurnObject,
    interactionType: InteractionType = "message.user_assistant"
  ): Promise<Interaction | null> {
    console.log(
      `[InteractionService] startInteraction called (Type: ${interactionType})`,
      prompt,
      conversationId,
      initiatingTurnData
    );

    const startMiddlewareResult = await runMiddleware(
      ModMiddlewareHook.INTERACTION_BEFORE_START,
      { prompt, conversationId }
    );
    if (startMiddlewareResult === false) {
      console.log(
        "[InteractionService] Interaction start cancelled by middleware."
      );
      return null;
    }
    const finalPrompt =
      startMiddlewareResult && typeof startMiddlewareResult === "object"
        ? (startMiddlewareResult as { prompt: PromptObject }).prompt
        : prompt;

    const interactionId = nanoid();
    const abortController = new AbortController();
    this._activeControllers.set(interactionId, abortController);
    this._streamingToolData.set(interactionId, { calls: [], results: [] });
    this._firstChunkTimestamps.delete(interactionId);
    this._interactionStartTimes.delete(interactionId);

    const interactionStoreState = useInteractionStore.getState();
    const currentInteractions = interactionStoreState.interactions;
    const conversationInteractions = currentInteractions.filter(
      (i) => i.conversationId === conversationId
    );
    const newIndex =
      interactionType === "conversation.title_generation"
        ? -1
        : conversationInteractions.reduce(
            (max, i) => Math.max(max, i.index),
            -1
          ) + 1;
    
    // Default parentId for new interactions on the main spine should be null.
    // It will only be set if this interaction is explicitly a child (e.g. during regeneration updates)
    const defaultParentId = null; 

    const startTime = performance.now();
    this._interactionStartTimes.set(interactionId, startTime);

    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: interactionType,
      prompt: { ...initiatingTurnData },
      response: null,
      status: "STREAMING",
      startedAt: new Date(),
      endedAt: null,
      metadata: {
        ...(finalPrompt.metadata || {}),
        toolCalls: [],
        toolResults: [],
        reasoning: undefined,
        timeToFirstToken: undefined,
        generationTime: undefined,
        isTitleGeneration: interactionType === "conversation.title_generation",
      },
      index: newIndex,
      parentId: defaultParentId,
    };

    if (interactionType !== "conversation.title_generation") {
      interactionStoreState._addInteractionToState(interactionData);
      interactionStoreState._addStreamingId(interactionId);
    } else {
      interactionStoreState._addInteractionToState(interactionData);
      interactionStoreState._addStreamingId(interactionId);
      console.log(
        `[InteractionService] Added title generation interaction ${interactionId} to state.`
      );
    }
    PersistenceService.saveInteraction({ ...interactionData }).catch((e) => {
      console.error(
        `[InteractionService] Failed initial persistence for ${interactionId}`,
        e
      );
    });

    emitter.emit(interactionEvent.started, {
      interactionId,
      conversationId,
      type: interactionData.type,
    });

    const targetModelId = finalPrompt.metadata?.modelId;
    if (!targetModelId) {
      this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error("No model ID specified in prompt metadata."),
        interactionType
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
        interactionType
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
        interactionType
      );
      return null;
    }

    const apiKey = useProviderStore.getState().getApiKeyForProvider(providerId);
    const modelInstance = instantiateModelInstance(
      providerConfig,
      specificModelId,
      apiKey
    );

    if (!modelInstance) {
      this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error(
          `Failed to instantiate model instance ${targetModelId} from provider ${providerConfig.name}`
        ),
        interactionType
      );
      return null;
    }
    console.log(
      `[InteractionService] Using model instance for ${targetModelId}`
    );

    const toolsWithExecute =
      interactionType !== "conversation.title_generation"
        ? (finalPrompt.metadata?.enabledTools ?? []).reduce((acc, name) => {
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

                let targetVfsKey: string;
                if (conversation && conversation.projectId) {
                  if (typeof conversation.projectId === 'string') {
                    targetVfsKey = conversation.projectId;
                  } else {
                    console.warn(`[InteractionService] conversation.projectId for conversation ${currentConvId} is not a string (type: ${typeof conversation.projectId}). Defaulting VFS key to "orphan". Value:`, conversation.projectId);
                    targetVfsKey = "orphan";
                  }
                } else {
                  targetVfsKey = "orphan";
                }
                
                let fsInstance: typeof fs | undefined | null;
                try {
                  emitter.emit(vfsEvent.initializeVFSRequest, {
                    vfsKey: targetVfsKey,
                    options: { force: true },
                  });
                  await new Promise((resolve) => setTimeout(resolve, 100)); 
                  fsInstance = useVfsStore.getState().fs;
                  if (
                    useVfsStore.getState().configuredVfsKey !== targetVfsKey ||
                    !fsInstance
                  ) {
                    throw new Error(
                      `Filesystem for key "${targetVfsKey}" not ready after request.`
                    );
                  }
                } catch (initError: any) {
                  return {
                    _isError: true,
                    error: `Filesystem error: ${initError.message}`,
                  };
                }
                try {
                  const contextSnapshot = getContextSnapshot();
                  const parsedArgs = toolInfo.definition.parameters.parse(args);
                  const implementation: ToolImplementation<any> =
                    toolInfo.implementation!;
                  const contextWithFs: ToolContext = {
                    ...contextSnapshot,
                    fsInstance,
                  };
                  return await implementation(parsedArgs, contextWithFs);
                } catch (e) {
                  const toolError = e instanceof Error ? e.message : String(e);
                  if (e instanceof z.ZodError) {
                    return {
                      _isError: true,
                      error: `Invalid arguments: ${e.errors
                        .map((err) => `${err.path.join(".")} (${err.message})`)
                        .join(", ")}`,
                    };
                  }
                  return { _isError: true, error: toolError };
                }
              };
              acc[name] = toolDefinition;
            }
            return acc;
          }, {} as Record<string, Tool<any>>)
        : undefined;

    const maxSteps =
      finalPrompt.parameters?.maxSteps ??
      useSettingsStore.getState().toolMaxSteps;

    // Prepare options for AIService.executeInteraction
    const callOptions: AIServiceCallOptions = {
      model: modelInstance,
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
      ...(finalPrompt.parameters?.providerOptions && {
        providerOptions: finalPrompt.parameters.providerOptions,
      }),
      toolChoice: finalPrompt.toolChoice
    };

    // Define callbacks within startInteraction to capture interactionId and interactionType in scope
    const callbacks: AIServiceCallbacks = {
      onChunk: (chunk) => this._handleChunk(interactionId, chunk),
      onReasoningChunk: (chunk) =>
        this._handleReasoningChunk(interactionId, chunk),
      onToolCall: (toolCall) => this._handleToolCall(interactionId, toolCall),
      onToolResult: (toolResult) =>
        this._handleToolResult(interactionId, toolResult),
      onFinish: (details) =>
        this._handleFinish(interactionId, details, interactionType),
      onError: (error) =>
        this._handleError(interactionId, error, interactionType),
    };

    console.log(
      `[InteractionService] Calling AIService.executeInteraction for ${interactionId}`
    );
    AIService.executeInteraction(interactionId, callOptions, callbacks).catch(
      (execError) => {
        console.error(
          `[InteractionService] Error during AIService.executeInteraction for ${interactionId}:`,
          execError
        );
        const currentInteractionState = useInteractionStore.getState().interactions.find(i => i.id === interactionId);
        if (currentInteractionState && currentInteractionState.status === "STREAMING") {
            this._finalizeInteraction(
            interactionId,
            "ERROR",
            execError instanceof Error ? execError : new Error(String(execError)),
            interactionType
          );
        }
      }
    );

    return interactionData; 
  },

  abortInteraction(interactionId: string): void {
    console.log(`[InteractionService] Aborting interaction ${interactionId}`);
    const controller = this._activeControllers.get(interactionId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      toast.info("Interaction cancelled.");
    } else {
      console.warn(
        `[InteractionService] No active controller found or already aborted for ${interactionId}.`
      );
      const interactionStoreState = useInteractionStore.getState();
      const interaction = interactionStoreState.interactions.find(
        (i) => i.id === interactionId
      );
      if (
        interactionStoreState.streamingInteractionIds.includes(interactionId)
      ) {
        console.warn(
          `[InteractionService] Forcing cleanup for potentially stuck interaction ${interactionId}`
        );
        this._finalizeInteraction(
          interactionId,
          "CANCELLED",
          new Error("Interaction aborted manually (controller missing)"),
          interaction?.type ?? "message.user_assistant"
        );
      }
    }
  },

  async _handleChunk(interactionId: string, chunk: string): Promise<void> {
    if (!this._firstChunkTimestamps.has(interactionId)) {
      this._firstChunkTimestamps.set(interactionId, performance.now());
    }
    const chunkPayload = { interactionId, chunk };
    const chunkResult = await runMiddleware(
      ModMiddlewareHook.INTERACTION_PROCESS_CHUNK,
      chunkPayload
    );
    if (chunkResult !== false) {
      const processedChunk =
        chunkResult && typeof chunkResult === "object" && "chunk" in chunkResult
          ? chunkResult.chunk
          : chunk;
      useInteractionStore
        .getState()
        .appendInteractionResponseChunk(interactionId, processedChunk);
      emitter.emit(interactionEvent.streamChunk, {
        interactionId,
        chunk: processedChunk,
      });
    }
  },

  _handleReasoningChunk(interactionId: string, chunk: string): void {
    useInteractionStore.getState().appendReasoningChunk(interactionId, chunk);
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
        e
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
        e
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
    interactionType: InteractionType
  ): void {
    console.log(
      `[InteractionService] Finishing interaction ${interactionId} (Type: ${interactionType}). Reason: ${details.finishReason}`
    );
    this._finalizeInteraction(
      interactionId,
      "COMPLETED",
      undefined,
      interactionType,
      details
    );
  },

  _handleError(
    interactionId: string,
    error: Error,
    interactionType: InteractionType
  ): void {
    console.error(
      `[InteractionService] Handling error for interaction ${interactionId} (Type: ${interactionType}):`,
      error
    );
    const isAbort = error.name === "AbortError";
    this._finalizeInteraction(
      interactionId,
      isAbort ? "CANCELLED" : "ERROR",
      isAbort ? undefined : error,
      interactionType
    );
  },

  _finalizeInteraction(
    interactionId: string,
    status: InteractionStatus,
    error?: Error,
    interactionType: InteractionType = "message.user_assistant",
    finishDetails?: {
      finishReason: FinishReason;
      usage?: LanguageModelUsage;
      providerMetadata?: ProviderMetadata;
      reasoning?: string;
    }
  ): void {
    const interactionStore = useInteractionStore.getState();
    const currentInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId
    );

    if (
      !currentInteraction ||
      (currentInteraction.status !== "STREAMING" &&
        interactionType !== "conversation.title_generation")
    ) {
      console.warn(
        `[InteractionService] Interaction ${interactionId} already finalized or not found. Skipping finalization with status ${status}.`
      );
      this._activeControllers.delete(interactionId);
      this._streamingToolData.delete(interactionId);
      this._interactionStartTimes.delete(interactionId);
      this._firstChunkTimestamps.delete(interactionId);
      return;
    }

    const finalBufferedContent =
      interactionStore.activeStreamBuffers[interactionId] ?? "";
    const finalReasoningContent =
      interactionStore.activeReasoningBuffers[interactionId] ?? "";
    const toolData = this._streamingToolData.get(interactionId) || {
      calls: [],
      results: [],
    };
    const currentMetadata = currentInteraction?.metadata || {};

    console.log(
      `[InteractionService] Finalizing ${interactionId}. Buffered Content Length: ${finalBufferedContent.length}, Reasoning Length: ${finalReasoningContent.length}`
    );

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

    const definitiveReasoning =
      finishDetails?.reasoning ?? finalReasoningContent;

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
        reasoning: definitiveReasoning || undefined,
        timeToFirstToken: timeToFirstToken,
        generationTime: generationTime,
        ...((status === "ERROR" ||
          status === "WARNING" ||
          status === "CANCELLED") && {
          error: error?.message ?? "Interaction ended unexpectedly.",
        }),
      },
    };

    if (
      interactionType === "conversation.title_generation" &&
      status === "COMPLETED" &&
      finalUpdates.response &&
      typeof finalUpdates.response === "string"
    ) {
      const generatedTitle = finalUpdates.response.trim().replace(/^"|"$/g, "");
      if (generatedTitle && currentInteraction) {
        console.log(
          `[InteractionService] Updating conversation ${currentInteraction.conversationId} title to: "${generatedTitle}"`
        );
        emitter.emit(conversationEvent.updateConversationRequest, {
          id: currentInteraction.conversationId,
          updates: { title: generatedTitle },
        });
      }
    }

    interactionStore._updateInteractionInState(interactionId, finalUpdates);
    interactionStore._removeStreamingId(interactionId);

    const finalInteractionState = useInteractionStore
      .getState()
      .interactions.find((i) => i.id === interactionId);

    if (finalInteractionState) {
      console.log(
        `[InteractionService] Persisting final state for ${interactionId}. Response length: ${
          finalInteractionState.response?.length ?? 0
        }`
      );
      PersistenceService.saveInteraction({ ...finalInteractionState }).catch(
        (e) => {
          console.error(
            `[InteractionService] Failed final persistence for ${interactionId}`,
            e
          );
        }
      );
    } else {
      console.error(
        `[InteractionService] CRITICAL - Could not find final state for interaction ${interactionId} to persist.`
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
        e
      );
    }

    emitter.emit(interactionEvent.completed, {
      interactionId,
      status: status,
      error: error?.message,
      toolCalls: parsedToolCalls,
      toolResults: parsedToolResults,
    });

    this._activeControllers.delete(interactionId);
    this._streamingToolData.delete(interactionId);
    this._interactionStartTimes.delete(interactionId);
    this._firstChunkTimestamps.delete(interactionId);

    console.log(
      `[InteractionService] Finalized interaction ${interactionId} with status ${status}.`
    );
  },
};
