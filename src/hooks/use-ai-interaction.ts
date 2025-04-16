// src/hooks/use-ai-interaction.ts
import { useCallback } from "react";
import { streamText, type CoreMessage } from "ai";
import type {
  AiModelConfig,
  AiProviderConfig, // This is now the runtime config
  Message,
  DbMessage,
} from "@/lib/types"; // Added DbMessage
import { throttle } from "@/lib/throttle";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events"; // Import mod events

// --- Updated Interface ---
interface UseAiInteractionProps {
  selectedModel: AiModelConfig | undefined;
  selectedProvider: AiProviderConfig | undefined; // Runtime provider config
  getApiKeyForProvider: () => string | undefined; // Modified signature: gets key for *selected* provider
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
  getApiKeyForProvider, // Use modified getter
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

      // Use the passed-in getter which already knows the selected provider
      const apiKey = getApiKeyForProvider();
      // Determine if a key is *needed* based on type (more robust check done in ChatProvider)
      const needsKey = ["openai", "google", "openrouter"].includes(
        selectedProvider.type,
      );

      if (needsKey && !apiKey) {
        const err = new Error(
          `API Key for ${selectedProvider.name} is not available or configured.`,
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
        providerId: selectedProvider.id, // Store provider config ID
        modelId: selectedModel.id, // Store model ID
      };

      setLocalMessages((prev) => [...prev, assistantPlaceholder]);

      setIsAiStreaming(true);
      setError(null);

      const currentAbortController = new AbortController();
      abortControllerRef.current = currentAbortController;

      let finalContent = "";
      let finalMessageObject: Message | null = null; // Store the final message object

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

      const startTime = Date.now();
      try {
        modEvents.emit(ModEvent.RESPONSE_START, {
          conversationId: conversationIdToUse,
        });

        const messagesForApi: CoreMessage[] = [];
        if (systemPromptToUse) {
          messagesForApi.push({ role: "system", content: systemPromptToUse });
        }
        messagesForApi.push(
          ...messagesToSend.filter((m) => m.role !== "system"),
        );

        // Use the retrieved API key for the header if it exists
        const apiKeyForHeader = apiKey;

        const result = streamText({
          model: selectedModel.instance, // Use the instance from AiModelConfig
          messages: messagesForApi,
          abortSignal: currentAbortController.signal,
          temperature: currentTemperature,
          maxTokens: currentMaxTokens ?? undefined,
          topP: currentTopP ?? undefined,
          topK: currentTopK ?? undefined,
          presencePenalty: currentPresencePenalty ?? undefined,
          frequencyPenalty: currentFrequencyPenalty ?? undefined,
          headers: apiKeyForHeader
            ? {
                Authorization: `Bearer ${apiKeyForHeader}`,
                // Add OpenRouter headers if needed (check provider type)
                ...(selectedProvider.type === "openrouter" && {
                  "HTTP-Referer": "http://localhost:5173", // Replace with your actual app URL
                  "X-Title": "LiteChat", // Replace with your app name
                }),
              }
            : // Add OpenRouter headers even without key if needed
              selectedProvider.type === "openrouter"
              ? {
                  "HTTP-Referer": "http://localhost:5173",
                  "X-Title": "LiteChat",
                }
              : undefined,
        });

        for await (const delta of result.textStream) {
          finalContent += delta;
          modEvents.emit(ModEvent.RESPONSE_CHUNK, {
            chunk: delta,
            conversationId: conversationIdToUse,
          });
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
          prev.map((msg) => {
            if (msg.id === assistantMessageId) {
              finalMessageObject = {
                ...msg,
                content: finalContent,
                isStreaming: false,
                streamedContent: undefined,
                error: streamError ? streamError.message : null,
                // providerId and modelId already set in placeholder
                tokensInput: messagesToSend.reduce(
                  (sum, m) => sum + (m.content.length || 0),
                  0,
                ),
                tokensOutput: finalContent.length,
                tokensPerSecond:
                  streamError || !startTime
                    ? undefined
                    : finalContent.length /
                      ((Date.now() - startTime) / 1000 || 1),
              };
              return finalMessageObject;
            }
            return msg;
          }),
        );

        if (!streamError && finalContent.trim() !== "") {
          try {
            await addDbMessage({
              id: assistantMessageId,
              conversationId: conversationIdToUse,
              role: "assistant",
              content: finalContent,
              createdAt: assistantPlaceholderTimestamp,
              // TODO: Add provider/model info to DbMessage schema if needed
            });
            if (finalMessageObject) {
              modEvents.emit(ModEvent.RESPONSE_DONE, {
                message: finalMessageObject,
              });
            }
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
          // Error handled in catch
        } else {
          console.log("DB save skipped due to empty final content.");
        }
      }
    },
    [
      selectedModel,
      selectedProvider,
      getApiKeyForProvider, // Use modified getter
      streamingThrottleRate,
      setLocalMessages,
      setIsAiStreaming,
      setError,
      addDbMessage,
      abortControllerRef,
    ],
  );

  return {
    performAiStream,
  };
}
