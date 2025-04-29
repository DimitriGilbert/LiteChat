// src/services/ai.service.ts
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ReadonlyChatContextSnapshot,
  ToolImplementation,
} from "@/types/litechat/modding";
import { useInteractionStore } from "@/store/interaction.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import { nanoid } from "nanoid";
import {
  streamText,
  StreamTextResult,
  LanguageModelV1,
  CoreMessage,
  LanguageModelUsage,
  ProviderMetadata,
  ToolCallPart,
  ToolResultPart,
  TextPart,
  ImagePart,
  CoreUserMessage,
  Tool,
  TextStreamPart,
  FinishReason,
} from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store";
import { toast } from "sonner";
import { z } from "zod";
import { PersistenceService } from "@/services/persistence.service";
import { type AttachedFileMetadata } from "@/store/input.store";
import { splitModelId } from "@/lib/litechat/provider-helpers"; // Import from helpers

// Middleware runner remains the same
async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: ModMiddlewarePayloadMap[H],
): Promise<ModMiddlewareReturnMap[H]> {
  const getMiddleware = useControlRegistryStore.getState().getMiddlewareForHook;
  const middlewareCallbacks = getMiddleware(hookName);
  let currentPayload = initialPayload;

  for (const middleware of middlewareCallbacks) {
    try {
      const result = await middleware.callback(currentPayload as any);
      if (result === false) {
        console.log(
          `Middleware ${middleware.modId} cancelled action for hook ${hookName}`,
        );
        return false as ModMiddlewareReturnMap[H];
      }
      if (result && typeof result === "object") {
        currentPayload = result as any;
      }
    } catch (error) {
      console.error(
        `Middleware error in mod ${middleware.modId} for hook ${hookName}:`,
        error,
      );
      return false as ModMiddlewareReturnMap[H];
    }
  }
  return currentPayload as ModMiddlewareReturnMap[H];
}

// Helper splitModelId REMOVED from here

// Helper to get context snapshot remains the same
function getContextSnapshot(): ReadonlyChatContextSnapshot {
  const iS = useInteractionStore.getState();
  const pS = useProviderStore.getState();
  const sS = useSettingsStore.getState();
  const { providerId } = splitModelId(pS.selectedModelId); // Use imported helper
  const snapshot: ReadonlyChatContextSnapshot = {
    selectedConversationId: iS.currentConversationId,
    interactions: iS.interactions,
    isStreaming: iS.status === "streaming",
    selectedProviderId: providerId,
    selectedModelId: pS.selectedModelId,
    activeSystemPrompt: sS.globalSystemPrompt,
    temperature: sS.temperature,
    maxTokens: sS.maxTokens,
    theme: sS.theme,
  };
  return snapshot;
}

// Helper function to convert base64 string to Uint8Array remains the same
function base64ToUint8Array(base64: string): Uint8Array {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Error decoding base64 string:", e);
    throw new Error("Invalid base64 string for file content.");
  }
}

// --- Improved File Content Processing ---
const COMMON_TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".html",
  ".css",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".go",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".rs",
  ".toml",
  ".yaml",
  ".yml",
  ".xml",
  ".sh",
  ".bat",
  ".ps1",
];

