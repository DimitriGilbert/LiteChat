// src/services/ai.service.ts
// Full file content after implementing Step 4
import { streamText, StreamTextResult, LanguageModelV1 } from "ai";
import type {
  CoreMessage,
  Tool,
  ToolCallPart,
  ToolResultPart,
  FinishReason,
  LanguageModelUsage,
  ProviderMetadata,
} from "ai";

export interface AIServiceCallOptions {
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
  // Add other potential streamText options as needed
}

export interface AIServiceCallbacks {
  onChunk: (chunk: string) => void;
  onToolCall: (toolCall: ToolCallPart) => void;
  onToolResult: (toolResult: ToolResultPart) => void;
  onFinish: (details: {
    finishReason: FinishReason;
    usage?: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
  }) => void;
  onError: (error: Error) => void;
}

export class AIService {
  // Executes the AI interaction using the AI SDK's streamText.
  static async executeInteraction(
    interactionId: string,
    options: AIServiceCallOptions,
    callbacks: AIServiceCallbacks,
  ): Promise<void> {
    let streamResult: StreamTextResult<any, any> | undefined;
    let receivedFinishPart = false;

    try {
      // Directly call streamText with the provided options
      streamResult = await streamText(options);

      for await (const part of streamResult.fullStream) {
        // Check for abort signal *before* processing the part
        if (options.abortSignal.aborted) {
          console.log(`[AIService] Stream ${interactionId} aborted by signal.`);
          // Let the finally block handle cleanup. The caller (InteractionService)
          // will determine the final state based on the abort.
          break;
        }

        // Process the stream part based on its type
        switch (part.type) {
          case "text-delta":
            callbacks.onChunk(part.textDelta);
            break;
          case "tool-call":
            callbacks.onToolCall(part);
            break;
          case "tool-result":
            callbacks.onToolResult(part);
            break;
          case "finish":
            receivedFinishPart = true;
            callbacks.onFinish({
              finishReason: part.finishReason,
              usage: part.usage,
              providerMetadata: part.providerMetadata,
            });
            break;
          case "error":
            // SDK provides an error part
            callbacks.onError(
              new Error(
                `AI Stream Error Part: ${part.error instanceof Error ? part.error.message : part.error}`,
              ),
            );
            // Stop processing further parts on SDK error
            return;
          // Ignore other part types for now
          default:
            break;
        }
      }

      if (!options.abortSignal.aborted && !receivedFinishPart) {
        console.warn(
          `[AIService] Stream ${interactionId} ended without a 'finish' part.`,
        );
        callbacks.onError(
          new Error("Stream ended unexpectedly without a finish signal."),
        );
      }
    } catch (error: unknown) {
      console.error(
        `[AIService] Error during streamText call for ${interactionId}:`,
        error,
      );
      if (!(error instanceof Error && error.name === "AbortError")) {
        callbacks.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    } finally {
      console.log(
        `[AIService] Stream processing loop finished for ${interactionId}.`,
      );
    }
  }
}
