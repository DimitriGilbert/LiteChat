// src/services/ai.service.ts
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type { ModMiddlewareHookName } from "@/types/litechat/modding";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { nanoid } from "nanoid";
import { streamText, CoreTool, StreamTextResult } from "ai"; // Import streamText and CoreTool
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store";
import type { InteractionStatus } from "@/types/litechat/interaction";
import { toast } from "sonner"; // Import toast for error reporting

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
      // Update payload only if middleware returned a new object
      if (result && typeof result === "object") {
        currentPayload = result;
      }
    } catch (error) {
      console.error(
        `Middleware error ${middleware.modId} for ${hookName}:`,
        error,
      );
      return false; // Cancel on middleware error
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

    // 1. Run INTERACTION_BEFORE_START middleware
    const startMiddlewareResult = await runMiddleware(
      "middleware:interaction:beforeStart",
      { prompt: aiPayload, conversationId },
    );
    if (startMiddlewareResult === false) {
      console.log("AIService: Interaction start cancelled by middleware.");
      return null;
    }
    // Ensure the result has the expected structure
    const finalPayload =
      startMiddlewareResult && typeof startMiddlewareResult === "object"
        ? (startMiddlewareResult as { prompt: PromptObject }).prompt
        : aiPayload; // Fallback to original if middleware result is unexpected

    const interactionId = nanoid();
    const abortController = new AbortController();
    this.activeStreams.set(interactionId, abortController);

    const interactionData: Omit<Interaction, "index"> = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
      prompt: { ...initiatingTurnData }, // Store snapshot of user turn data
      response: null, // Start with null response
      status: "PENDING",
      startedAt: new Date(),
      endedAt: null,
      metadata: { ...finalPayload.metadata }, // Include metadata from final payload
      parentId: interactionStore.interactions.at(-1)?.id ?? null,
    };

    // Add interaction optimistically first
    await interactionStore.addInteraction(interactionData);
    // Then set status to streaming
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

    // 2. Perform AI Call
    let streamResult: StreamTextResult<any> | undefined;
    try {
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance;
      if (!modelInstance) {
        throw new Error("Selected model instance not available.");
      }

      // --- Call AI SDK ---
      streamResult = await streamText({
        model: modelInstance,
        messages: finalPayload.messages,
        system: finalPayload.system ?? undefined,
        // TODO: Add tools/tool_choice if supported and present in finalPayload
        // tools: finalPayload.tools as Record<string, CoreTool<any, any>> | undefined,
        // toolChoice: finalPayload.tool_choice as any,
        temperature: finalPayload.parameters?.temperature,
        maxTokens: finalPayload.parameters?.max_tokens,
        topP: finalPayload.parameters?.top_p,
        topK: finalPayload.parameters?.top_k,
        presencePenalty: finalPayload.parameters?.presence_penalty,
        frequencyPenalty: finalPayload.parameters?.frequency_penalty,
        // TODO: Add other parameters as needed
        signal: abortController.signal,
        // TODO: Add headers if needed (e.g., for OpenRouter)
        // headers: getHeadersForProvider(providerType, apiKey),
      });

      // --- Process Stream ---
      for await (const part of streamResult.textStream) {
        if (abortController.signal.aborted) {
          console.log(`AIService: Stream ${interactionId} aborted by signal.`);
          break; // Exit loop if aborted
        }

        // Run middleware for each chunk
        const chunkPayload = { interactionId, chunk: part };
        const chunkResult = await runMiddleware(
          "middleware:interaction:processChunk",
          chunkPayload,
        );

        // Append chunk if middleware didn't cancel
        if (chunkResult !== false) {
          const processedChunk =
            chunkResult && typeof chunkResult === "object"
              ? chunkResult.chunk
              : part; // Fallback to original chunk
          interactionStore.appendInteractionResponseChunk(
            interactionId,
            processedChunk,
          );
          emitter.emit("interaction:stream_chunk", {
            interactionId,
            chunk: processedChunk,
          });
        }
      } // End stream loop

      // Check for abort signal again after loop
      if (abortController.signal.aborted) {
        throw new Error("Stream aborted by user.");
      }

      // --- Handle Tool Calls (if any) ---
      // TODO: Implement tool call handling if streamResult.toolCalls exists

      // --- Mark as Completed ---
      interactionStore.setInteractionStatus(interactionId, "COMPLETED");
      console.log(`AIService: Interaction ${interactionId} completed.`);
    } catch (error: unknown) {
      // --- Handle Errors ---
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
        // If aborted, set status to CANCELLED
        interactionStore.setInteractionStatus(interactionId, "CANCELLED");
        console.log(`AIService: Interaction ${interactionId} cancelled.`);
        toast.info("Interaction cancelled.");
      }
    } finally {
      // --- Cleanup ---
      const finalInteraction = interactionStore.interactions.find(
        (i) => i.id === interactionId,
      );
      const finalStatus = finalInteraction?.status ?? "CANCELLED";
      const finalError =
        finalStatus === "ERROR" ? finalInteraction?.metadata?.error : undefined;

      // Update metadata with token usage if available
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
      interactionStore._removeStreamingId(interactionId); // Ensure removed from streaming list
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
      // Status is set to CANCELLED within the startInteraction's finally block
    } else {
      console.log(
        `AIService: No active controller found or already aborted for interaction ${interactionId}.`,
      );
    }
    // Cleanup happens in startInteraction's finally block
  }
}
