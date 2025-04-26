// src/services/ai.service.ts
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type { ModMiddlewareHookName } from "@/types/litechat/modding";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { nanoid } from "nanoid";
// Import specific types needed from 'ai'
import {
  streamText,
  // Removed unused CoreTool import
  StreamTextResult,
  // LanguageModelV1CallOptions, // Not needed directly
  LanguageModelV1, // Import LanguageModelV1 for casting if needed
  CoreMessage, // Import CoreMessage
} from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store";
// Removed unused InteractionStatus import
import { toast } from "sonner";

async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: any,
): Promise<any | false> {
  const getMiddleware = useControlRegistryStore.getState().getMiddlewareForHook;
  const middlewareCallbacks = getMiddleware(hookName);
  let currentPayload = initialPayload;
  for (const middleware of middlewareCallbacks) {
    try {
      const result = await middleware.callback(currentPayload);
      if (result === false) return false;
      if (result && typeof result === "object") {
        currentPayload = result;
      }
    } catch (error) {
      console.error(
        `Middleware error ${middleware.modId} for ${hookName}:`,
        error,
      );
      return false;
    }
  }
  return currentPayload;
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
      // Parent ID calculation moved to InteractionStore.addInteraction
      parentId: null, // Set to null initially, store will handle it
    };

    // Add interaction first, store calculates index/parentId
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

    // Fix: Specify the two required type arguments for StreamTextResult
    let streamResult: StreamTextResult<any, any> | undefined;
    try {
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance;
      if (!modelInstance) {
        throw new Error("Selected model instance not available.");
      }

      // Fix: Define the options object correctly combining all properties
      const streamOptions = {
        model: modelInstance as LanguageModelV1, // Cast if necessary
        messages: finalPayload.messages as CoreMessage[], // Ensure correct type
        system: finalPayload.system ?? undefined,
        // tools: finalPayload.tools as Record<string, CoreTool<any, any>> | undefined,
        // toolChoice: finalPayload.tool_choice as any,
        temperature: finalPayload.parameters?.temperature,
        maxTokens: finalPayload.parameters?.max_tokens,
        topP: finalPayload.parameters?.top_p,
        topK: finalPayload.parameters?.top_k,
        presencePenalty: finalPayload.parameters?.presence_penalty,
        frequencyPenalty: finalPayload.parameters?.frequency_penalty,
        signal: abortController.signal, // Include signal here
        // headers: getHeadersForProvider(providerType, apiKey), // Add headers if needed
      };

      // Pass the single options object
      streamResult = await streamText(streamOptions);

      for await (const part of streamResult.textStream) {
        if (abortController.signal.aborted) {
          console.log(`AIService: Stream ${interactionId} aborted by signal.`);
          break;
        }

        const chunkPayload = { interactionId, chunk: part };
        const chunkResult = await runMiddleware(
          "middleware:interaction:processChunk",
          chunkPayload,
        );

        if (chunkResult !== false) {
          const processedChunk =
            chunkResult && typeof chunkResult === "object"
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
      if (!abortController.signal.aborted) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        interactionStore.setInteractionStatus(
          interactionId,
          "ERROR",
          errorMessage,
        );
        toast.error(`AI Interaction Error: ${errorMessage}`);
      } else {
        interactionStore.setInteractionStatus(interactionId, "CANCELLED");
        console.log(`AIService: Interaction ${interactionId} cancelled.`);
        toast.info("Interaction cancelled.");
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
      // Status is set to CANCELLED in the startInteraction finally block
    } else {
      console.log(
        `AIService: No active controller found or already aborted for interaction ${interactionId}.`,
      );
    }
  }
}
