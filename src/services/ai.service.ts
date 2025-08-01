// src/services/ai.service.ts
// FULL FILE

import { streamText, generateText, StreamTextResult, LanguageModel } from "ai";
import type {
  Tool,
  ToolCallPart,
  ToolResultPart,
  FinishReason,
  LanguageModelUsage,
  ProviderMetadata,
  ModelMessage,
} from "ai";

export interface AIServiceCallOptions {
  model: LanguageModel;
  messages: ModelMessage[];
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
  stopWhen?: any; // AI SDK stopWhen condition
  // Add providerOptions for specific provider features
  providerOptions?: Record<string, any>;
}

export interface AIServiceCallbacks {
  onChunk: (chunk: string) => void;
  onToolCall: (toolCall: ToolCallPart) => void;
  onToolResult: (toolResult: ToolResultPart) => void;
  // Add callbacks for tool input streaming (AI SDK v5)
  onToolInputStart?: (toolInputStart: any) => void;
  onToolInputDelta?: (toolInputDelta: any) => void;
  onToolInputEnd?: (toolInputEnd: any) => void;
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
      streamResult = await streamText(options);

      // Process the stream parts with error handling for OpenRouter bug
      for await (const part of streamResult.fullStream) {
        // Check for abort signal *before* processing the part
        if (options.abortSignal.aborted) {
          console.log(`[AIService] Stream ${interactionId} aborted by signal.`);
          break;
        }

        // Process the stream part based on its type
        switch (part.type) {
          case "text-delta":
            // AI SDK v5: text parts now use 'text' property directly
            callbacks.onChunk(part.text);
            break;
          case "reasoning-delta":
            // AI SDK v5: reasoning parts now use 'text' property directly
            callbacks.onReasoningChunk(part.text);
            break;
          case "tool-call":
            callbacks.onToolCall(part);
            break;
          case "tool-result":
            callbacks.onToolResult(part as any);
            break;
          case "tool-input-start":
            // Handle tool input streaming start
            if (callbacks.onToolInputStart) {
              callbacks.onToolInputStart(part as any);
            }
            break;
          case "tool-input-delta":
            // Handle tool input streaming delta
            if (callbacks.onToolInputDelta) {
              callbacks.onToolInputDelta(part as any);
            }
            break;
          case "tool-input-end":
            // Handle tool input streaming end
            if (callbacks.onToolInputEnd) {
              callbacks.onToolInputEnd(part as any);
            }
            break;
          case "start-step":
            // Handle start-step events - these indicate the start of a processing step
            if (callbacks.onStepStart) {
              callbacks.onStepStart({
                messageId: (part as any).messageId || 'unknown',
                request: (part as any).request,
                warnings: (part as any).warnings || []
              });
            }
            break;
          case "finish-step":
            // Handle finish-step events - these indicate completion of a processing step
            if (callbacks.onStepFinish) {
              callbacks.onStepFinish({
                finishReason: (part as any).finishReason,
                usage: (part as any).usage,
                isContinued: (part as any).isContinued || false,
                warnings: (part as any).warnings || []
              });
            }
            break;
          case "start":
            // Stream started
            break;
          case "finish":
            // Store finish details but don't call onFinish yet
            receivedFinishPart = true;
            finalFinishReason = part.finishReason;
            // AI SDK v5: finish parts use 'totalUsage'
            finalUsage = part.totalUsage;
            finalProviderMetadata = (part as any).providerMetadata;
            break;
          case "error":
            // SDK provides an error part - handle OpenRouter "text part not found" bug
            const errorMessage = part.error instanceof Error ? part.error.message : String(part.error);
            
            // Check if this is the OpenRouter "text part not found" or "reasoning part not found" bug
            if (typeof errorMessage === 'string' && 
                ((errorMessage.includes('text part') && errorMessage.includes('not found')) ||
                 (errorMessage.includes('reasoning part') && errorMessage.includes('not found')))) {
              // console.warn(`[AIService] OpenRouter provider bug detected for ${interactionId}: ${errorMessage}. Continuing stream...`);
              // Don't stop the stream, just continue processing
              break;
            }
            
            // For other errors, handle normally
            console.error(`[AIService] Stream error for ${interactionId}:`, errorMessage, part);
            callbacks.onError(
              new Error(`AI Stream Error Part: ${errorMessage}`)
            );
            // Stop processing further parts on non-OpenRouter errors
            return;
          // Handle other part types
          default:
            // Log unexpected part types but don't spam the console
            if ((part as any).type && !['text-start', 'text-delta', 'text-end', 'reasoning-start', 'reasoning-delta', 'reasoning-end', 'source', 'file', 'tool-call', 'tool-call-streaming-start', 'tool-call-delta', 'tool-call-streaming-end', 'tool-result', 'tool-error', 'start-step', 'finish-step', 'finish', 'error', 'abort', 'raw'].includes((part as any).type)) {
              console.warn(
                `[AIService] Received unexpected stream part type: ${(part as any).type} for ${interactionId}`,
                part,
              );
            }
            break;
        }
      }

      // --- After the stream finishes (or is aborted) ---

      // Extract final reasoning from the result object if available
      if (streamResult?.reasoningText) {
        finalReasoning = await streamResult.reasoningText;
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
    model: LanguageModel;
    messages: ModelMessage[];
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
