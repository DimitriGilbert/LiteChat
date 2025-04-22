// src/hooks/ai-interaction/image-generator.ts
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  experimental_generateImage as generateImage,
  ImageModelCallWarning,
} from "ai";
// Import specific part types and MessageContent
import {
  Message,
  DbMessage,
  MessageContent,
  Role,
  ImagePart,
} from "@/lib/types";
import { validateAiParameters } from "./error-handler";
import { getStreamHeaders } from "./stream-handler";
import { ModEvent, modEvents } from "@/mods/events";
import {
  PerformImageGenerationParams,
  PerformImageGenerationResult,
} from "./types";

/**
 * Handles image generation using AI models
 */
// FIX: Update the signature to match PerformImageGenerationParams from types.ts
export async function performImageGeneration({
  conversationIdToUse,
  prompt,
  n = 1,
  size = "1024x1024",
  aspectRatio,
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  // Use addMessage and updateMessage instead of setLocalMessages
  addMessage,
  updateMessage,
  setIsAiStreaming, // Type now matches Zustand setter: (isStreaming: boolean) => void
  setError,
  addDbMessage,
  abortControllerRef,
}: PerformImageGenerationParams): Promise<PerformImageGenerationResult> {
  // Use the defined type
  const apiKey = getApiKeyForProvider();
  const validationError = validateAiParameters(
    conversationIdToUse,
    selectedModel,
    selectedProvider,
    apiKey,
    setError,
    true,
  );

  if (validationError) return { error: validationError.message };

  // Ensure provider and model are valid before proceeding
  if (!selectedProvider || !selectedModel) {
    const errorMsg = "Provider or Model is not selected.";
    setError(errorMsg);
    toast.error(errorMsg);
    return { error: errorMsg };
  }

  const providerId = selectedProvider.id;
  const modelId = selectedModel.id;

  if (!selectedModel?.instance || !selectedModel?.supportsImageGeneration) {
    const errorMsg = "Selected model does not support image generation.";
    setError(errorMsg);
    toast.error(errorMsg);
    return { error: errorMsg };
  }

  setIsAiStreaming(true); // Call the Zustand setter
  setError(null);
  const currentAbortController = new AbortController();
  abortControllerRef.current = currentAbortController;
  const placeholderId = nanoid();
  const placeholderTimestamp = new Date();

  const placeholderMessage: Message = {
    id: placeholderId,
    conversationId: conversationIdToUse,
    role: "assistant",
    content: `Generating image with prompt: "${prompt}"...`,
    isStreaming: true,
    createdAt: placeholderTimestamp,
    providerId: providerId,
    modelId: modelId,
  };

  // Add the placeholder message using the store action
  addMessage(placeholderMessage);

  try {
    const { images, warnings } = await generateImage({
      model: selectedModel.instance,
      prompt: prompt,
      n: n,
      size: size as `${number}x${number}`,
      aspectRatio: aspectRatio as `${number}:${number}`,
      headers: getStreamHeaders(selectedProvider.type, apiKey), // Use selectedProvider.type
      abortSignal: currentAbortController.signal,
    });

    if (warnings && warnings.length > 0)
      warnings.forEach((warning: ImageModelCallWarning) =>
        toast.warning(`Image generation warning: ${JSON.stringify(warning)}`),
      );

    // Explicitly type imageParts as ImagePart[]
    const imageParts: ImagePart[] = images.map((img) => ({
      type: "image",
      image: `data:${img.mimeType ?? "image/png"};base64,${img.base64}`,
      mediaType: img.mimeType ?? "image/png",
    }));

    // Prepare the final message data (used for both UI update and DB save)
    const finalImageMessageData: Message = {
      id: placeholderId,
      role: "assistant" as Role,
      content: imageParts,
      createdAt: placeholderTimestamp,
      conversationId: conversationIdToUse,
      isStreaming: false,
      error: null,
      providerId: providerId,
      modelId: modelId,
    };

    // Update the placeholder message in the UI using the store action
    updateMessage(placeholderId, {
      content: finalImageMessageData.content,
      isStreaming: false,
      error: null,
      // Keep other fields like providerId, modelId if needed
    });

    try {
      const dbMessageToSave: DbMessage = {
        id: finalImageMessageData.id,
        conversationId: finalImageMessageData.conversationId as string,
        role: finalImageMessageData.role,
        content: finalImageMessageData.content as MessageContent,
        createdAt: placeholderTimestamp,
        providerId: providerId, // Save provider/model if schema allows
        modelId: modelId,
      };

      await addDbMessage(dbMessageToSave as DbMessage);
      console.log("Saved image generation message to DB:", placeholderId);
      // Emit event with the final data
      modEvents.emit(ModEvent.RESPONSE_DONE, {
        message: finalImageMessageData,
      });
    } catch (dbErr: unknown) {
      const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
      console.error("Failed to save image generation message:", dbErr);
      setError(`Error saving image: ${dbErrorMessage}`);
      toast.error(`Failed to save image: ${dbErrorMessage}`);
      // Update the UI message with the error
      updateMessage(placeholderId, {
        error: dbErrorMessage,
        isStreaming: false,
      });
      return { error: dbErrorMessage, warnings };
    }

    return { images: imageParts, warnings };
  } catch (err: unknown) {
    let errorMessage: string;
    let finalContent: string = ""; // Keep content empty on error

    if ((err as any)?.name === "AbortError") {
      errorMessage = "Cancelled by user.";
      finalContent = "Image generation cancelled.";
      console.log("Image generation aborted.");
      toast.info("Image generation stopped.");
    } else {
      const error = err instanceof Error ? err : new Error(String(err));
      errorMessage = `Image generation failed: ${error.message}`;
      setError(errorMessage);
      toast.error(errorMessage);
    }

    // Update the UI message with the error
    updateMessage(placeholderId, {
      content: finalContent, // Update content for cancellation case
      error: errorMessage,
      isStreaming: false,
    });
    return { error: errorMessage };
  } finally {
    if (abortControllerRef.current === currentAbortController)
      abortControllerRef.current = null;
    setIsAiStreaming(false); // Call the Zustand setter
    // Ensure streaming is false even if update didn't happen before finally
    updateMessage(placeholderId, { isStreaming: false });
  }
}
