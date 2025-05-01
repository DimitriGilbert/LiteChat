// src/lib/litechat/ai-helpers.ts
// Ensure necessary functions are exported and update imports if needed
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
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
// Import VFS store to check configured key alongside the global VFS instance

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
  return Object.freeze(snapshot)
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

// Constants and helper function moved to file-extensions.ts

/**
 * Processes attached file metadata *with its content* into AI SDK compatible parts.
 * Handles text content, base64 image content, and provides fallbacks for other types.
 * Assumes content (contentText, contentBase64, or contentBytes) is present in fileMeta.
 * @param fileMeta Metadata of the attached file, augmented with content.
 * @returns A TextPart, ImagePart, or null if processing fails critically.
 */
export function processFileMetaToUserContent(
  fileMeta: AttachedFileMetadata & { contentBytes?: Uint8Array }
): TextPart | ImagePart | null {
  try {
    const mimeType = fileMeta.type || "application/octet-stream";
    // Use the robust helper function here
    const isText = isLikelyTextFile(fileMeta.name, mimeType);
    const isImage = mimeType.startsWith("image/");

    // Prioritize contentBytes if available (from VFS)
    if (fileMeta.contentBytes !== undefined) {
      if (isText) {
        const textDecoder = new TextDecoder();
        return {
          type: "text",
          text: textDecoder.decode(fileMeta.contentBytes),
        };
      } else if (isImage) {
        return {
          type: "image",
          image: fileMeta.contentBytes,
          mimeType: mimeType,
        };
      } else {
        // Non-text, non-image from VFS - send note
        console.warn(
          `AIService: Unsupported VFS file type "${mimeType}" for direct inclusion. Sending note.`,
        );
        return {
          type: "text",
          text: `[Attached VFS file: ${fileMeta.name} (${mimeType})]`,
        };
      }
    }
    // Handle direct uploads if contentBytes are not present
    else if (fileMeta.contentText !== undefined && isText) {
      return { type: "text", text: fileMeta.contentText };
    } else if (fileMeta.contentBase64 !== undefined && isImage) {
      const buffer = base64ToUint8Array(fileMeta.contentBase64);
      return { type: "image", image: buffer, mimeType: mimeType };
    } else if (fileMeta.contentBase64 !== undefined && !isText && !isImage) {
      // Non-text, non-image direct upload - send note
      console.warn(
        `AIService: Unsupported direct upload type "${mimeType}" for direct inclusion. Sending note.`,
      );
      return {
        type: "text",
        text: `[Attached file: ${fileMeta.name} (${mimeType})]`,
      };
    } else {
      // Handle cases where content is missing or type is ambiguous
      // If it's likely text based on name but contentText is missing, it's an error
      if (isText && fileMeta.contentText === undefined) {
        throw new Error(
          `Missing text content for likely text file: ${fileMeta.name}`,
        );
      }
      // If it's likely image based on MIME but contentBase64 is missing, it's an error
      if (isImage && fileMeta.contentBase64 === undefined) {
        throw new Error(
          `Missing base64 content for image file: ${fileMeta.name}`,
        );
      }
      // Otherwise, treat as unsupported/unknown
      throw new Error(`Missing or unusable content for file: ${fileMeta.name}`);
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

    // Add user message if content exists or files were attached
    // Check the original prompt turn data stored in the interaction
    const userPrompt = i.prompt;
    if (userPrompt) {
      const userMessageContentParts: (TextPart | ImagePart)[] = [];
      // Add file parts first (reconstruct from basic metadata if needed, though ideally not necessary here)
      // For history, we primarily care about the text content. If files were complex (images),
      // they might not be fully represented unless stored differently.
      // Let's assume for history we only need the text part.
      if (userPrompt.content) {
        userMessageContentParts.push({
          type: "text",
          text: userPrompt.content,
        });
      }
      // Add placeholders for files if they existed, for context
      if (
        userPrompt.metadata?.attachedFiles &&
        userPrompt.metadata.attachedFiles.length > 0
      ) {
        userPrompt.metadata.attachedFiles.forEach((f) => {
          userMessageContentParts.push({
            type: "text",
            text: `[User attached file: ${f.name}]`,
          });
        });
      }

      if (userMessageContentParts.length > 0) {
        msgs.push({ role: "user", content: userMessageContentParts });
      }
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
          content: validToolCalls
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
          content: validToolResults
        });
      }
    }

    return msgs;
  });
}
