// src/hooks/ai-interaction/error-handler.ts
import { toast } from "sonner";
import type { AiModelConfig, AiProviderConfig } from "@/lib/types";

import { requiresApiKey as checkRequiresApiKey } from "@/lib/litechat";

/**
 * Validates essential parameters before making an AI call.
 * @returns An Error object if validation fails, otherwise null.
 */
export function validateAiParameters(
  conversationId: string | null,
  model: AiModelConfig | undefined,
  provider: AiProviderConfig | undefined,
  apiKey: string | undefined,
  setError: (error: string | null) => void,
  isImageGeneration: boolean = false,
): Error | null {
  if (!conversationId) {
    const msg = "No active conversation selected.";
    setError(msg);
    toast.error(msg);
    return new Error(msg);
  }
  if (!provider) {
    const msg = "No AI provider selected.";
    setError(msg);
    toast.error(msg);
    return new Error(msg);
  }
  if (!model) {
    const msg = "No AI model selected.";
    setError(msg);
    toast.error(msg);
    return new Error(msg);
  }

  // Use the imported helper function for the check
  const requiresApiKey = checkRequiresApiKey(provider.type);

  if (requiresApiKey && !apiKey) {
    // Updated error message to be more specific
    const msg = `API key required for ${provider.name} (${provider.type}) but not found or not linked. Please add/link it in Settings > Providers.`;
    setError(msg);
    toast.error(msg);
    return new Error(msg);
  }

  // Specific check for image generation support
  if (isImageGeneration && !model.supportsImageGeneration) {
    const msg = `Model '${model.name}' does not support image generation.`;
    setError(msg);
    toast.error(msg);
    return new Error(msg);
  }

  // All checks passed
  return null;
}

/**
 * Handles errors during the AI stream execution.
 * Logs the error, updates the UI state, and returns the error object
 * along with any partial content accumulated before the error.
 *
 * @param err The error object caught during streaming.
 * @param setError Function to update the global error state.
 * @param accumulatedContent The content accumulated before the error occurred.
 * @returns A tuple containing the Error object and the accumulated content string.
 */
export function handleStreamError(
  err: unknown,
  setError: (error: string | null) => void,
  accumulatedContent: string,
): [Error, string] {
  let error: Error;
  const finalContent = accumulatedContent; // Return accumulated content on error

  if (err instanceof Error && err.name === "AbortError") {
    error = new Error("Stream aborted by user.");
    // Don't set global error for user abort, just info toast
    toast.info("Stream stopped.");
  } else if (err instanceof Error) {
    error = err;
    const errorMsg = `Streaming Error: ${error.message}`;
    setError(errorMsg); // Set global error state
    toast.error(errorMsg);
  } else {
    error = new Error("An unknown streaming error occurred.");
    setError(error.message); // Set global error state
    toast.error(error.message);
  }
  console.error("Stream Error Details:", error);
  return [error, finalContent];
}
