// src/hooks/use-chat-interactions.ts
import { useCallback } from "react";
import { toast } from "sonner";
import type { CoreChatActions, InputActions } from "@/store"; // Assuming index export
import { useCoreChatStore } from "@/store/core-chat.store";
import { useSettingsStore } from "@/store/settings.store";
import type {
  AiModelConfig,
  AiProviderConfig,
  DbProviderConfig,
  Message,
  MessageContent,
  ReadonlyChatContextSnapshot,
} from "@/lib/types";
import { db } from "@/lib/db";
import { convertDbMessagesToCoreMessages } from "@/utils/chat-utils";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ollama-ai-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ensureV1Path } from "@/utils/chat-utils";

// Define props needed by the interaction handlers
interface UseChatInteractionsProps {
  // State
  selectedItemId: string | null;
  selectedItemType: string | null;
  dbProviderConfigs: DbProviderConfig[];
  // Actions from stores
  coreChatActions: Pick<
    CoreChatActions,
    | "handleSubmitCore"
    | "handleImageGenerationCore"
    | "stopStreamingCore"
    | "regenerateMessageCore"
    | "startWorkflowCore"
    | "setError" // Added back
  >;
  inputActions: Pick<InputActions, "clearAllInput">;
  // AI Interaction function
  performAiStream: (params: any) => Promise<void>;
  // Context getter
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  // API Key getter
  getApiKeyForProvider: (providerId: string) => string | undefined;
}

interface UseChatInteractionsReturn {
  handleFormSubmit: (
    promptValue: string, // Add promptValue back here
    files: File[],
    vfsPaths: string[],
    context: any,
  ) => Promise<void>;
  handleImageGenerationWrapper: (prompt: string) => Promise<void>;
  stopStreaming: (parentMessageId?: string | null) => void;
  regenerateMessage: (messageId: string) => Promise<void>;
}

