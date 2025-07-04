// src/services/ai.service.ts
// FULL FILE

import { streamText, generateText, StreamTextResult, LanguageModelV1 } from "ai";
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
  // Add providerOptions for specific provider features
  providerOptions?: Record<string, any>;
}

export interface AIServiceCallbacks {
  onChunk: (chunk: string) => void;
  onToolCall: (toolCall: ToolCallPart) => void;
  onToolResult: (toolResult: ToolResultPart) => void;
  // Add a callback specifically for reasoning chunks
  onReasoningChunk: (chunk: string) => void;
  // Add callbacks for step events
  onStepStart?: (stepInfo: { messageId: string; request: any; warnings: any[] }) => void;
  onStepFinish?: (stepInfo: { finishReason: FinishReason; usage?: LanguageModelUsage; isContinued: boolean; warnings: any[] }) => void;
  // Update onFinish to potentially include reasoning
  onFinish: (details: {
    finishReason: FinishReason;
    usage?: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
    reasoning?: string; // Add reasoning field
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
    let finalFinishReason: FinishReason | null = null;
    let finalUsage: LanguageModelUsage | undefined;
    let finalProviderMetadata: ProviderMetadata | undefined;
    let finalReasoning: string | undefined; // Variable to hold final reasoning

    try {
      // Directly call streamText with the provided options
      // Store the result promise
      streamResult = await streamText(options);

      // Process the stream parts
      for await (const part of streamResult.fullStream) {
        // Check for abort signal *before* processing the part
        if (options.abortSignal.aborted) {
          console.log(`[AIService] Stream ${interactionId} aborted by signal.`);
          break;
        }

        // Process the stream part based on its type
        switch (part.type) {
          case "text-delta":
            callbacks.onChunk(part.textDelta);
            break;
          // Handle the reasoning part type directly
          case "reasoning":
            callbacks.onReasoningChunk(part.textDelta);
            break;
          case "tool-call":
            callbacks.onToolCall(part);
            break;
          case "tool-result":
            callbacks.onToolResult(part);
            break;
          case "step-start":
            // Handle step-start events - these indicate the start of a processing step
            if (callbacks.onStepStart) {
              callbacks.onStepStart({
                messageId: (part as any).messageId,
                request: (part as any).request,
                warnings: (part as any).warnings || []
              });
            }
            console.log(`[AIService] Step started for ${interactionId} - Message ID: ${(part as any).messageId}`);
            break;
          case "step-finish":
            // Handle step-finish events - these indicate completion of a processing step
            if (callbacks.onStepFinish) {
              callbacks.onStepFinish({
                finishReason: (part as any).finishReason,
                usage: (part as any).usage,
                isContinued: (part as any).isContinued || false,
                warnings: (part as any).warnings || []
              });
            }
            console.log(`[AIService] Step finished for ${interactionId} - Reason: ${(part as any).finishReason}, Continued: ${(part as any).isContinued}`);
            break;
          case "finish":
            // Store finish details but don't call onFinish yet
            receivedFinishPart = true;
            finalFinishReason = part.finishReason;
            finalUsage = part.usage;
            finalProviderMetadata = part.providerMetadata;
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
            // Log unexpected part types with more context
            console.warn(
              `[AIService] Received unexpected stream part type: ${(part as any).type} for ${interactionId}`,
              part,
            );
            break;
        }
      }

      // --- After the stream finishes (or is aborted) ---

      // Extract final reasoning from the result object if available
      if (streamResult?.reasoning) {
        finalReasoning = await streamResult.reasoning;
        console.log(
          `[AIService] Extracted final reasoning for ${interactionId}`,
        );
      } else {
        console.log(
          `[AIService] No final reasoning found in stream result for ${interactionId}.`,
        );
      }

      // Call onFinish callback *after* the stream is done
      if (!options.abortSignal.aborted && receivedFinishPart) {
        callbacks.onFinish({
          finishReason: finalFinishReason!,
          usage: finalUsage,
          providerMetadata: finalProviderMetadata,
          reasoning: finalReasoning, // Pass the final extracted reasoning
        });
      } else if (!options.abortSignal.aborted && !receivedFinishPart) {
        console.warn(
          `[AIService] Stream ${interactionId} ended without a 'finish' part.`,
        );
        callbacks.onError(
          new Error("Stream ended unexpectedly without a finish signal."),
        );
      }
      // If aborted, InteractionService handles the CANCELLED state.
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
        `[AIService] Stream processing finished for ${interactionId}.`,
      );
    }
  }

  // Generates a non-streaming text completion.
  static async generateCompletion(options: {
    model: LanguageModelV1;
    messages: CoreMessage[];
    system?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    try {
      const { text } = await generateText(options);
      return text;
    } catch (error: unknown) {
      console.error(`[AIService] Error during generateText call:`, error);
      // Re-throw a standardized error
      throw new Error(
        `AI completion failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
