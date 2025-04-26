// src/services/ai.service.ts
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
} from "@/types/litechat/modding";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { nanoid } from "nanoid";
import { streamText, StreamTextResult, LanguageModelV1, CoreMessage } from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store"; // Ensure correct import
import { toast } from "sonner";

// Placeholder middleware runner
async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: ModMiddlewarePayloadMap[H],
): Promise<ModMiddlewareReturnMap[H]> {
  console.warn(`Middleware hook "${hookName}" execution is placeholder.`);
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

    const interactionData: Omit<Interaction, "index"> = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
      prompt: { ...initiatingTurnData },
      response: null,
      status: "PENDING",
      startedAt: new Date(),
      endedAt: null,
      metadata: { ...finalPayload.metadata },
      parentId: null,
    };

    await interactionStore.addInteraction(interactionData);
    interactionStore.setInteractionStatus(interactionId, "STREAMING");
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
    try {
      // Use the correct selector from the store
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance; // Use getSelectedModel
      if (!modelInstance) {
        throw new Error("Selected model instance not available.");
      }

      const streamOptions: any = {
        model: modelInstance as LanguageModelV1,
        messages: finalPayload.messages as CoreMessage[],
        signal: abortController.signal,
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

      for await (const part of streamResult.textStream) {
        if (abortController.signal.aborted) {
          console.log(`AIService: Stream ${interactionId} aborted by signal.`);
          throw new Error("Stream aborted by user.");
        }

        const chunkPayload = { interactionId, chunk: part };
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
              : part;

          interactionStore.appendInteractionResponseChunk(
            interactionId,
            processedChunk,
          );
          emitter.emit("interaction:stream_chunk", {
            interactionId,
            chunk: processedChunk,
          });
        }
      }

      if (abortController.signal.aborted) {
        throw new Error("Stream aborted by user.");
      }

      interactionStore.setInteractionStatus(interactionId, "COMPLETED");
      console.log(`AIService: Interaction ${interactionId} completed.`);
    } catch (error: unknown) {
      console.error(
        `AIService: Error during interaction ${interactionId}:`,
        error,
      );
      if (
        error instanceof Error &&
        error.message === "Stream aborted by user."
      ) {
        interactionStore.setInteractionStatus(interactionId, "CANCELLED");
        console.log(`AIService: Interaction ${interactionId} cancelled.`);
        toast.info("Interaction cancelled.");
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        interactionStore.setInteractionStatus(
          interactionId,
          "ERROR",
          errorMessage,
        );
        toast.error(`AI Interaction Error: ${errorMessage}`);
      }
    } finally {
      const finalInteraction = interactionStore.interactions.find(
        (i) => i.id === interactionId,
      );
      const finalStatus = finalInteraction?.status ?? "CANCELLED";
      const finalError =
        finalStatus === "ERROR" ? finalInteraction?.metadata?.error : undefined;

      if (streamResult && finalStatus === "COMPLETED") {
        try {
          const usage = await streamResult.usage;
          interactionStore.updateInteraction(interactionId, {
            metadata: {
              ...finalInteraction?.metadata,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            },
          });
        } catch (usageError) {
          console.error(
            `AIService: Failed to get token usage for ${interactionId}:`,
            usageError,
          );
        }
      }

      this.activeStreams.delete(interactionId);
      interactionStore._removeStreamingId(interactionId);
      emitter.emit("interaction:completed", {
        interactionId,
        status: finalStatus,
        error: finalError ?? undefined,
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
    }
  }
}