export function useChatInteractions({
  // Destructure props
  selectedItemId,
  selectedItemType,
  // selectedModel, // Removed
  // selectedProvider, // Removed
  dbProviderConfigs,
  coreChatActions,
  inputActions,
  performAiStream,
  getContextSnapshotForMod,
  getApiKeyForProvider,
}: UseChatInteractionsProps): UseChatInteractionsReturn {
  const handleFormSubmit = useCallback(
    async (
      promptValue: string, // Add promptValue back here
      _files: File[], // Files are processed into context.contentToSendToAI
      _vfsPaths: string[], // VFS paths are processed into context.contentToSendToAI
      context: {
        selectedItemId: string | null;
        contentToSendToAI: MessageContent;
        vfsContextPaths?: string[];
      },
    ) => {
      // --- Initial Check ---
      if (!context.selectedItemId) {
        toast.error("Failed to determine active conversation for submission.");
        coreChatActions.setError(
          "Failed to determine active conversation for submission.",
        );
        return;
      }

      const conversationId = context.selectedItemId; // Use the validated ID

      // --- Command Detection ---
      // Use the original promptValue for command detection if needed,
      // or use context.contentToSendToAI if commands are expected after processing
      const commandMatch = promptValue.match(/^\/(\w+)\s*(.*)/s); // Use promptValue for command check
      const isWorkflowCommand =
        commandMatch &&
        ["race", "sequence", "parallel"].includes(commandMatch[1]);
      const isImageCommand = promptValue.startsWith("/imagine "); // Use promptValue for command check

      // --- Branching Logic ---
      if (isWorkflowCommand) {
        const fullCommand = promptValue; // Use original command string
        try {
          // Define helper functions within the scope where needed
          const getProviderFunc = (
            id: string,
          ): AiProviderConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === id);
            if (!config) return undefined;
            return {
              id: config.id,
              name: config.name,
              type: config.type,
              models: [],
              allAvailableModels: config.fetchedModels || [],
            };
          };
          const getModelFunc = (
            provId: string,
            modId: string,
          ): AiModelConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === provId);
            if (!config) return undefined;
            const modelInfo = (config.fetchedModels ?? []).find(
              (m: { id: string }) => m.id === modId,
            );
            if (!modelInfo) return undefined;
            let modelInstance: any = null;
            const currentApiKey = getApiKeyForProvider(config.id);
            try {
              switch (config.type) {
                case "openai":
                  modelInstance = createOpenAI({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "google":
                  modelInstance = createGoogleGenerativeAI({
                    apiKey: currentApiKey,
                  })(modelInfo.id);
                  break;
                case "openrouter":
                  modelInstance = createOpenRouter({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "ollama":
                  modelInstance = createOllama({
                    baseURL: config.baseURL ?? undefined,
                  })(modelInfo.id);
                  break;
                case "openai-compatible":
                  if (!config.baseURL) throw new Error("Base URL required");
                  modelInstance = createOpenAICompatible({
                    baseURL: ensureV1Path(config.baseURL),
                    apiKey: currentApiKey,
                    name: config.name || "Custom API",
                  })(modelInfo.id);
                  break;
                default:
                  throw new Error(`Unsupported provider type: ${config.type}`);
              }
            } catch (e) {
              console.error(`Failed to instantiate model ${modelInfo.id}:`, e);
            }
            const supportsImageGen = config.type === "openai";
            const supportsTools = ["openai", "google", "openrouter"].includes(
              config.type,
            );
            return {
              id: modelInfo.id,
              name: modelInfo.name,
              instance: modelInstance,
              supportsImageGeneration: supportsImageGen,
              supportsToolCalling: supportsTools,
            };
          };
          await coreChatActions.startWorkflowCore(
            conversationId,
            fullCommand,
            getApiKeyForProvider,
            getProviderFunc,
            getModelFunc,
            dbProviderConfigs, // Pass live data
          );
          inputActions.clearAllInput();
        } catch (err) {
          console.error("Error starting workflow:", err);
          toast.error(
            `Error starting workflow: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else if (isImageCommand) {
        try {
          const imagePrompt = promptValue.substring("/imagine ".length).trim(); // Use original prompt
          await coreChatActions.handleImageGenerationCore(
            conversationId,
            imagePrompt,
          );
          inputActions.clearAllInput();
        } catch (err) {
          console.error("Error in image generation flow:", err);
          toast.error(
            `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        // Regular text/multi-modal submission
        try {
          // Pass the processed content and VFS paths to the core handler
          await coreChatActions.handleSubmitCore(
            conversationId,
            context.contentToSendToAI,
            context.vfsContextPaths,
          );
          // Fetch necessary state for performAiStream *inside* the handler
          const currentMessages = useCoreChatStore.getState().messages;
          const settings = useSettingsStore.getState();
          const activeSystemPrompt =
            getContextSnapshotForMod().activeSystemPrompt;
          const messagesForApi =
            convertDbMessagesToCoreMessages(currentMessages);

          await performAiStream({
            conversationIdToUse: conversationId,
            messagesToSend: messagesForApi,
            currentTemperature: settings.temperature,
            currentMaxTokens: settings.maxTokens,
            currentTopP: settings.topP,
            currentTopK: settings.topK,
            currentPresencePenalty: settings.presencePenalty,
            currentFrequencyPenalty: settings.frequencyPenalty,
            systemPromptToUse: activeSystemPrompt,
          });
          inputActions.clearAllInput();
        } catch (err) {
          console.error("Error during form submission flow:", err);
          // Error should be handled within performAiStream or handleSubmitCore
          // If it bubbles up here, it's likely a validation error already shown
        }
      }
    },
    [
      coreChatActions,
      inputActions,
      performAiStream,
      getContextSnapshotForMod,
      getApiKeyForProvider,
      dbProviderConfigs,
    ],
  );

  const handleImageGenerationWrapper = useCallback(
    async (promptValue: string) => {
      if (!selectedItemId || selectedItemType !== "conversation") {
        toast.error("No active conversation selected for image generation.");
        return;
      }
      try {
        await coreChatActions.handleImageGenerationCore(
          selectedItemId,
          promptValue,
        );
      } catch (err) {
        console.error("Error in handleImageGenerationWrapper:", err);
        toast.error(
          `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [coreChatActions, selectedItemId, selectedItemType],
  );

  const stopStreaming = useCallback(
    (parentMessageId: string | null = null) => {
      coreChatActions.stopStreamingCore(parentMessageId);
    },
    [coreChatActions],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      try {
        const originalMessage = await db.messages.get(messageId);
        if (!originalMessage) {
          toast.error("Cannot regenerate: Original message not found in DB.");
          return;
        }
        const conversationId = originalMessage.conversationId;

        // Prepare UI and stop streams
        await coreChatActions.regenerateMessageCore(messageId);

        // Fetch potentially updated messages after core action
        const currentMessages = useCoreChatStore.getState().messages;

        if (originalMessage.workflow) {
          toast.info("Re-running workflow...");
          const originalCommand = originalMessage.content as string;
          // Define helpers again or pass them if refactored
          const getProviderFunc = (
            id: string,
          ): AiProviderConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === id);
            if (!config) return undefined;
            return {
              id: config.id,
              name: config.name,
              type: config.type,
              models: [],
              allAvailableModels: config.fetchedModels || [],
            };
          };
          const getModelFunc = (
            provId: string,
            modId: string,
          ): AiModelConfig | undefined => {
            const config = dbProviderConfigs.find((p) => p.id === provId);
            if (!config) return undefined;
            const modelInfo = (config.fetchedModels ?? []).find(
              (m: { id: string }) => m.id === modId,
            );
            if (!modelInfo) return undefined;
            let modelInstance: any = null;
            const currentApiKey = getApiKeyForProvider(config.id);
            try {
              switch (config.type) {
                case "openai":
                  modelInstance = createOpenAI({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "google":
                  modelInstance = createGoogleGenerativeAI({
                    apiKey: currentApiKey,
                  })(modelInfo.id);
                  break;
                case "openrouter":
                  modelInstance = createOpenRouter({ apiKey: currentApiKey })(
                    modelInfo.id,
                  );
                  break;
                case "ollama":
                  modelInstance = createOllama({
                    baseURL: config.baseURL ?? undefined,
                  })(modelInfo.id);
                  break;
                case "openai-compatible":
                  if (!config.baseURL) throw new Error("Base URL required");
                  modelInstance = createOpenAICompatible({
                    baseURL: ensureV1Path(config.baseURL),
                    apiKey: currentApiKey,
                    name: config.name || "Custom API",
                  })(modelInfo.id);
                  break;
                default:
                  throw new Error(`Unsupported provider type: ${config.type}`);
              }
            } catch (e) {
              console.error(`Failed to instantiate model ${modelInfo.id}:`, e);
            }
            const supportsImageGen = config.type === "openai";
            const supportsTools = ["openai", "google", "openrouter"].includes(
              config.type,
            );
            return {
              id: modelInfo.id,
              name: modelInfo.name,
              instance: modelInstance,
              supportsImageGeneration: supportsImageGen,
              supportsToolCalling: supportsTools,
            };
          };
          await coreChatActions.startWorkflowCore(
            conversationId,
            originalCommand,
            getApiKeyForProvider,
            getProviderFunc,
            getModelFunc,
            dbProviderConfigs, // Pass live data
          );
        } else if (
          originalMessage.role === "user" &&
          typeof originalMessage.content === "string" &&
          originalMessage.content.startsWith("/imagine ")
        ) {
          toast.warning(
            "Regenerating user image prompts not typical. Regenerate the assistant response instead.",
          );
        } else if (originalMessage.role === "assistant") {
          // Find the preceding user message to check for /imagine
          let precedingUserMessage: Message | undefined;
          const msgIndex = currentMessages.findIndex(
            (m: Message) => m.createdAt! < originalMessage.createdAt!,
          );
          for (let i = msgIndex; i >= 0; i--) {
            if (currentMessages[i]?.role === "user") {
              precedingUserMessage = currentMessages[i];
              break;
            }
          }

          if (
            precedingUserMessage &&
            typeof precedingUserMessage.content === "string" &&
            precedingUserMessage.content.startsWith("/imagine ")
          ) {
            // Regenerate image based on the preceding user prompt
            const imagePrompt = precedingUserMessage.content
              .substring("/imagine ".length)
              .trim();
            await handleImageGenerationWrapper(imagePrompt);
          } else {
            // Regenerate text/multi-modal response
            const historyForApi =
              convertDbMessagesToCoreMessages(currentMessages);
            const settings = useSettingsStore.getState();
            const activeSystemPrompt =
              getContextSnapshotForMod().activeSystemPrompt;
            await performAiStream({
              conversationIdToUse: conversationId,
              messagesToSend: historyForApi,
              currentTemperature: settings.temperature,
              currentMaxTokens: settings.maxTokens,
              currentTopP: settings.topP,
              currentTopK: settings.topK,
              currentPresencePenalty: settings.presencePenalty,
              currentFrequencyPenalty: settings.frequencyPenalty,
              systemPromptToUse: activeSystemPrompt,
            });
          }
        } else {
          toast.error("Cannot regenerate this message type.");
        }
      } catch (err) {
        console.error("Error during regeneration flow:", err);
        toast.error(
          `Regeneration failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    [
      coreChatActions,
      performAiStream,
      handleImageGenerationWrapper,
      getContextSnapshotForMod,
      getApiKeyForProvider,
      dbProviderConfigs,
    ],
  );

  return {
    handleFormSubmit,
    handleImageGenerationWrapper,
    stopStreaming,
    regenerateMessage,
  };
}
