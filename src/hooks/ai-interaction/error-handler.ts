// src/hooks/ai-interaction/error-handler.ts
import { toast } from "sonner";
import type { AiModelConfig, AiProviderConfig } from "@/lib/types";

/**
 * Validates essential parameters before making an AI call.
 */
export function validateAiParameters(
  conversationId: string | null,
  model: AiModelConfig | undefined,
  provider: AiProviderConfig | undefined,
  apiKey: string | undefined,
  setError: (error: string | null) => void,
  isImageGeneration: boolean = false, // Add flag for image generation check
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
  // Check API key requirement based on provider type
  const requiresApiKey = !["ollama"].includes(provider.type); // Ollama typically doesn't need a key via API
  if (requiresApiKey && !apiKey) {
    const msg = `API key required for ${provider.name} but not found. Please add it in Settings > Providers.`;
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

  return null; // No error
}

/**
 * Handles errors during the AI stream execution.
 * Returns the error object and potentially partial content.
 */
export function handleStreamError(
  err: unknown,
  setError: (error: string | null) => void,
): [Error, string] {
  let error: Error;
  const finalContent = ""; // Usually empty on error, but could capture partial

  if (err instanceof Error && err.name === "AbortError") {
    error = new Error("Stream aborted by user.");
    // Optionally capture partial content if available before abort
    // finalContent = contentRef.current;
    toast.info("Stream stopped.");
  } else if (err instanceof Error) {
    error = err;
    const errorMsg = `Streaming Error: ${error.message}`;
    setError(errorMsg);
    toast.error(errorMsg);
  } else {
    error = new Error("An unknown streaming error occurred.");
    setError(error.message);
    toast.error(error.message);
  }
  console.error("Stream Error Details:", error);
  return [error, finalContent];
}
