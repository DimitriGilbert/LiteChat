// src/hooks/ai-interaction/error-handler.ts
import { toast } from "sonner";

/**
 * Handles AI interaction errors and updates state accordingly
 */
export function handleStreamError(
  err: unknown,
  setErrorFn: (error: string | null) => void
): [Error | null, string] {
  let streamError: Error | null = null;
  let finalContent = "";

  if (err instanceof Error) {
    streamError = err;
    if (err.name === "AbortError") {
      streamError = null; // Not a real error for the user
    } else {
      console.error(`streamText error:`, err);
      finalContent = `Error: ${err.message || "Failed to get response"}`;
      setErrorFn(`AI Error: ${finalContent}`);
      toast.error(`AI Error: ${err.message || "Unknown error"}`);
    }
  } else {
    console.error("Unknown stream error:", err);
    streamError = new Error("Unknown streaming error");
    finalContent = `Error: ${streamError.message}`;
    setErrorFn(`AI Error: ${finalContent}`);
    toast.error(`AI Error: Unknown error`);
  }

  return [streamError, finalContent];
}

/**
 * Validates the required parameters for AI interaction
 */
export function validateAiParameters(
  conversationId: string,
  selectedModel: any,
  selectedProvider: any,
  apiKey: string | undefined,
  setErrorFn: (error: string | null) => void
): Error | null {
  if (!conversationId) {
    const err = new Error(
      "Internal Error: No active conversation ID provided."
    );
    setErrorFn(err.message);
    return err;
  }
  
  if (!selectedModel || !selectedProvider) {
    const err = new Error("AI provider or model not selected.");
    setErrorFn(err.message);
    return err;
  }

  // Determine if a key is *needed* based on type
  const needsKey = ["openai", "google", "openrouter"].includes(
    selectedProvider.type
  );

  if (needsKey && !apiKey) {
    const err = new Error(
      `API Key for ${selectedProvider.name} is not available or configured.`
    );
    setErrorFn(err.message);
    toast.error(err.message);
    return err;
  }

  return null;
}