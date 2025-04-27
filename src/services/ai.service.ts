// src/services/ai.service.ts
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
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
} from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store";
import { toast } from "sonner";
import { z } from "zod";
import { PersistenceService } from "@/services/persistence.service";

// Middleware runner remains the same
async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: ModMiddlewarePayloadMap[H],
): Promise<ModMiddlewareReturnMap[H]> {
  const getMiddleware = useControlRegistryStore.getState().getMiddlewareForHook;
  const middlewareCallbacks = getMiddleware(hookName);
  let currentPayload = initialPayload;

  for (const middleware of middlewareCallbacks) {
    try {
      const result = await middleware.callback(currentPayload as any);
      if (result === false) {
        console.log(
          `Middleware ${middleware.modId} cancelled action for hook ${hookName}`,
        );
        return false as ModMiddlewareReturnMap[H];
      }
      if (result && typeof result === "object") {
        currentPayload = result as any;
      }
    } catch (error) {
      console.error(
        `Middleware error in mod ${middleware.modId} for hook ${hookName}:`,
        error,
      );
      return false as ModMiddlewareReturnMap[H];
    }
  }
  return currentPayload as ModMiddlewareReturnMap[H];
}

// Helper to split combined ID remains the same
const splitModelId = (
  combinedId: string | null,
): { providerId: string | null; modelId: string | null } => {
  if (!combinedId || !combinedId.includes(":")) {
    return { providerId: null, modelId: null };
  }
  const parts = combinedId.split(":");
  const providerId = parts[0];
  const modelId = parts.slice(1).join(":");
  return { providerId, modelId };
};

// Helper to get context snapshot remains the same
function getContextSnapshot(): ReadonlyChatContextSnapshot {
  const iS = useInteractionStore.getState();
  const pS = useProviderStore.getState();
  const sS = useSettingsStore.getState();
  const { providerId } = splitModelId(pS.selectedModelId);
  const snapshot: ReadonlyChatContextSnapshot = {
    selectedConversationId: iS.currentConversationId,
    interactions: iS.interactions,
    isStreaming: iS.status === "streaming",
    selectedProviderId: providerId,
    selectedModelId: pS.selectedModelId,
    activeSystemPrompt: sS.globalSystemPrompt,
    temperature: sS.temperature,
    maxTokens: sS.maxTokens,
    theme: sS.theme,
  };
  return snapshot;
}

export class AIService {
  private static activeStreams = new Map<string, AbortController>();

  static async startInteraction(
    aiPayload: PromptObject,
    initiatingTurnData: PromptTurnObject,
  ): Promise<string | null> {
    // Get the entire state/actions object once using getState()
    const interactionStoreStateAndActions = useInteractionStore.getState();

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

    // Calculate index and parentId based on current state
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

    // --- Create ONE Interaction object for the turn ---
    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
      prompt: { ...initiatingTurnData },
      response: null,
      status: "STREAMING",
      startedAt: new Date(),
      endedAt: null,
      metadata: { ...finalPayload.metadata },
      index: newIndex,
      parentId: parentId,
    };

    // Add the single interaction to state and mark as streaming
    // Use the actions obtained from getState()
    interactionStoreStateAndActions._addInteractionToState(interactionData);
    interactionStoreStateAndActions._addStreamingId(interactionId); // Initializes buffer

    // Persist initial state (fire-and-forget)
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

    console.log(
      `AIService: Starting AI call for interaction: ${interactionId} with payload:`,
      finalPayload,
    );

    let streamResult: StreamTextResult<any, any> | undefined;
    let finalStatus: Interaction["status"] = "ERROR"; // Default to error
    let finalErrorMessage: string | undefined = undefined;
    let finalUsage: LanguageModelUsage | undefined = undefined;
    let finalProviderMetadata: ProviderMetadata | undefined = undefined;
    let streamFinishedSuccessfully = false;
    let currentToolCalls: ToolCallPart[] = [];
    let currentToolResults: ToolResultPart[] = [];

