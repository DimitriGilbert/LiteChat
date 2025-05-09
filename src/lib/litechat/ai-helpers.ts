// src/lib/litechat/ai-helpers.ts
// FULL FILE
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

export async function runMiddleware<H extends ModMiddlewareHookName>(
  hookName: H,
  initialPayload: ModMiddlewarePayloadMap[H]
): Promise<ModMiddlewareReturnMap[H]> {
  const getMiddleware = useControlRegistryStore.getState().getMiddlewareForHook;
  const middlewareCallbacks = getMiddleware(hookName);
  let currentPayload = initialPayload;

  for (const middleware of middlewareCallbacks) {
    try {
      const result = await middleware.callback(currentPayload as any);
      if (result === false) {
        console.log(
          `Middleware ${middleware.modId} cancelled action for hook ${hookName}`
        );
        return false as ModMiddlewareReturnMap[H];
      }
      if (result && typeof result === "object") {
        currentPayload = result as any;
      }
    } catch (error) {
      console.error(
        `Middleware error in mod ${middleware.modId} for hook ${hookName}:`,
        error
      );
      return false as ModMiddlewareReturnMap[H];
    }
  }
  return currentPayload as ModMiddlewareReturnMap[H];
}

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
  return Object.freeze(snapshot);
}

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

export function processFileMetaToUserContent(
  fileMeta: AttachedFileMetadata & { contentBytes?: Uint8Array }
): TextPart | ImagePart | null {
  try {
    const mimeType = fileMeta.type || "application/octet-stream";
    const isText = isLikelyTextFile(fileMeta.name, mimeType);
    const isImage = mimeType.startsWith("image/");

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
        console.warn(
          `AIService: Unsupported VFS file type "${mimeType}" for direct inclusion. Sending note.`
        );
        return {
          type: "text",
          text: `[Attached VFS file: ${fileMeta.name} (${mimeType})]`,
        };
      }
    } else if (fileMeta.contentText !== undefined && isText) {
      return { type: "text", text: fileMeta.contentText };
    } else if (fileMeta.contentBase64 !== undefined && isImage) {
      const buffer = base64ToUint8Array(fileMeta.contentBase64);
      return { type: "image", image: buffer, mimeType: mimeType };
    } else if (fileMeta.contentBase64 !== undefined && !isText && !isImage) {
      console.warn(
        `AIService: Unsupported direct upload type "${mimeType}" for direct inclusion. Sending note.`
      );
      return {
        type: "text",
        text: `[Attached file: ${fileMeta.name} (${mimeType})]`,
      };
    } else {
      if (isText && fileMeta.contentText === undefined) {
        throw new Error(
          `Missing text content for likely text file: ${fileMeta.name}`
        );
      }
      if (isImage && fileMeta.contentBase64 === undefined) {
        throw new Error(
          `Missing base64 content for image file: ${fileMeta.name}`
        );
      }
      throw new Error(`Missing or unusable content for file: ${fileMeta.name}`);
    }
  } catch (error) {
    console.error(
      `AIService: Failed to process content for ${fileMeta.name}:`,
      error
    );
    toast.error(
      `Failed to process file "${fileMeta.name}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return {
      type: "text",
      text: `[Error processing file: ${fileMeta.name}]`,
    };
  }
}

export function buildHistoryMessages(
  historyInteractions: Interaction[]
): CoreMessage[] {
  return historyInteractions.flatMap((i): CoreMessage[] => {
    const msgs: CoreMessage[] = [];
    const userPrompt = i.prompt;
    if (userPrompt) {
      const userMessageContentParts: (TextPart | ImagePart)[] = [];
      if (userPrompt.content) {
        userMessageContentParts.push({
          type: "text",
          text: userPrompt.content,
        });
      }
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
              callStr
            );
          }
        } catch (e) {
          console.error(
            "[AIService] buildHistory: Failed to parse tool call string:",
            callStr,
            e
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
              resultStr
            );
          }
        } catch (e) {
          console.error(
            "[AIService] buildHistory: Failed to parse tool result string:",
            resultStr,
            e
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
