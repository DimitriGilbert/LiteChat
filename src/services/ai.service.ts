// src/services/ai.service.ts
// FULL FILE

import { AIWorkerManager } from "./ai.worker.manager";
import type { LanguageModelV1 } from "ai";
import type {
  CoreMessage,
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
  tools?: Record<string, any>; // Add tools back - they'll be used to determine if VFS tools should be enabled
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
  // Add streaming FPS control
  streamingRenderFPS?: number;
}

export interface AIServiceCallbacks {
  onChunk: (chunk: string) => void;
  onToolCall: (toolCall: ToolCallPart) => void;
  onToolResult: (toolResult: ToolResultPart) => void;
  // Add a callback specifically for reasoning chunks
  onReasoningChunk: (chunk: string) => void;
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
  private static workerManager = AIWorkerManager.getInstance();

  // Executes the AI interaction using the worker.
  static async executeInteraction(
    interactionId: string,
    options: AIServiceCallOptions,
    callbacks: AIServiceCallbacks,
  ): Promise<void> {
    try {
      // Set up abort handling
      const abortHandler = () => {
        this.workerManager.abortInteraction(interactionId);
      };

      if (options.abortSignal.aborted) {
        console.log(`[AIService] Interaction ${interactionId} already aborted before starting.`);
        return;
      }

      options.abortSignal.addEventListener('abort', abortHandler);

      try {
        await this.workerManager.executeInteraction(
          interactionId,
          {
            model: options.model,
            messages: options.messages,
            system: options.system,
            tools: options.tools, // Pass tools to enable tool modules in worker
            toolChoice: options.toolChoice,
            temperature: options.temperature,
            maxTokens: options.maxTokens,
            topP: options.topP,
            topK: options.topK,
            presencePenalty: options.presencePenalty,
            frequencyPenalty: options.frequencyPenalty,
            maxSteps: options.maxSteps,
            providerOptions: options.providerOptions,
            streamingRenderFPS: options.streamingRenderFPS
          },
          callbacks
        );
      } finally {
        options.abortSignal.removeEventListener('abort', abortHandler);
      }
    } catch (error: unknown) {
      console.error(
        `[AIService] Error during worker execution for ${interactionId}:`,
        error,
      );
      if (!(error instanceof Error && error.name === "AbortError")) {
        callbacks.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    } finally {
      console.log(
        `[AIService] Worker execution finished for ${interactionId}.`,
      );
    }
  }

  // Update streaming FPS for an active interaction
  static updateStreamingFPS(interactionId: string, fps: number): void {
    this.workerManager.updateStreamingFPS(interactionId, fps);
  }

  // Terminate worker (for cleanup)
  static terminate(): void {
    this.workerManager.terminate();
  }
}
