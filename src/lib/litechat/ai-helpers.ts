// src/lib/litechat/ai-helpers.ts
import type {
  ModMiddlewareHookName,
  ModMiddlewarePayloadMap,
  ModMiddlewareReturnMap,
  ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import type { Interaction } from "@/types/litechat/interaction";
import type { AttachedFileMetadata } from "@/store/input.store";
import { useControlRegistryStore } from "@/store/control.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { useSettingsStore } from "@/store/settings.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { toast } from "sonner";
import type {
  CoreMessage,
  ImagePart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "ai";

/**
 * Runs registered middleware functions for a specific hook.
 * @param hookName The name of the middleware hook.
 * @param initialPayload The initial data payload for the middleware.
 * @returns The processed payload or false if cancelled by middleware.
 */
export async function runMiddleware<H extends ModMiddlewareHookName>(
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

/**
 * Gets a read-only snapshot of the current chat context.
 * @returns A frozen snapshot object.
 */
export function getContextSnapshot(): ReadonlyChatContextSnapshot {
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
  return Object.freeze(snapshot); // Ensure deep freeze if necessary
}

/**
 * Converts a base64 string to a Uint8Array.
 * @param base64 The base64 encoded string.
 * @returns The corresponding Uint8Array.
 * @throws Error if the base64 string is invalid.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
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

// List of common text file extensions for content processing
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

/**
 * Processes attached file metadata into AI SDK compatible content parts (TextPart or ImagePart).
 * Handles text content, base64 image content, and provides fallbacks for other types.
 * @param fileMeta Metadata of the attached file.
 * @returns A TextPart, ImagePart, or null if processing fails critically.
 */
export function processFileMetaToUserContent(
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
      // For non-text, non-image files with base64, send a note instead of raw data
      console.warn(
        `AIService: Unsupported file type "${mimeType}" for direct inclusion. Sending note.`,
      );
      return {
        type: "text",
        text: `[Attached file: ${fileMeta.name} (${mimeType})]`,
      };
    } else {
      // Handle cases where content is missing or type is ambiguous
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
    // Return a text part indicating the error
    return {
      type: "text",
      text: `[Error processing file: ${fileMeta.name}]`,
    };
  }
}

/**
 * Builds an array of CoreMessages suitable for the AI SDK from interaction history.
 * Parses tool calls and results stored as JSON strings.
 * @param historyInteractions Array of past interactions.
 * @returns An array of CoreMessage objects.
 */
export function buildHistoryMessages(
  historyInteractions: Interaction[],
): CoreMessage[] {
  return historyInteractions.flatMap((i): CoreMessage[] => {
    const msgs: CoreMessage[] = [];

    // Add user message if content exists
    if (i.prompt?.content && typeof i.prompt.content === "string") {
      msgs.push({ role: "user", content: i.prompt.content });
    } else if (
      i.prompt?.metadata?.attachedFiles &&
      i.prompt.metadata.attachedFiles.length > 0 &&
      !i.prompt?.content
    ) {
      // If only files were attached, represent the user turn with an empty content message
      // This might be necessary for some models to acknowledge the file input turn.
      // Alternatively, omit this turn if the model handles file-only input implicitly.
      // Let's include it for now for broader compatibility.
      // msgs.push({ role: "user", content: "" });
      // Omit user turn if only files and no text content
    }

    // Add assistant text response
    if (i.response && typeof i.response === "string") {
      msgs.push({ role: "assistant", content: i.response });
    }

    // Add assistant tool calls (parsed from JSON strings)
    if (i.metadata?.toolCalls && Array.isArray(i.metadata.toolCalls)) {
      const validToolCalls: ToolCallPart[] = [];
      i.metadata.toolCalls.forEach((callStr) => {
        try {
          const parsedCall = JSON.parse(callStr);
          // Validate the parsed structure matches ToolCallPart
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
          content: validToolCalls, // Add the array of valid tool calls
        });
      }
    }

    // Add tool results (parsed from JSON strings)
    if (i.metadata?.toolResults && Array.isArray(i.metadata.toolResults)) {
      const validToolResults: ToolResultPart[] = [];
      i.metadata.toolResults.forEach((resultStr) => {
        try {
          const parsedResult = JSON.parse(resultStr);
          // Validate the parsed structure matches ToolResultPart
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
          content: validToolResults, // Add the array of valid tool results
        });
      }
    }

    return msgs;
  });
}
