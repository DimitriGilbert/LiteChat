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
} from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store";
import { toast } from "sonner";
import { z } from "zod";
import { PersistenceService } from "@/services/persistence.service";

// Middleware runner (remains the same)
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

// Helper to split combined ID - needed for context snapshot
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

// Helper to get context snapshot
function getContextSnapshot(): ReadonlyChatContextSnapshot {
  const iS = useInteractionStore.getState();
  const pS = useProviderStore.getState();
  const sS = useSettingsStore.getState();

  // Extract providerId from selectedModelId
  const { providerId } = splitModelId(pS.selectedModelId);

  const snapshot: ReadonlyChatContextSnapshot = {
    selectedConversationId: iS.currentConversationId,
    interactions: iS.interactions,
    isStreaming: iS.status === "streaming",
    selectedProviderId: providerId, // Use extracted providerId
    selectedModelId: pS.selectedModelId, // Keep combined model ID
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
    const interactionStore = useInteractionStore.getState();
    const conversationId = interactionStore.currentConversationId;
    if (!conversationId) {
      interactionStore.setError("No active conversation.");
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

    const currentInteractions = interactionStore.interactions;
    const newIndex =
      currentInteractions.reduce((max, i) => Math.max(max, i.index), -1) + 1;
    const parentId =
      currentInteractions.length > 0
        ? currentInteractions[currentInteractions.length - 1].id
        : null;

    const currentInteractionData: Interaction = {
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

    interactionStore._addInteractionToState(currentInteractionData);
    interactionStore._addStreamingId(interactionId);

    PersistenceService.saveInteraction({ ...currentInteractionData }).catch(
      (e) => {
        console.error(
          `AIService: Failed initial persistence for ${interactionId}`,
          e,
        );
        interactionStore.setError(
          `Failed to save interaction ${interactionId}`,
        );
      },
    );

    emitter.emit("interaction:started", {
      interactionId,
      conversationId,
      type: currentInteractionData.type,
    });

    console.log(
      `AIService: Starting AI call for interaction: ${interactionId} with payload:`,
      finalPayload,
    );

    let streamResult: StreamTextResult<any, any> | undefined;
    let finalStatus: Interaction["status"] = "ERROR";
    let finalErrorMessage: string | undefined = undefined;
    let finalUsage: LanguageModelUsage | undefined = undefined;
    let finalProviderMetadata: ProviderMetadata | undefined = undefined;
    let streamFinishedSuccessfully = false;

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

              currentInteractionData.response =
                String(currentInteractionData.response ?? "") + processedChunk;
              interactionStore.appendInteractionResponseChunk(
                interactionId,
                processedChunk,
              );
              emitter.emit("interaction:stream_chunk", {
                interactionId,
                chunk: processedChunk,
              });
            }
            break;
          }
          case "tool-call":
            currentInteractionData.metadata.toolCalls = [
              ...(currentInteractionData.metadata.toolCalls || []),
              part,
            ];
            console.log(
              `[AIService] Tool call observed: ${part.toolName}`,
              part.args,
            );
            break;
          case "tool-result":
            currentInteractionData.metadata.toolResults = [
              ...(currentInteractionData.metadata.toolResults || []),
              part,
            ];
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
      this.activeStreams.delete(interactionId);

      currentInteractionData.status = finalStatus;
      currentInteractionData.endedAt = new Date();
      currentInteractionData.metadata = {
        ...currentInteractionData.metadata,
        ...(finalUsage && {
          promptTokens: finalUsage.promptTokens,
          completionTokens: finalUsage.completionTokens,
          totalTokens: finalUsage.totalTokens,
        }),
        ...(finalProviderMetadata && {
          providerMetadata: finalProviderMetadata,
        }),
        ...(finalStatus === "ERROR" && { error: finalErrorMessage }),
        toolCalls: currentInteractionData.metadata.toolCalls,
        toolResults: currentInteractionData.metadata.toolResults,
      };

      interactionStore._updateInteractionInState(
        interactionId,
        currentInteractionData,
      );
      interactionStore._removeStreamingId(interactionId);

      interactionStore
        .updateInteractionAndPersist({ ...currentInteractionData })
        .catch((e) => {
          console.error(
            `AIService: Failed final persistence for ${interactionId}`,
            e,
          );
          interactionStore.setError(
            `Failed to save interaction ${interactionId}`,
          );
        });

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
    if (controller && !controller.signal.aborted) {
      console.log(`AIService: Aborting interaction ${interactionId}...`);
      controller.abort();
    } else {
      console.log(
        `AIService: No active controller found or already aborted for interaction ${interactionId}.`,
      );
      const interactionStore = useInteractionStore.getState();
      const interaction = interactionStore.interactions.find(
        (i) => i.id === interactionId,
      );
      if (interaction && interaction.status === "STREAMING") {
        console.warn(
          `AIService: Forcing CANCELLED status for interaction ${interactionId} without active controller.`,
        );
        const finalCancelledState: Interaction = {
          ...interaction,
          status: "CANCELLED",
          endedAt: new Date(),
        };
        interactionStore._updateInteractionInState(
          interactionId,
          finalCancelledState,
        );
        interactionStore._removeStreamingId(interactionId);
        interactionStore
          .updateInteractionAndPersist({ ...finalCancelledState })
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
