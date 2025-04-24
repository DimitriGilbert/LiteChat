// src/hooks/ai-interaction/image-generator.ts
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  experimental_generateImage as generateImage,
  ImageModelCallWarning,
} from "ai";
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

export async function performImageGeneration({
  conversationIdToUse,
  prompt,
  n = 1,
  size = "1024x1024",
  aspectRatio,
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  addMessage,
  updateMessage,
  setIsAiStreaming,
  setError,
  addDbMessage,
  abortControllerRef,
}: PerformImageGenerationParams): Promise<PerformImageGenerationResult> {
  // Pass provider ID to getApiKeyForProvider
  const apiKey = getApiKeyForProvider(selectedProvider?.id || "");
  const validationError = validateAiParameters(
    conversationIdToUse,
    selectedModel,
    selectedProvider,
    apiKey,
    setError,
    true, // Indicate this is for image generation
  );

  if (validationError) return { error: validationError.message };

  // Re-check after validationError check for type safety
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

  setIsAiStreaming(true);
  setError(null);
  const currentAbortController =
    abortControllerRef.current ?? new AbortController();
  if (!abortControllerRef.current) {
    abortControllerRef.current = currentAbortController;
  }

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

  addMessage(placeholderMessage);

  try {
    const { images, warnings } = await generateImage({
      model: selectedModel.instance,
      prompt: prompt,
      n: n,
      size: size as `${number}x${number}`, // Cast size to expected format
      aspectRatio: aspectRatio as `${number}:${number}`, // Cast aspectRatio
      headers: getStreamHeaders(selectedProvider.type, apiKey),
      abortSignal: currentAbortController.signal,
    });

    if (warnings && warnings.length > 0) {
      warnings.forEach((warning: ImageModelCallWarning) =>
        toast.warning(`Image generation warning: ${JSON.stringify(warning)}`),
      );
    }

    const imageParts: ImagePart[] = images.map((img) => ({
      type: "image",
      image: `data:${img.mimeType ?? "image/png"};base64,${img.base64}`,
      mediaType: img.mimeType ?? "image/png",
    }));

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

    updateMessage(placeholderId, {
      content: finalImageMessageData.content,
      isStreaming: false,
      error: null,
    });

    try {
      // Ensure the object matches DbMessage structure
      const dbMessageToSave: DbMessage = {
        id: finalImageMessageData.id,
        conversationId: finalImageMessageData.conversationId as string,
        role: finalImageMessageData.role,
        content: finalImageMessageData.content as MessageContent, // Cast is okay here if structure matches
        createdAt: placeholderTimestamp,
        providerId: providerId,
        modelId: modelId,
        // Ensure other optional DbMessage fields are undefined or null if not applicable
        vfsContextPaths: undefined,
        tool_calls: undefined,
        tool_call_id: undefined,
        children: undefined,
        workflow: undefined,
        tokensInput: undefined,
        tokensOutput: undefined,
      };

      await addDbMessage(dbMessageToSave);
      console.log("Saved image generation message to DB:", placeholderId);
      modEvents.emit(ModEvent.RESPONSE_DONE, {
        message: finalImageMessageData,
      });
    } catch (dbErr: unknown) {
      const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
      console.error("Failed to save image generation message:", dbErr);
      setError(`Error saving image: ${dbErrorMessage}`);
      toast.error(`Failed to save image: ${dbErrorMessage}`);
      updateMessage(placeholderId, {
        error: dbErrorMessage,
        isStreaming: false,
      });
      return { error: dbErrorMessage, warnings };
    }

    return { images: imageParts, warnings };
  } catch (err: unknown) {
    let errorMessage: string;
    let finalContent: string = ""; // Default final content for error cases

    if (currentAbortController.signal.aborted) {
      errorMessage = "Cancelled by user.";
      finalContent = "Image generation cancelled.";
      console.log("Image generation aborted.");
      toast.info("Image generation stopped.");
    } else if ((err as any)?.name === "AbortError") {
      // Handle other potential AbortErrors not triggered by our controller
      errorMessage = "Image generation aborted (external).";
      finalContent = "Image generation aborted.";
      console.log("Image generation aborted (external source).");
      toast.warning("Image generation aborted.");
    } else {
      const error = err instanceof Error ? err : new Error(String(err));
      errorMessage = `Image generation failed: ${error.message}`;
      setError(errorMessage); // Set global error state
      toast.error(errorMessage);
      finalContent = `Error: ${errorMessage}`; // Provide error info in content
    }

    updateMessage(placeholderId, {
      content: finalContent, // Update content with error/cancellation message
      error: errorMessage,
      isStreaming: false,
    });
    return { error: errorMessage };
  } finally {
    // Clear the ref *if* it's the controller we were using
    if (abortControllerRef.current === currentAbortController) {
      abortControllerRef.current = null;
    }
    setIsAiStreaming(false);
    // Ensure streaming is marked false even if updateMessage was called earlier
    updateMessage(placeholderId, { isStreaming: false });
  }
}