function processFileMetaToUserContent(
  fileMeta: AttachedFileMetadata,
): TextPart | ImagePart | null {
  try {
    const mimeType = fileMeta.type || "application/octet-stream";
    const fileNameLower = fileMeta.name.toLowerCase();
    const isLikelyText =
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      COMMON_TEXT_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));
    const isImage = mimeType.startsWith("image/");

    if (isLikelyText && fileMeta.contentText !== undefined) {
      return { type: "text", text: fileMeta.contentText };
    } else if (isImage && fileMeta.contentBase64 !== undefined) {
      const buffer = base64ToUint8Array(fileMeta.contentBase64);
      return { type: "image", image: buffer, mimeType: mimeType };
    } else if (!isLikelyText && fileMeta.contentBase64 !== undefined) {
      console.warn(
        `AIService: Unsupported file type "${mimeType}" for direct inclusion. Sending note.`,
      );
      return {
        type: "text",
        text: `[Attached file: ${fileMeta.name} (${mimeType})]`,
      };
    } else {
      throw new Error(
        `Missing content or unable to determine type for file: ${fileMeta.name}`,
      );
    }
  } catch (error) {
    console.error(
      `AIService: Failed to process content for ${fileMeta.name}:`,
      error,
    );
    toast.error(
      `Failed to process file "${fileMeta.name}": ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      type: "text",
      text: `[Error processing file: ${fileMeta.name}]`,
    };
  }
}
// --- End Improved File Content Processing ---

// --- History Builder Helper ---
export function buildHistoryMessages(
  historyInteractions: Interaction[],
): CoreMessage[] {
  return historyInteractions.flatMap((i): CoreMessage[] => {
    const msgs: CoreMessage[] = [];
    if (i.prompt?.content && typeof i.prompt.content === "string") {
      msgs.push({ role: "user", content: i.prompt.content });
    }

    if (i.response && typeof i.response === "string") {
      msgs.push({ role: "assistant", content: i.response });
    }

    if (i.metadata?.toolCalls && Array.isArray(i.metadata.toolCalls)) {
      const validToolCalls: ToolCallPart[] = [];
      i.metadata.toolCalls.forEach((callStr) => {
        try {
          const parsedCall = JSON.parse(callStr);
          if (
            parsedCall &&
            parsedCall.type === "tool-call" &&
            parsedCall.toolCallId &&
            parsedCall.toolName &&
            parsedCall.args !== undefined
          ) {
            validToolCalls.push(parsedCall as ToolCallPart);
          } else {
            console.warn(
              "[AIService] buildHistory: Invalid tool call structure after parsing:",
              callStr,
            );
          }
        } catch (e) {
          console.error(
            "[AIService] buildHistory: Failed to parse tool call string:",
            callStr,
            e,
          );
        }
      });
      if (validToolCalls.length > 0) {
        msgs.push({
          role: "assistant",
          content: validToolCalls,
        });
      }
    }

    if (i.metadata?.toolResults && Array.isArray(i.metadata.toolResults)) {
      const validToolResults: ToolResultPart[] = [];
      i.metadata.toolResults.forEach((resultStr) => {
        try {
          const parsedResult = JSON.parse(resultStr);
          if (
            parsedResult &&
            parsedResult.type === "tool-result" &&
            parsedResult.toolCallId &&
            parsedResult.toolName &&
            parsedResult.result !== undefined
          ) {
            validToolResults.push(parsedResult as ToolResultPart);
          } else {
            console.warn(
              "[AIService] buildHistory: Invalid tool result structure after parsing:",
              resultStr,
            );
          }
        } catch (e) {
          console.error(
            "[AIService] buildHistory: Failed to parse tool result string:",
            resultStr,
            e,
          );
        }
      });
      if (validToolResults.length > 0) {
        msgs.push({
          role: "tool",
          content: validToolResults,
        });
      }
    }

    return msgs;
  });
}
// --- End History Builder Helper ---

export class AIService {
  private static activeStreams = new Map<string, AbortController>();

  static async startInteraction(
    aiPayload: PromptObject,
    initiatingTurnData: PromptTurnObject,
  ): Promise<string | null> {
    const interactionStoreStateAndActions = useInteractionStore.getState();
    const conversationId =
      interactionStoreStateAndActions.currentConversationId;
    if (!conversationId) {
      interactionStoreStateAndActions.setError("No active conversation.");
      toast.error("Cannot start interaction: No active conversation.");
      return null;
    }

    const startMiddlewareResult = await runMiddleware(
      "middleware:interaction:beforeStart",
      { prompt: aiPayload, conversationId },
    );
    if (startMiddlewareResult === false) {
      console.log("AIService: Interaction start cancelled by middleware.");
      return null;
    }
    const finalPayload =
      startMiddlewareResult && typeof startMiddlewareResult === "object"
        ? (startMiddlewareResult as { prompt: PromptObject }).prompt
        : aiPayload;

    const interactionId = nanoid();
    const abortController = new AbortController();
    this.activeStreams.set(interactionId, abortController);

    const currentInteractions = interactionStoreStateAndActions.interactions;
    const conversationInteractions = currentInteractions.filter(
      (i) => i.conversationId === conversationId,
    );
    const newIndex =
      conversationInteractions.reduce((max, i) => Math.max(max, i.index), -1) +
      1;
    const parentId =
      conversationInteractions.length > 0
        ? conversationInteractions[conversationInteractions.length - 1].id
        : null;

    const finalMessages: CoreMessage[] = [...finalPayload.messages];
    let lastUserMessageIndex = -1;
    for (let i = finalMessages.length - 1; i >= 0; i--) {
      if (finalMessages[i].role === "user") {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (
      lastUserMessageIndex !== -1 &&
      initiatingTurnData.metadata?.attachedFiles &&
      initiatingTurnData.metadata.attachedFiles.length > 0
    ) {
      const userMessage = finalMessages[
        lastUserMessageIndex
      ] as CoreUserMessage;

      const fileContents = (
        initiatingTurnData.metadata.attachedFiles as AttachedFileMetadata[]
      )
        .map(processFileMetaToUserContent)
        .filter((content): content is TextPart | ImagePart => content !== null);

      let userMessageContentParts: (TextPart | ImagePart)[] = [];
      if (typeof userMessage.content === "string") {
        if (userMessage.content.trim()) {
          userMessageContentParts.push({
            type: "text",
            text: userMessage.content,
          });
        }
      } else if (Array.isArray(userMessage.content)) {
        userMessageContentParts = (userMessage.content as any[]).filter(
          (part): part is TextPart | ImagePart =>
            part &&
            typeof part === "object" &&
            "type" in part &&
            (part.type === "text" || part.type === "image"),
        );
      }

      finalMessages[lastUserMessageIndex] = {
        ...userMessage,
        content: [...fileContents, ...userMessageContentParts],
      };
      console.log(
        `AIService: Added ${fileContents.length} file(s) to user message content.`,
      );
    }

    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
      prompt: { ...initiatingTurnData },
      response: null,
      status: "STREAMING",
      startedAt: new Date(),
      endedAt: null,
      metadata: {
        ...finalPayload.metadata,
        attachedFiles: initiatingTurnData.metadata.attachedFiles?.map(
          ({ contentBase64, contentText, ...rest }) => rest,
        ),
        toolCalls: [],
        toolResults: [],
      },
      index: newIndex,
      parentId: parentId,
    };

    interactionStoreStateAndActions._addInteractionToState(interactionData);
    interactionStoreStateAndActions._addStreamingId(interactionId);
    PersistenceService.saveInteraction({ ...interactionData }).catch((e) => {
      console.error(
        `AIService: Failed initial persistence for ${interactionId}`,
        e,
      );
    });

    emitter.emit("interaction:started", {
      interactionId,
      conversationId,
      type: interactionData.type,
    });

    let streamResult: StreamTextResult<any, any> | undefined;
    let finalStatus: Interaction["status"] = "ERROR";
    let finalErrorMessage: string | undefined = undefined;
    let finalUsage: LanguageModelUsage | undefined = undefined;
    let finalProviderMetadata: ProviderMetadata | undefined = undefined;
    let finalFinishReason: FinishReason | undefined = undefined;

    const currentToolCallStrings: string[] = [];
    const currentToolResultStrings: string[] = [];

    try {
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance;
      if (!modelInstance) {
        throw new Error("Selected model instance not available.");
      }

      const allRegisteredTools = useControlRegistryStore
        .getState()
        .getRegisteredTools();
      const enabledToolNames = finalPayload.metadata?.enabledTools ?? [];

      const toolsWithExecute = enabledToolNames.reduce(
        (acc, name) => {
          const toolInfo = allRegisteredTools[name];
          if (toolInfo) {
            const toolDefinition: Tool<any> = { ...toolInfo.definition };
            if (toolInfo.implementation) {
              toolDefinition.execute = async (args: any) => {
                try {
                  const contextSnapshot = getContextSnapshot();
                  const parsedArgs = toolInfo.definition.parameters.parse(args);
                  const implementation: ToolImplementation<any> =
                    toolInfo.implementation!;
                  return await implementation(parsedArgs, contextSnapshot);
                } catch (e) {
                  console.error(
                    `[AIService] Error executing tool ${name} via SDK:`,
                    e,
                  );
                  const toolError = e instanceof Error ? e.message : String(e);
                  if (e instanceof z.ZodError) {
                    return {
                      _isError: true,
                      error: `Invalid arguments: ${e.errors.map((err) => `${err.path.join(".")} (${err.message})`).join(", ")}`,
                    };
                  }
                  return { _isError: true, error: toolError };
                }
              };
            }
            acc[name] = toolDefinition;
          }
          return acc;
        },
        {} as Record<string, Tool<any>>,
      );

      const maxSteps =
        finalPayload.parameters?.maxSteps ??
        useSettingsStore.getState().toolMaxSteps;

      const streamOptions: Parameters<typeof streamText>[0] = {
        model: modelInstance as LanguageModelV1,
        messages: finalMessages,
        abortSignal: abortController.signal,
        maxSteps: maxSteps,
      };

      if (Object.keys(toolsWithExecute).length > 0) {
        streamOptions.tools = toolsWithExecute;
      }

      streamOptions.toolChoice =
        finalPayload.toolChoice ??
        (Object.keys(toolsWithExecute).length > 0 ? "auto" : "none");

      if (finalPayload.system) {
        streamOptions.system = finalPayload.system;
      }
      if (finalPayload.parameters) {
        if (finalPayload.parameters.temperature !== undefined)
          streamOptions.temperature = finalPayload.parameters.temperature;
        if (finalPayload.parameters.max_tokens !== undefined)
          streamOptions.maxTokens = finalPayload.parameters.max_tokens;
        if (finalPayload.parameters.top_p !== undefined)
          streamOptions.topP = finalPayload.parameters.top_p;
        if (finalPayload.parameters.top_k !== undefined)
          streamOptions.topK = finalPayload.parameters.top_k;
        if (finalPayload.parameters.presence_penalty !== undefined)
          streamOptions.presencePenalty =
            finalPayload.parameters.presence_penalty;
        if (finalPayload.parameters.frequency_penalty !== undefined)
          streamOptions.frequencyPenalty =
            finalPayload.parameters.frequency_penalty;
      }

      console.log(
        `AIService: Calling streamText with options for ${interactionId}:`,
        {
          model: streamOptions.model,
          messages: JSON.stringify(streamOptions.messages),
          system: streamOptions.system,
          temperature: streamOptions.temperature,
          maxTokens: streamOptions.maxTokens,
          topP: streamOptions.topP,
          topK: streamOptions.topK,
          presencePenalty: streamOptions.presencePenalty,
          frequencyPenalty: streamOptions.frequencyPenalty,
          toolChoice: streamOptions.toolChoice,
          tools: streamOptions.tools
            ? Object.keys(streamOptions.tools)
            : undefined,
          maxSteps: streamOptions.maxSteps,
        },
      );

      streamResult = await streamText(streamOptions);

      for await (const part of streamResult.fullStream as AsyncIterable<
        TextStreamPart<any>
      >) {
        if (abortController.signal.aborted) {
          console.log(`AIService: Stream ${interactionId} aborted by signal.`);
          finalFinishReason = "stop";
          throw new Error("Stream aborted by user.");
        }

        switch (part.type) {
          case "text-delta": {
            const chunkPayload = { interactionId, chunk: part.textDelta };
            const chunkResult = await runMiddleware(
              "middleware:interaction:processChunk",
              chunkPayload,
            );
            if (chunkResult !== false) {
              const processedChunk =
                chunkResult &&
                typeof chunkResult === "object" &&
                "chunk" in chunkResult
                  ? chunkResult.chunk
                  : part.textDelta;
              useInteractionStore
                .getState()
                .appendInteractionResponseChunk(interactionId, processedChunk);
              emitter.emit("interaction:stream_chunk", {
                interactionId,
                chunk: processedChunk,
              });
            }
            break;
          }
          case "tool-call": {
            const callString = JSON.stringify(part);
            currentToolCallStrings.push(callString);
            useInteractionStore
              .getState()
              ._updateInteractionInState(interactionId, {
                metadata: {
                  ...useInteractionStore
                    .getState()
                    .interactions.find((i) => i.id === interactionId)?.metadata,
                  toolCalls: [...currentToolCallStrings],
                },
              });
            console.log(
              `[AIService] Tool call observed: ${part.toolName}`,
              part.args,
            );
            break;
          }
          case "tool-result": {
            const resultString = JSON.stringify(part);
            currentToolResultStrings.push(resultString);
            useInteractionStore
              .getState()
              ._updateInteractionInState(interactionId, {
                metadata: {
                  ...useInteractionStore
                    .getState()
                    .interactions.find((i) => i.id === interactionId)?.metadata,
                  toolResults: [...currentToolResultStrings],
                },
              });
            console.log(
              `[AIService] Tool result observed for ${part.toolName} (Call ID: ${part.toolCallId})`,
              part.result,
            );
            break;
          }
          case "finish":
            console.log("[AIService] Stream finish part received:", part);
            finalFinishReason = part.finishReason;
            finalUsage = part.usage;
            finalProviderMetadata = part.providerMetadata;
            break;
          case "error":
            console.error("[AIService] Stream error part:", part.error);
            finalFinishReason = "error";
            throw new Error(
              `AI Stream Error: ${part.error instanceof Error ? part.error.message : part.error}`,
            );
          case "reasoning":
          case "reasoning-signature":
          case "redacted-reasoning":
          case "source":
          case "file":
          case "tool-call-streaming-start":
          case "tool-call-delta":
          case "step-start":
          case "step-finish":
            break;
        }
      }

      if (abortController.signal.aborted) {
        finalFinishReason = "stop";
        throw new Error("Stream aborted by user.");
      }

      if (finalFinishReason === undefined) {
        console.warn(
          `[AIService] Stream loop finished for ${interactionId} without receiving a 'finish' part.`,
        );
        finalFinishReason = "other";
      }
    } catch (error: unknown) {
      console.error(
        `AIService: Error during interaction ${interactionId}:`,
        error,
      );
      const isAbort =
        error instanceof Error && error.message === "Stream aborted by user.";
      finalFinishReason = finalFinishReason ?? (isAbort ? "stop" : "error");
      finalErrorMessage = isAbort
        ? undefined
        : error instanceof Error
          ? error.message
          : String(error);

      if (isAbort) {
        console.log(`AIService: Interaction ${interactionId} cancelled.`);
        toast.info("Interaction cancelled.");
      } else {
        toast.error(`AI Interaction Error: ${finalErrorMessage}`);
      }
    } finally {
      this.activeStreams.delete(interactionId);
      const finalBufferedContent =
        useInteractionStore.getState().activeStreamBuffers[interactionId] || "";

      switch (finalFinishReason) {
        case "stop":
        case "length":
        case "tool-calls":
          finalStatus = "COMPLETED";
          break;
        case "error":
          finalStatus = "ERROR";
          break;
        case "other":
        default:
          if (
            finalBufferedContent.trim() ||
            currentToolCallStrings.length > 0
          ) {
            finalStatus = "COMPLETED";
            console.warn(
              `[AIService] Interaction ${interactionId} finished with reason '${finalFinishReason || "unknown"}', but content exists. Marking COMPLETED.`,
            );
          } else {
            finalStatus = "WARNING";
            finalErrorMessage =
              finalErrorMessage ?? "Stream ended unexpectedly without output.";
            console.warn(
              `[AIService] Interaction ${interactionId} finished with reason '${finalFinishReason || "unknown"}' and no content. Marking WARNING.`,
            );
          }
          break;
      }

      const currentInteractionMetadata =
        useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId)?.metadata ||
        interactionData.metadata;

      const finalUpdates: Partial<Interaction> = {
        status: finalStatus,
        endedAt: new Date(),
        response: finalBufferedContent,
        metadata: {
          ...currentInteractionMetadata,
          ...(finalUsage && {
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.totalTokens,
          }),
          ...(finalProviderMetadata && {
            providerMetadata: finalProviderMetadata,
          }),
          ...((finalStatus === "ERROR" || finalStatus === "WARNING") && {
            error: finalErrorMessage,
          }),
          toolCalls: currentToolCallStrings,
          toolResults: currentToolResultStrings,
          attachedFiles: interactionData.metadata.attachedFiles?.map(
            ({ contentBase64, contentText, ...rest }) => rest,
          ),
        },
      };

      useInteractionStore
        .getState()
        ._updateInteractionInState(interactionId, finalUpdates);
      useInteractionStore.getState()._removeStreamingId(interactionId);

      const finalInteractionState = useInteractionStore
        .getState()
        .interactions.find((i) => i.id === interactionId);

      if (finalInteractionState) {
        useInteractionStore
          .getState()
          .updateInteractionAndPersist({ ...finalInteractionState })
          .catch((e) => {
            console.error(
              `AIService: Failed final persistence for ${interactionId}`,
              e,
            );
          });
      } else {
        console.error(
          `AIService: CRITICAL - Could not find final state for interaction ${interactionId} to persist after updates. State might be inconsistent.`,
        );
      }

      let parsedToolCalls: ToolCallPart[] = [];
      let parsedToolResults: ToolResultPart[] = [];
      try {
        parsedToolCalls = currentToolCallStrings.map((s) => JSON.parse(s));
        parsedToolResults = currentToolResultStrings.map((s) => JSON.parse(s));
      } catch (e) {
        console.error(
          `[AIService] Failed to parse tool strings for event emitter:`,
          e,
        );
      }

      emitter.emit("interaction:completed", {
        interactionId,
        status: finalStatus,
        error: finalErrorMessage ?? undefined,
        toolCalls: parsedToolCalls,
        toolResults: parsedToolResults,
      });
      console.log(
        `AIService: Finalized interaction ${interactionId} with status ${finalStatus}.`,
      );
    }
    return interactionId;
  }

  static stopInteraction(interactionId: string) {
    const controller = this.activeStreams.get(interactionId);
    const interactionStoreActions = useInteractionStore.getState();

    if (controller && !controller.signal.aborted) {
      console.log(`AIService: Aborting interaction ${interactionId}...`);
      controller.abort();
    } else {
      console.log(
        `AIService: No active controller found or already aborted for interaction ${interactionId}. Attempting store cleanup if needed.`,
      );
      const interaction = interactionStoreActions.interactions.find(
        (i) => i.id === interactionId,
      );
      if (
        interaction &&
        interaction.status === "STREAMING" &&
        (!controller || controller.signal.aborted)
      ) {
        console.warn(
          `AIService: Forcing CANCELLED status for interaction ${interactionId} without active controller or already aborted.`,
        );

        const finalBufferedContent =
          interactionStoreActions.activeStreamBuffers[interactionId] || "";

        const finalUpdates: Partial<Interaction> = {
          status: "CANCELLED",
          endedAt: new Date(),
          response: finalBufferedContent,
        };

        interactionStoreActions._updateInteractionInState(
          interactionId,
          finalUpdates,
        );
        interactionStoreActions._removeStreamingId(interactionId);

        const finalInteractionState = useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId);
        if (finalInteractionState) {
          interactionStoreActions
            .updateInteractionAndPersist({ ...finalInteractionState })
            .catch((e) => {
              console.error(
                `AIService: Failed persistence for forced cancel of ${interactionId}`,
                e,
              );
            });
        }
      }
    }
  }
}
