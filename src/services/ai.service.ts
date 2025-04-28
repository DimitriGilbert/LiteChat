// src/services/ai.service.ts
import type { PromptObject, PromptTurnObject } from "@/types/litechat/prompt";
import type { Interaction } from "@/types/litechat/interaction";
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ReadonlyChatContextSnapshot,
  ToolImplementation, // Keep this for ToolImplementation type usage
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
  ToolCallPart, // Still need the type for receiving from SDK
  ToolResultPart, // Still need the type for receiving from SDK
  TextPart,
  ImagePart,
  CoreUserMessage,
  Tool,
  // StreamTextOptions removed - no longer exported
} from "ai";
import { emitter } from "@/lib/litechat/event-emitter";
import { useProviderStore } from "@/store/provider.store";
import { toast } from "sonner";
import { z } from "zod";
import { PersistenceService } from "@/services/persistence.service";
import { type AttachedFileMetadata } from "@/store/input.store";

// Define the options type locally using Parameters
type StreamTextParameters = Parameters<typeof streamText>[0];

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

// Helper to split combined ID remains the same
const splitModelId = (
  combinedId: string | null,
): { providerId: string | null; modelId: string | null } => {
  if (!combinedId || !combinedId.includes(":")) {
    return { providerId: null, modelId: null };
  }
  const parts = combinedId.split(":");
  const providerId = parts[0];
  const modelId = parts.slice(1).join(":");
  return { providerId, modelId };
};

