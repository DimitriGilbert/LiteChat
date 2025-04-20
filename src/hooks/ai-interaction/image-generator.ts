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
export async function performImageGeneration({
  conversationIdToUse,
  prompt,
  n = 1,
  size = "1024x1024",
  aspectRatio,
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  setLocalMessages,
  setIsAiStreaming,
  setError,
  addDbMessage,
  abortControllerRef,
}: PerformImageGenerationParams & {
  selectedModel: any;
  selectedProvider: any;
  getApiKeyForProvider: () => string | undefined;
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (error: string | null) => void;
  addDbMessage: (message: DbMessage) => Promise<string | void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}): Promise<PerformImageGenerationResult> {
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

  const providerId = selectedProvider!.id;
  const modelId = selectedModel!.id;

  if (!selectedModel?.instance || !selectedModel?.supportsImageGeneration) {
    const errorMsg = "Selected model does not support image generation.";
    setError(errorMsg);
    toast.error(errorMsg);
    return { error: errorMsg };
  }

  setIsAiStreaming(true);
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

  setLocalMessages((prev) => [...prev, placeholderMessage]);

  try {
    const { images, warnings } = await generateImage({
      model: selectedModel.instance,
      prompt: prompt,
      n: n,
      size: size as `${number}x${number}`,
      aspectRatio: aspectRatio as `${number}:${number}`,
      headers: getStreamHeaders(selectedProvider!.type, apiKey),
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

    const finalImageMessageData: Message = {
      id: placeholderId,
      role: "assistant" as Role,
      // Assign the correctly typed imageParts array
      content: imageParts,
      createdAt: placeholderTimestamp,
      conversationId: conversationIdToUse,
      isStreaming: false,
      error: null,
      providerId: providerId,
      modelId: modelId,
    };

    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.id === placeholderId ? finalImageMessageData : msg,
      ),
    );

    try {
      const dbMessageToSave: DbMessage = {
        id: finalImageMessageData.id,
        conversationId: finalImageMessageData.conversationId as string,
        role: finalImageMessageData.role,
        // Assign the correctly typed imageParts array
        content: finalImageMessageData.content as MessageContent,
        createdAt: placeholderTimestamp,
      };

      await addDbMessage(dbMessageToSave as DbMessage);
      console.log("Saved image generation message to DB:", placeholderId);
      modEvents.emit(ModEvent.RESPONSE_DONE, {
        message: finalImageMessageData,
      });
    } catch (dbErr: unknown) {
      const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
      console.error("Failed to save image generation message:", dbErr);
      setError(`Error saving image: ${dbErrorMessage}`);
      toast.error(`Failed to save image: ${dbErrorMessage}`);
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === placeholderId
            ? { ...msg, error: dbErrorMessage, isStreaming: false }
            : msg,
        ),
      );
      return { error: dbErrorMessage, warnings };
    }

    return { images: imageParts, warnings };
  } catch (err: unknown) {
    if ((err as any)?.name === "AbortError") {
      console.log("Image generation aborted.");
      toast.info("Image generation stopped.");
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === placeholderId
            ? {
                ...msg,
                content: "Image generation cancelled.",
                isStreaming: false,
                error: "Cancelled by user.",
              }
            : msg,
        ),
      );
      return { error: "Cancelled by user." };
    } else {
      const error = err instanceof Error ? err : new Error(String(err));
      const errorMessage = `Image generation failed: ${error.message}`;
      setError(errorMessage);
      toast.error(errorMessage);
      setLocalMessages((prev) =>
        prev.map((msg) =>
          msg.id === placeholderId
            ? {
                ...msg,
                error: errorMessage,
                isStreaming: false,
                content: "", // Keep content empty on error
              }
            : msg,
        ),
      );
      return { error: errorMessage };
    }
  } finally {
    if (abortControllerRef.current === currentAbortController)
      abortControllerRef.current = null;
    setIsAiStreaming(false);
    setLocalMessages((prev) =>
      prev.map((msg) =>
        msg.id === placeholderId && msg.isStreaming
          ? { ...msg, isStreaming: false }
          : msg,
      ),
    );
  }
}