    try {
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance;
      if (!modelInstance) {
        throw new Error("Selected model instance not available.");
      }

      const registeredTools = useControlRegistryStore
        .getState()
        .getRegisteredTools();
      const toolsForSdk = Object.entries(registeredTools).reduce(
        (acc, [name, toolInfo]) => {
          acc[name] = toolInfo.definition;
          return acc;
        },
        {} as Record<string, any>,
      );

      const streamOptions: any = {
        model: modelInstance as LanguageModelV1,
        messages: finalPayload.messages as CoreMessage[],
        signal: abortController.signal,
        ...(Object.keys(toolsForSdk).length > 0 && { tools: toolsForSdk }),
        toolChoice:
          finalPayload.toolChoice ??
          (Object.keys(toolsForSdk).length > 0 ? "auto" : "none"),
        toolExecutors: Object.entries(registeredTools)
          .filter(([_, toolInfo]) => !!toolInfo.implementation)
          .reduce(
            (acc, [name, toolInfo]) => {
              acc[name] = async (args: any) => {
                try {
                  const parsedArgs = toolInfo.definition.parameters.parse(args);
                  return await toolInfo.implementation!(
                    parsedArgs,
                    getContextSnapshot(),
                  );
                } catch (e) {
                  console.error(`[AIService] Error executing tool ${name}:`, e);
                  const toolError = e instanceof Error ? e.message : String(e);
                  if (e instanceof z.ZodError) {
                    return {
                      error: `Invalid arguments: ${e.errors.map((err) => `${err.path.join(".")} (${err.message})`).join(", ")}`,
                    };
                  }
                  return { error: toolError };
                }
              };
              return acc;
            },
            {} as Record<string, (args: any) => Promise<any>>,
          ),
      };

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

      streamResult = await streamText(streamOptions);

      for await (const part of streamResult.fullStream) {
        if (abortController.signal.aborted) {
          console.log(`AIService: Stream ${interactionId} aborted by signal.`);
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
              // Use action from getState()
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
          case "tool-call":
            currentToolCalls.push(part);
            console.log(
              `[AIService] Tool call observed: ${part.toolName}`,
              part.args,
            );
            break;
          case "tool-result":
            currentToolResults.push(part);
            console.log(
              `[AIService] Tool result observed for ${part.toolName} (Call ID: ${part.toolCallId})`,
              part.result,
            );
            break;
          case "finish":
            console.log("[AIService] Stream finished part:", part);
            finalUsage = part.usage;
            finalProviderMetadata = part.providerMetadata;
            streamFinishedSuccessfully = true;
            break;
          case "error":
            console.error("[AIService] Stream error part:", part.error);
            throw new Error(
              `AI Stream Error: ${part.error instanceof Error ? part.error.message : part.error}`,
            );
        }
      }

      if (abortController.signal.aborted) {
        throw new Error("Stream aborted by user.");
      }

      if (streamFinishedSuccessfully) {
        finalStatus = "COMPLETED";
        console.log(`AIService: Interaction ${interactionId} completed.`);
      } else {
        console.warn(
          `AIService: Stream loop finished for ${interactionId} but no 'finish' event received.`,
        );
        finalStatus = "ERROR";
        finalErrorMessage =
          "Stream finished unexpectedly without completion signal.";
      }
    } catch (error: unknown) {
      console.error(
        `AIService: Error during interaction ${interactionId}:`,
        error,
      );
      const isAbort =
        error instanceof Error && error.message === "Stream aborted by user.";
      finalStatus = isAbort ? "CANCELLED" : "ERROR";
      finalErrorMessage = isAbort
        ? undefined
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
      // --- Finalization ---
      this.activeStreams.delete(interactionId);

      // Get the final content from the buffer *before* removing the streaming ID
      // Use getState() inside finally to ensure we have the latest buffer content
      const finalBufferedContent =
        useInteractionStore.getState().activeStreamBuffers[interactionId] || "";

      // --- CENTRALIZED FINAL UPDATE ---
      // Prepare a single consolidated update object
      const finalUpdates: Partial<Interaction> = {
        status: finalStatus,
        endedAt: new Date(),
        response: finalBufferedContent, // Set the final response content here
        metadata: {
          // Start with existing metadata from the store state if possible
          // Get the *current* state inside finally
          ...(useInteractionStore
            .getState()
            .interactions.find((i) => i.id === interactionId)?.metadata ||
            interactionData.metadata), // Use initial data as fallback
          ...(finalUsage && {
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.totalTokens,
          }),
          ...(finalProviderMetadata && {
            providerMetadata: finalProviderMetadata,
          }),
          ...(finalStatus === "ERROR" && { error: finalErrorMessage }),
          ...(currentToolCalls.length > 0 && { toolCalls: currentToolCalls }),
          ...(currentToolResults.length > 0 && {
            toolResults: currentToolResults,
          }),
        },
      };

      // Apply the consolidated update to the store state synchronously
      // Use action from getState()
      useInteractionStore
        .getState()
        ._updateInteractionInState(interactionId, finalUpdates);

      // Remove the streaming ID and clean up the buffer *after* state update
      // Use action from getState()
      useInteractionStore.getState()._removeStreamingId(interactionId);
      // --- END CENTRALIZED FINAL UPDATE ---

      // Get the fully updated interaction object from the store *after* the update
      // Use getState() again to ensure we have the state *after* the update
      const finalInteractionState = useInteractionStore
        .getState()
        .interactions.find((i) => i.id === interactionId);

      // Persist the final state
      if (finalInteractionState) {
        // IMPORTANT: Pass a *copy* of the state to the async persistence function
        // Use action from getState()
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
        // This error should be investigated if it still occurs
        console.error(
          `AIService: CRITICAL - Could not find final state for interaction ${interactionId} to persist after updates. State might be inconsistent.`,
        );
      }

      emitter.emit("interaction:completed", {
        interactionId,
        status: finalStatus,
        error: finalErrorMessage ?? undefined,
      });
      console.log(
        `AIService: Finalized interaction ${interactionId} with status ${finalStatus}.`,
      );
    }
    return interactionId;
  }

  static stopInteraction(interactionId: string) {
    const controller = this.activeStreams.get(interactionId);
    // Get actions via getState() inside the method
    const interactionStoreActions = useInteractionStore.getState();

    if (controller && !controller.signal.aborted) {
      console.log(`AIService: Aborting interaction ${interactionId}...`);
      controller.abort();
      // The 'finally' block in startInteraction will handle cleanup and status update.
    } else {
      console.log(
        `AIService: No active controller found or already aborted for interaction ${interactionId}. Attempting store cleanup if needed.`,
      );
      // Use getState() to check the current state
      const interaction = interactionStoreActions.interactions.find(
        (i) => i.id === interactionId,
      );
      // Force cleanup ONLY if it's somehow still marked as streaming in the store
      // AND the stream is not active (controller is missing or already aborted)
      if (
        interaction &&
        interaction.status === "STREAMING" &&
        (!controller || controller.signal.aborted)
      ) {
        console.warn(
          `AIService: Forcing CANCELLED status for interaction ${interactionId} without active controller or already aborted.`,
        );

        const finalBufferedContent =
          interactionStoreActions.activeStreamBuffers[interactionId] || "";

        const finalUpdates: Partial<Interaction> = {
          status: "CANCELLED",
          endedAt: new Date(),
          response: finalBufferedContent,
        };

        // Use actions obtained from getState()
        interactionStoreActions._updateInteractionInState(
          interactionId,
          finalUpdates,
        );
        interactionStoreActions._removeStreamingId(interactionId); // Clean buffer/list

        // Get the state *after* the update for persistence
        // Use getState() again to get the latest state
        const finalInteractionState = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);
        if (finalInteractionState) {
          // Pass a copy for persistence
          // Use action obtained from getState()
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
