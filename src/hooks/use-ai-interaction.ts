// src/hooks/use-ai-interaction.ts
import { useCallback } from "react";
import { streamText, type CoreMessage } from "ai";
import type {
  AiModelConfig,
  AiProviderConfig,
  Message,
  DbMessage,
} from "@/lib/types"; // Added DbMessage
import { throttle } from "@/lib/throttle";
import { nanoid } from "nanoid";
import { toast } from "sonner";

// --- Updated Interface ---
interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined;
  getApiKeyForProvider: (providerId: string) => string | undefined;
  streamingThrottleRate: number;
  // Core state/setters passed directly
  setLocalMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsAiStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setError: (error: string | null) => void;
  // DB function passed directly
  addDbMessage: (
    messageData: Omit<DbMessage, "id" | "createdAt"> &
      Partial<Pick<DbMessage, "id" | "createdAt">>,
  ) => Promise<string>;
  // Abort controller ref passed directly
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

// --- Interface remains the same ---
interface PerformAiStreamParams {
  conversationIdToUse: string;
  messagesToSend: CoreMessage[];
  currentTemperature: number;
  currentMaxTokens: number | null;
  currentTopP: number | null;
  currentTopK: number | null;
  currentPresencePenalty: number | null;
  currentFrequencyPenalty: number | null;
  systemPromptToUse: string | null;
}

interface UseAiInteractionReturn {
  performAiStream: (params: PerformAiStreamParams) => Promise<void>;
}

export function useAiInteraction({
  selectedModel,
  selectedProvider,
  getApiKeyForProvider,
  streamingThrottleRate,
  setLocalMessages, // from props
  setIsAiStreaming, // from props
  setError, // from props
  addDbMessage, // from props
  abortControllerRef, // from props
}: UseAiInteractionProps): UseAiInteractionReturn {
  const performAiStream = useCallback(
    async ({
      conversationIdToUse,
      messagesToSend,
      currentTemperature,
      currentMaxTokens,
      currentTopP,
      currentTopK,
      currentPresencePenalty,
      currentFrequencyPenalty,
      systemPromptToUse,
    }: PerformAiStreamParams) => {
      // --- Boilerplate checks remain the same ---
      if (!conversationIdToUse) {
        const err = new Error(
          "Internal Error: No active conversation ID provided.",
        );
        setError(err.message);
        throw err;
      }
      if (!selectedModel || !selectedProvider) {
        const err = new Error("AI provider or model not selected.");
        setError(err.message);
        throw err;
      }
      const apiKey = getApiKeyForProvider(selectedProvider.id);
      const needsKey =
        selectedProvider.requiresApiKey ?? selectedProvider.id !== "mock";
      if (needsKey && !apiKey) {
        const err = new Error(
          `API Key for ${selectedProvider.name} is not set or selected.`,
        );
        setError(err.message);
        toast.error(err.message);
        throw err;
      }

      const assistantMessageId = nanoid();
      const assistantPlaceholderTimestamp = new Date();
      const assistantPlaceholder: Message = {
        id: assistantMessageId,
        conversationId: conversationIdToUse,
        role: "assistant",
        content: "",
        createdAt: assistantPlaceholderTimestamp,
        isStreaming: true,
        streamedContent: "", // Start empty
        error: null,
      };

      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      setIsAiStreaming(true);
      setError(null);

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      let finalContent = "";

      const throttledStreamUpdate = throttle(() => {
        const currentAccumulatedContent = finalContent;
        setLocalMessages((prev) => {
          const targetMessageIndex = prev.findIndex(
            (msg) => msg.id === assistantMessageId,
          );
          if (
            targetMessageIndex === -1 ||
            !prev[targetMessageIndex].isStreaming
          ) {
            return prev;
          }
          const updatedMessages = [...prev];
          updatedMessages[targetMessageIndex] = {
            ...prev[targetMessageIndex],
            streamedContent: currentAccumulatedContent,
          };
          return updatedMessages;
        });
      }, streamingThrottleRate);

      let streamError: Error | null = null;

      try {
        const messagesForApi: CoreMessage[] = [];
        if (systemPromptToUse) {
          messagesForApi.push({ role: "system", content: systemPromptToUse });
        }
        messagesForApi.push(
          ...messagesToSend.filter((m) => m.role !== "system"),
        );

        const result = streamText({
          model: selectedModel.instance,
          messages: messagesForApi,
          abortSignal: currentAbortController.signal,
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined,
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
        });

        for await (const delta of result.textStream) {
          finalContent += delta;
          throttledStreamUpdate();
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          streamError = err;
          if (err.name === "AbortError") {
            streamError = null; // Not a real error for the user
          } else {
            console.error(`streamText error:`, err);
            finalContent = `Error: ${err.message || "Failed to get response"}`;
            setError(`AI Error: ${finalContent}`);
            toast.error(`AI Error: ${err.message || "Unknown error"}`);
          }
        } else {
          // Handle non-Error throws if necessary
          console.error("Unknown stream error:", err);
          streamError = new Error("Unknown streaming error");
          finalContent = `Error: ${streamError.message}`;
          setError(`AI Error: ${finalContent}`);
          toast.error(`AI Error: Unknown error`);
        }
      } finally {
        if (abortControllerRef.current === currentAbortController) {
          abortControllerRef.current = null;
        }
        setIsAiStreaming(false);

        setLocalMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: finalContent,
                  isStreaming: false,
                  streamedContent: undefined,
                  error: streamError ? streamError.message : null,
                }
              : msg,
          ),
        );

        if (!streamError && finalContent.trim() !== "") {
          try {
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent,
              createdAt: assistantPlaceholderTimestamp,
            });
          } catch (dbErr: unknown) {
            const dbErrorMessage = `Save failed: ${dbErr instanceof Error ? dbErr.message : "Unknown DB error"}`;
            console.error("Failed to save final assistant message:", dbErr);
            setError(`Error saving response: ${dbErrorMessage}`);
            toast.error(`Failed to save response: ${dbErrorMessage}`);
            setLocalMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, error: dbErrorMessage }
                  : msg,
              ),
            );
          }
        } else if (streamError) {
          // Error already set and toasted inside catch block
        } else {
          // Empty content, no need to save or show error
          console.log("DB save skipped due to empty final content.");
        }
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider,
      streamingThrottleRate,
      setLocalMessages, // dependency
      setIsAiStreaming, // dependency
      setError, // dependency
      addDbMessage, // dependency
      abortControllerRef, // dependency
    ],
  );

  return {
    performAiStream,
  };
}
