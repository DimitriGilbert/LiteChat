// src/services/interaction.service.ts
// Full file content after implementing Step 3 and Step 5, and refining persistence calls in Step 7
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
import { PersistenceService } from "./persistence.service"; // Import PersistenceService
import { runMiddleware, getContextSnapshot } from "@/lib/litechat/ai-helpers";
import { emitter } from "@/lib/litechat/event-emitter";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { z } from "zod";
import type { ToolImplementation } from "@/types/litechat/modding";
import type {
  Tool,
  ToolCallPart,
  ToolResultPart,
  FinishReason,
  LanguageModelUsage,
  ProviderMetadata,
  LanguageModelV1, // Import LanguageModelV1
  CoreMessage, // Import CoreMessage
} from "ai";

// Define the structure for options passed to executeInteraction
interface AIServiceCallOptions {
  model: LanguageModelV1; // Use imported type
  messages: CoreMessage[]; // Use imported type
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
  // Map to store AbortControllers for active interactions
  _activeControllers: new Map<string, AbortController>(),
  // Map to store accumulating tool calls/results as strings during streaming
  _streamingToolData: new Map<string, { calls: string[]; results: string[] }>(),

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

    // 1. Run Middleware
    const startMiddlewareResult = await runMiddleware(
      "middleware:interaction:beforeStart",
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
    this._streamingToolData.set(interactionId, { calls: [], results: [] }); // Initialize tool data storage

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

    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant", // Assuming default type
      prompt: { ...initiatingTurnData }, // Store the original turn data
      response: null,
      status: "STREAMING",
      startedAt: new Date(),
      endedAt: null,
      metadata: {
        ...(finalPrompt.metadata || {}), // Use metadata from final prompt
        toolCalls: [], // Initialize as empty arrays
        toolResults: [], // Initialize as empty arrays
      },
      index: newIndex,
      parentId: parentId,
    };

    // 3. Update State & Persistence (Initial)
    interactionStoreState._addInteractionToState(interactionData);
    interactionStoreState._addStreamingId(interactionId);
    // Call PersistenceService directly for initial save
    PersistenceService.saveInteraction({ ...interactionData }).catch((e) => {
      console.error(
        `[InteractionService] Failed initial persistence for ${interactionId}`,
        e,
      );
      // Consider how to handle this failure - maybe revert state?
    });

    // 4. Emit Event
    emitter.emit("interaction:started", {
      interactionId,
      conversationId,
      type: interactionData.type,
    });

    // 5. Prepare AI Call Options
    const modelInstance = useProviderStore
      .getState()
      .getSelectedModel()?.instance;
    if (!modelInstance) {
      this._finalizeInteraction(
        interactionId,
        "ERROR",
        new Error("Selected model instance not available."),
      );
      return null; // Stop if no model
    }

    const allRegisteredTools = useControlRegistryStore
      .getState()
      .getRegisteredTools();
    const enabledToolNames = finalPrompt.metadata?.enabledTools ?? [];

