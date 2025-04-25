import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type { ModMiddlewareHookName } from "@/types/litechat/modding";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { nanoid } from "nanoid";
import { streamText } from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store"; // Import provider store

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
      currentPayload = result;
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
      return null;
    }

    // 1. Run INTERACTION_BEFORE_START middleware
    const startMiddlewareResult = await runMiddleware(
      "middleware:interaction:beforeStart",
      { prompt: aiPayload, conversationId },
    );
    if (startMiddlewareResult === false) {
      console.log("AIService: Interaction start cancelled by middleware.");
      return null;
    }
    const finalPayload = startMiddlewareResult.prompt as PromptObject;

    const interactionId = nanoid();
    const abortController = new AbortController();
    this.activeStreams.set(interactionId, abortController);

    const interactionData: Omit<Interaction, "index"> = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
      prompt: { ...initiatingTurnData }, // Store snapshot of user turn data
      response: null,
      status: "PENDING",
      startedAt: new Date(),
      endedAt: null,
      metadata: { ...finalPayload.metadata }, // Use metadata from final AI payload
      parentId: interactionStore.interactions.at(-1)?.id ?? null,
    };

    await interactionStore.addInteraction(interactionData);
    interactionStore.setInteractionStatus(interactionId, "STREAMING");
    emitter.emit("interaction:started", {
      interactionId,
      conversationId,
      type: interactionData.type,
    });

    console.log("AIService: Starting AI call for interaction:", interactionId);

    // 2. Perform AI Call
    try {
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance;
      if (!modelInstance)
        throw new Error("Selected model instance not available");

      // const { stream } = await streamText({
      //    model: modelInstance,
      //    system: finalPayload.system,
      //    messages: finalPayload.messages,
      //    tools: finalPayload.tools,
      //    tool_choice: finalPayload.tool_choice,
      //    temperature: finalPayload.parameters.temperature,
      //    // ... other parameters
      //    signal: abortController.signal
      // });
      const stream = (async function* () {
        /* Placeholder */
      })(); // Replace with actual call

      for await (let chunk of stream) {
        if (abortController.signal.aborted) break;
        const chunkPayload = { interactionId, chunk };
        const chunkResult = await runMiddleware(
          "middleware:interaction:processChunk",
          chunkPayload,
        );
        if (chunkResult !== false) {
          interactionStore.appendInteractionResponseChunk(
            interactionId,
            chunkResult.chunk,
          );
          emitter.emit("interaction:stream_chunk", {
            interactionId,
            chunk: chunkResult.chunk,
          });
        }
      }
      if (!abortController.signal.aborted)
        interactionStore.setInteractionStatus(interactionId, "COMPLETED");
    } catch (error) {
      if (!abortController.signal.aborted)
        interactionStore.setInteractionStatus(
          interactionId,
          "ERROR",
          error instanceof Error ? error.message : String(error),
        );
    } finally {
      const finalStatus =
        interactionStore.interactions.find((i) => i.id === interactionId)
          ?.status ?? "CANCELLED";
      this.activeStreams.delete(interactionId);
      interactionStore._removeStreamingId(interactionId);
      emitter.emit("interaction:completed", {
        interactionId,
        status: finalStatus,
        error: finalStatus === "ERROR" ? interactionStore.error : undefined,
      });
    }
    return interactionId;
  }

  static stopInteraction(interactionId: string) {
    const controller = this.activeStreams.get(interactionId);
    if (controller && !controller.signal.aborted) {
      controller.abort();
      useInteractionStore
        .getState()
        .setInteractionStatus(interactionId, "CANCELLED");
    }
    this.activeStreams.delete(interactionId);
    useInteractionStore.getState()._removeStreamingId(interactionId);
  }
}