// Helper to get context snapshot remains the same
function getContextSnapshot(): ReadonlyChatContextSnapshot {
  const iS = useInteractionStore.getState();
  const pS = useProviderStore.getState();
  const sS = useSettingsStore.getState();
  const { providerId } = splitModelId(pS.selectedModelId);
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

// Helper function to convert base64 string to Uint8Array (remains the same)
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
      mimeType === "application/json" || // Treat JSON as text
      COMMON_TEXT_EXTENSIONS.some((ext) => fileNameLower.endsWith(ext));
    const isImage = mimeType.startsWith("image/");

    if (isLikelyText && fileMeta.contentText !== undefined) {
      return { type: "text", text: fileMeta.contentText };
    } else if (isImage && fileMeta.contentBase64 !== undefined) {
      const buffer = base64ToUint8Array(fileMeta.contentBase64);
      return { type: "image", image: buffer, mimeType: mimeType };
    } else if (!isLikelyText && fileMeta.contentBase64 !== undefined) {
      // Handle other non-text, non-image types (e.g., audio, video, pdf)
      // For now, just send a note. Future: could support specific types if model allows.
      console.warn(
        `AIService: Unsupported file type "${mimeType}" for direct inclusion. Sending note.`,
      );
      return {
        type: "text",
        text: `[Attached file: ${fileMeta.name} (${mimeType})]`,
      };
    } else {
      // Content is missing or type is ambiguous without content
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
    // Add user message (if it exists)
    if (i.prompt?.content && typeof i.prompt.content === "string") {
      msgs.push({ role: "user", content: i.prompt.content });
    }

    // Add assistant response (text part)
    if (i.response && typeof i.response === "string") {
      msgs.push({ role: "assistant", content: i.response });
    }

    // Add assistant tool calls (parse from stored strings)
    if (i.metadata?.toolCalls && Array.isArray(i.metadata.toolCalls)) {
      const validToolCalls: ToolCallPart[] = [];
      i.metadata.toolCalls.forEach((callStr) => {
        try {
          const parsedCall = JSON.parse(callStr);
          // Basic validation
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

    // Add tool results (parse from stored strings)
    if (i.metadata?.toolResults && Array.isArray(i.metadata.toolResults)) {
      const validToolResults: ToolResultPart[] = [];
      i.metadata.toolResults.forEach((resultStr) => {
        try {
          const parsedResult = JSON.parse(resultStr);
          // Basic validation
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
    aiPayload: PromptObject, // Metadata here might lack content if modified by middleware
    initiatingTurnData: PromptTurnObject, // This *must* have the content
  ): Promise<string | null> {
    const interactionStoreStateAndActions = useInteractionStore.getState();
    const conversationId =
      interactionStoreStateAndActions.currentConversationId;
    if (!conversationId) {
      interactionStoreStateAndActions.setError("No active conversation.");
      toast.error("Cannot start interaction: No active conversation.");
      return null;
    }

    // Run middleware on the AI payload (which lacks file content in metadata)
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

    // --- Prepare final messages including file content ---
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
        userMessageContentParts.push({
          type: "text",
          text: userMessage.content,
        });
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
    // --- End message preparation ---

    // Create interaction data snapshot using the initiating turn data (with content)
    const interactionData: Interaction = {
      id: interactionId,
      conversationId: conversationId,
      type: "message.user_assistant",
      // Save the initiating turn data snapshot, which includes file content
      prompt: { ...initiatingTurnData },
      response: null,
      status: "STREAMING",
      startedAt: new Date(),
      endedAt: null,
      // Metadata from the final payload (after middleware)
      // This metadata is for quick reference and should NOT contain full file content
      metadata: {
        ...finalPayload.metadata,
        // Ensure attachedFiles here only contains basic info (NO content)
        // We map over the initiatingTurnData's files to get the basic info
        // because finalPayload.metadata.attachedFiles might have been altered by middleware
        attachedFiles: initiatingTurnData.metadata.attachedFiles?.map(
          ({ contentBase64, contentText, ...rest }) => rest, // eslint-disable-line @typescript-eslint/no-unused-vars
        ),
        // Initialize tool call/result arrays (as string arrays)
        toolCalls: [],
        toolResults: [],
      },
      index: newIndex,
      parentId: parentId,
    };

    // Add interaction to state and persist (initial save)
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

    console.log(
      `AIService: Starting AI call for interaction: ${interactionId} with final messages:`,
      JSON.stringify(finalMessages, null, 2),
    );

    // --- AI Call and Streaming Logic ---
    let streamResult: StreamTextResult<any, any> | undefined;
    let finalStatus: Interaction["status"] = "ERROR";
    let finalErrorMessage: string | undefined = undefined;
    let finalUsage: LanguageModelUsage | undefined = undefined;
    let finalProviderMetadata: ProviderMetadata | undefined = undefined;
    let streamFinishedSuccessfully = false;
    // Store stringified versions during the stream
    const currentToolCallStrings: string[] = [];
    const currentToolResultStrings: string[] = [];

    try {
      const modelInstance = useProviderStore
        .getState()
        .getSelectedModel()?.instance;
      if (!modelInstance) {
        throw new Error("Selected model instance not available.");
      }

      // --- Tool Preparation ---
      const allRegisteredTools = useControlRegistryStore
        .getState()
        .getRegisteredTools();
      const enabledToolNames = finalPayload.metadata?.enabledTools ?? [];

      // Filter tools based on enabled names
      const enabledToolsForSdk = enabledToolNames.reduce(
        (acc, name) => {
          if (allRegisteredTools[name]) {
            acc[name] = allRegisteredTools[name].definition;
          }
          return acc;
        },
        {} as Record<string, Tool<any>>,
      );

      const enabledToolExecutors = enabledToolNames.reduce(
        (acc, name) => {
          const toolInfo = allRegisteredTools[name];
          if (toolInfo?.implementation) {
            acc[name] = async (args: any) => {
              try {
                const parsedArgs = toolInfo.definition.parameters.parse(args);
                // Use the imported ToolImplementation type here
                const implementation: ToolImplementation<any> =
                  toolInfo.implementation!;
                return await implementation(parsedArgs, getContextSnapshot());
              } catch (e) {
                console.error(`[AIService] Error executing tool ${name}:`, e);
                const toolError = e instanceof Error ? e.message : String(e);
                if (e instanceof z.ZodError) {
                  return {
                    error: `Invalid arguments: ${e.errors.map((err) => `${err.path.join(".")} (${err.message})`).join(", ")}`,
                  };
                }
                return { error: toolError };
              }
            };
          }
          return acc;
        },
        {} as Record<string, (args: any) => Promise<any>>,
      );
      // --- End Tool Preparation ---

      // Define the type for streamOptions using the inferred type
      const streamOptions: StreamTextParameters = {
        model: modelInstance as LanguageModelV1,
        messages: finalMessages, // Use messages with processed file content
        abortSignal: abortController.signal,
      };

      // Conditionally add tools and toolExecutors
      if (Object.keys(enabledToolsForSdk).length > 0) {
        streamOptions.tools = enabledToolsForSdk;
      }
      // The AI SDK expects `toolExecutors` to be part of the main options object
      // if (Object.keys(enabledToolExecutors).length > 0) {
      //   streamOptions.toolExecutors = enabledToolExecutors; // This line might be incorrect based on SDK v4 structure
      // }
      // Instead, tool execution is handled internally by streamText if tools are provided
      // and the tools have an `execute` method defined.
      // Let's adjust the tool definition part to include execute if available.

      // Rebuild enabledToolsForSdk to potentially include execute
      const toolsWithExecute = enabledToolNames.reduce(
        (acc, name) => {
          const toolInfo = allRegisteredTools[name];
          if (toolInfo) {
            const toolDefinition: Tool<any> = { ...toolInfo.definition }; // Copy definition
            if (toolInfo.implementation) {
              // Add the execute function wrapper
              toolDefinition.execute = async (args: any) => {
                try {
                  const parsedArgs = toolInfo.definition.parameters.parse(args);
                  const implementation: ToolImplementation<any> =
                    toolInfo.implementation!;
                  return await implementation(parsedArgs, getContextSnapshot());
                } catch (e) {
                  console.error(
                    `[AIService] Error executing tool ${name} via SDK:`,
                    e,
                  );
                  const toolError = e instanceof Error ? e.message : String(e);
                  if (e instanceof z.ZodError) {
                    // Return a structure indicating error for the SDK
                    // The exact format might depend on how the SDK handles tool errors internally
                    // Returning the error message might be sufficient for the SDK to format a ToolResultPart
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

      if (Object.keys(toolsWithExecute).length > 0) {
        streamOptions.tools = toolsWithExecute;
      }

      // Assign toolChoice using the type from PromptObject
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

      // Pass the correctly typed streamOptions
      streamResult = await streamText(streamOptions);

      for await (const part of streamResult.fullStream) {
        if (abortController.signal.aborted) {
          console.log(`AIService: Stream ${interactionId} aborted by signal.`);
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
            const callString = JSON.stringify(part); // Stringify the part
            currentToolCallStrings.push(callString);
            // Update interaction state immediately with the stringified call
            useInteractionStore
              .getState()
              ._updateInteractionInState(interactionId, {
                metadata: {
                  ...useInteractionStore
                    .getState()
                    .interactions.find((i) => i.id === interactionId)?.metadata,
                  toolCalls: [...currentToolCallStrings], // Update with the new string
                },
              });
            console.log(
              `[AIService] Tool call observed: ${part.toolName}`,
              part.args,
            );
            break;
          }
          case "tool-result": {
            const resultString = JSON.stringify(part); // Stringify the part
            currentToolResultStrings.push(resultString);
            // Update interaction state immediately with the stringified result
            useInteractionStore
              .getState()
              ._updateInteractionInState(interactionId, {
                metadata: {
                  ...useInteractionStore
                    .getState()
                    .interactions.find((i) => i.id === interactionId)?.metadata,
                  toolResults: [...currentToolResultStrings], // Update with the new string
                },
              });
            console.log(
              `[AIService] Tool result observed for ${part.toolName} (Call ID: ${part.toolCallId})`,
              part.result,
            );
            break;
          }
          case "finish":
            console.log("[AIService] Stream finished part:", part);
            finalUsage = part.usage;
            finalProviderMetadata = part.providerMetadata;
            streamFinishedSuccessfully = true;
            break;
          case "error":
            console.error("[AIService] Stream error part:", part.error);
            throw new Error(
              `AI Stream Error: ${part.error instanceof Error ? part.error.message : part.error}`,
            );
          // Handle other part types if necessary (e.g., 'step-start', 'step-finish')
          // case 'step-start':
          //   console.log('[AIService] Step start:', part);
          //   break;
          // case 'step-finish':
          //   console.log('[AIService] Step finish:', part);
          //   // Accumulate usage if needed
          //   break;
        }
      }

      if (abortController.signal.aborted) {
        throw new Error("Stream aborted by user.");
      }

      if (streamFinishedSuccessfully) {
        finalStatus = "COMPLETED";
        console.log(`AIService: Interaction ${interactionId} completed.`);
      } else {
        console.warn(
          `AIService: Stream loop finished for ${interactionId} but no 'finish' event received.`,
        );
        finalStatus = "ERROR";
        finalErrorMessage =
          "Stream finished unexpectedly without completion signal.";
      }
    } catch (error: unknown) {
      console.error(
        `AIService: Error during interaction ${interactionId}:`,
        error,
      );
      const isAbort =
        error instanceof Error && error.message === "Stream aborted by user.";
      finalStatus = isAbort ? "CANCELLED" : "ERROR";
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

      // Get the latest metadata from the store *before* updating
      // This includes the basic attachedFiles info (without content)
      const currentInteractionMetadata =
        useInteractionStore
          .getState()
          .interactions.find((i) => i.id === interactionId)?.metadata ||
        interactionData.metadata;

      const finalUpdates: Partial<Interaction> = {
        status: finalStatus,
        endedAt: new Date(),
        response: finalBufferedContent,
        // Update the top-level metadata, ensuring attachedFiles has no content
        metadata: {
          ...currentInteractionMetadata, // Start with existing metadata
          ...(finalUsage && {
            promptTokens: finalUsage.promptTokens,
            completionTokens: finalUsage.completionTokens,
            totalTokens: finalUsage.totalTokens,
          }),
          ...(finalProviderMetadata && {
            providerMetadata: finalProviderMetadata,
          }),
          ...(finalStatus === "ERROR" && { error: finalErrorMessage }),
          // Ensure final tool calls/results (as strings) are included
          toolCalls: currentToolCallStrings,
          toolResults: currentToolResultStrings,
          // Ensure attachedFiles metadata *without* content is preserved/updated
          // We use the metadata from the *initial* interaction data here
          // as it reliably contains the basic file info before any middleware modification
          attachedFiles: interactionData.metadata.attachedFiles?.map(
            // @ts-expect-error i don't care about any
            ({ contentBase64, contentText, ...rest }) => rest, // eslint-disable-line @typescript-eslint/no-unused-vars
          ),
        },
        // IMPORTANT: The `prompt` field (PromptTurnObject snapshot) is NOT updated here.
        // It remains as it was when the interaction was created, preserving the original input including file content.
      };

      // Update the interaction state synchronously
      useInteractionStore
        .getState()
        ._updateInteractionInState(interactionId, finalUpdates);
      useInteractionStore.getState()._removeStreamingId(interactionId);

      // Fetch the final state *after* synchronous updates for persistence
      const finalInteractionState = useInteractionStore
        .getState()
        .interactions.find((i) => i.id === interactionId);

      if (finalInteractionState) {
        // Persist the final state (including the original prompt snapshot)
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

      // Parse strings back to objects for the event emitter
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
        toolCalls: parsedToolCalls, // Emit parsed objects
        toolResults: parsedToolResults, // Emit parsed objects
      });
      console.log(
        `AIService: Finalized interaction ${interactionId} with status ${finalStatus}.`,
      );
    }
    return interactionId;
  }

  // stopInteraction remains the same
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