    const toolsWithExecute = enabledToolNames.reduce(
      (acc, name) => {
        const toolInfo = allRegisteredTools[name];
        if (toolInfo?.implementation) {
          const toolDefinition: Tool<any> = { ...toolInfo.definition };
          // Wrap implementation
          toolDefinition.execute = async (args: any) => {
            // VFS Readiness Check
            const currentConvId =
              useInteractionStore.getState().currentConversationId;
            const conversation = currentConvId
              ? useConversationStore
                  .getState()
                  .getConversationById(currentConvId)
              : null;
            const targetVfsKey = conversation?.projectId ?? "orphan";
            let vfsStoreState = useVfsStore.getState();
            if (
              vfsStoreState.configuredVfsKey !== targetVfsKey ||
              !vfsStoreState.fs
            ) {
              console.log(
                `[InteractionService Tool Execute] VFS for key "${targetVfsKey}" not ready. Attempting initialization...`,
              );
              try {
                await useVfsStore.getState().initializeVFS(targetVfsKey);
                vfsStoreState = useVfsStore.getState(); // Re-check state
                if (
                  vfsStoreState.configuredVfsKey !== targetVfsKey ||
                  !vfsStoreState.fs
                ) {
                  throw new Error(
                    `VFS initialization failed or did not configure correctly for key "${targetVfsKey}".`,
                  );
                }
              } catch (initError: any) {
                return {
                  _isError: true,
                  error: `Filesystem error: ${initError.message}`,
                };
              }
            }
            // Execute Original Implementation
            try {
              const contextSnapshot = getContextSnapshot();
              const parsedArgs = toolInfo.definition.parameters.parse(args);
              const implementation: ToolImplementation<any> =
                toolInfo.implementation!;
              return await implementation(parsedArgs, contextSnapshot);
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

    const callOptions: AIServiceCallOptions = {
      model: modelInstance,
      messages: finalPrompt.messages,
      abortSignal: abortController.signal,
      system: finalPrompt.system,
      // Pass parameters directly from the finalPrompt object
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
    // Don't await this, let it run in the background
    AIService.executeInteraction(interactionId, callOptions, callbacks).catch(
      (execError) => {
        // Catch potential synchronous errors from executeInteraction itself
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

    return interactionId; // Return ID immediately
  },

  abortInteraction(interactionId: string): void {
    console.log(`[InteractionService] Aborting interaction ${interactionId}`);
    const controller = this._activeControllers.get(interactionId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      // The AIService will detect the abort signal.
      // The _handleError or _handleFinish callback will be triggered
      // depending on how the SDK handles AbortError.
      // We finalize the state there.
      toast.info("Interaction cancelled.");
    } else {
      console.warn(
        `[InteractionService] No active controller found or already aborted for ${interactionId}.`,
      );
      // Force cleanup if state is inconsistent
      const interactionStoreState = useInteractionStore.getState();
      if (
        interactionStoreState.streamingInteractionIds.includes(interactionId)
      ) {
        console.warn(
          `[InteractionService] Forcing cleanup for potentially stuck interaction ${interactionId}`,
        );
        this._finalizeInteraction(
          interactionId,
          "CANCELLED", // Use CANCELLED status
          new Error("Interaction aborted manually (controller missing)"),
        );
      }
    }
    // Controller is removed from map in _finalizeInteraction
  },

  // --- Callback Implementations ---
  async _handleChunk(interactionId: string, chunk: string): Promise<void> {
    const chunkPayload = { interactionId, chunk };
    const chunkResult = await runMiddleware(
      "middleware:interaction:processChunk",
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
      emitter.emit("interaction:stream_chunk", {
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

      // Update interaction metadata in state immediately (append)
      useInteractionStore.getState()._updateInteractionInState(interactionId, {
        metadata: { toolCalls: [...currentData.calls] }, // Pass copy
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

      // Update interaction metadata in state immediately (append)
      useInteractionStore.getState()._updateInteractionInState(interactionId, {
        metadata: { toolResults: [...currentData.results] }, // Pass copy
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
    // Check if it's an abort error
    const isAbort = error.name === "AbortError";
    this._finalizeInteraction(
      interactionId,
      isAbort ? "CANCELLED" : "ERROR", // Use CANCELLED for abort
      isAbort ? undefined : error, // Pass error only if not abort
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
    },
  ): void {
    const interactionStore = useInteractionStore.getState();
    // Ensure interaction exists before proceeding
    const currentInteraction = interactionStore.interactions.find(
      (i) => i.id === interactionId,
    );
    // If interaction was already finalized (e.g., rapid abort/error), exit
    if (!currentInteraction || currentInteraction.status !== "STREAMING") {
      console.warn(
        `[InteractionService] Interaction ${interactionId} already finalized or not found. Skipping finalization with status ${status}.`,
      );
      // Still ensure cleanup happens if maps contain the ID
      this._activeControllers.delete(interactionId);
      this._streamingToolData.delete(interactionId);
      return;
    }

    const finalBufferedContent =
      interactionStore.activeStreamBuffers[interactionId] ?? "";
    const toolData = this._streamingToolData.get(interactionId) || {
      calls: [],
      results: [],
    };
    const currentMetadata = currentInteraction.metadata || {};

    const finalUpdates: Partial<Omit<Interaction, "id">> = {
      status: status,
      endedAt: new Date(),
      response: finalBufferedContent,
      metadata: {
        ...currentMetadata, // Preserve existing metadata
        ...(finishDetails?.usage && {
          promptTokens: finishDetails.usage.promptTokens,
          completionTokens: finishDetails.usage.completionTokens,
          totalTokens: finishDetails.usage.totalTokens,
        }),
        ...(finishDetails?.providerMetadata && {
          providerMetadata: finishDetails.providerMetadata,
        }),
        // Store final tool calls/results as JSON strings
        toolCalls: toolData.calls,
        toolResults: toolData.results,
        // Add error message if status indicates an issue
        ...((status === "ERROR" ||
          status === "WARNING" ||
          status === "CANCELLED") && {
          error: error?.message ?? "Interaction ended unexpectedly.",
        }),
      },
    };

    // Update state synchronously
    interactionStore._updateInteractionInState(interactionId, finalUpdates);
    interactionStore._removeStreamingId(interactionId); // Cleans up buffer

    // --- Trigger Persistence Directly ---
    const finalInteractionState = interactionStore.interactions.find(
      (i) => i.id === interactionId,
    );
    if (finalInteractionState) {
      // Call PersistenceService directly instead of store action
      PersistenceService.saveInteraction({ ...finalInteractionState }).catch(
        (e) => {
          console.error(
            `[InteractionService] Failed final persistence for ${interactionId}`,
            e,
          );
          // Optionally update UI store error state here
        },
      );
    } else {
      console.error(
        `[InteractionService] CRITICAL - Could not find final state for interaction ${interactionId} to persist.`,
      );
    }
    // --- End Persistence Trigger ---

    // Emit completion event
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

    emitter.emit("interaction:completed", {
      interactionId,
      status: status,
      error: error?.message,
      toolCalls: parsedToolCalls,
      toolResults: parsedToolResults,
    });

    // Clean up controller and tool data maps
    this._activeControllers.delete(interactionId);
    this._streamingToolData.delete(interactionId);

    console.log(
      `[InteractionService] Finalized interaction ${interactionId} with status ${status}.`,
    );
  },
}; // End InteractionService object
