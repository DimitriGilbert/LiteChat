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
  ModelMessage,
  ImagePart,
  TextPart,
} from "ai";
import { convertToModelMessages } from "ai";
import { usePromptInputValueStore } from "@/store/prompt-input-value.store";
import { nanoid } from "nanoid";
import { useInputStore } from "@/store/input.store";
import { usePromptStateStore } from "@/store/prompt.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { promptEvent } from "@/types/litechat/events/prompt.events";
import type { PromptTurnObject } from "@/types/litechat/prompt";


export function formatTokenCost(cost: number): string {
  if (typeof cost !== 'number' || isNaN(cost)) return '—';
  if (cost === 0) return '0¢';
  if (cost < 0) return `-${formatTokenCost(-cost)}`;
  if (cost >= 1) {
    return `$${cost.toFixed(2)}`;
  } else {
    const cents = cost * 100;
    let fx = 2;
    if (cents < 0.001) {
      fx *= 3;
    } else if (cents < 0.01) {
      fx *= 2;
    }
    return `${cents.toFixed(fx)}¢`;
  }
}

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
  const promptInputValue = usePromptInputValueStore.getState().value;
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
    gitUserName: sS.gitUserName,
    gitUserEmail: sS.gitUserEmail,
    promptInputValue,
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

/**
 * Filters out file content from text for display purposes
 * File content is wrapped in <!--FILE_CONTENT_START:filename--> ... <!--FILE_CONTENT_END:filename--> markers
 * This content is still sent to AI but hidden from user display
 */
export function filterFileContentFromDisplay(text: string): string {
  // Remove file content blocks using regex
  const fileContentRegex = /<!--FILE_CONTENT_START:[^>]*-->\n?.*?\n?<!--FILE_CONTENT_END:[^>]*-->/gs;
  return text.replace(fileContentRegex, '').trim();
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
        const textContent = textDecoder.decode(fileMeta.contentBytes);
        
        // Wrap ALL text file content (both VFS and uploaded) in hidden markers for display filtering
        return {
          type: "text",
          text: `<!--FILE_CONTENT_START:${fileMeta.name}-->\n${textContent}\n<!--FILE_CONTENT_END:${fileMeta.name}-->`,
        };
      } else if (isImage) {
        return {
          type: "image",
          image: fileMeta.contentBytes,
          mediaType: mimeType,
        };
      } else {
        console.warn(
          `AIService: Unsupported file type "${mimeType}" for direct inclusion. Sending note.`
        );
        return {
          type: "text",
          text: `[Attached file: ${fileMeta.name} (${mimeType})]`,
        };
      }
    } else if (fileMeta.contentText !== undefined && isText) {
      // Wrap ALL text file content (both VFS and uploaded) in hidden markers for display filtering
      return { 
        type: "text", 
        text: `<!--FILE_CONTENT_START:${fileMeta.name}-->\n${fileMeta.contentText}\n<!--FILE_CONTENT_END:${fileMeta.name}-->` 
      };
    } else if (fileMeta.contentBase64 !== undefined && isImage) {
      const buffer = base64ToUint8Array(fileMeta.contentBase64);
      return { type: "image", image: buffer, mediaType: mimeType };
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
): ModelMessage[] {
  // Filter and process interactions using the same logic as PromptCompilationService
  const filteredInteractions = historyInteractions
    .filter((i) => {
      // Only include main conversation interactions
      return (
        i.parentId === null &&
        i.status === "COMPLETED" &&
        (i.type === "message.user_assistant" || i.type === "message.assistant_regen")
      );
    })
    .map((activeInteraction) => {
      // Handle regeneration interactions
      if (
        activeInteraction.type === "message.assistant_regen" &&
        activeInteraction.metadata?.regeneratedFromId
      ) {
        const originalInteraction = historyInteractions.find(
          (orig) => orig.id === activeInteraction.metadata!.regeneratedFromId
        );
        if (
          originalInteraction &&
          originalInteraction.prompt &&
          originalInteraction.type === "message.user_assistant"
        ) {
          return {
            ...activeInteraction,
            prompt: originalInteraction.prompt,
            type: "message.user_assistant",
          } as Interaction;
        }
      }
      
      // Only include interactions with prompts
      if (
        activeInteraction.type === "message.user_assistant" &&
        activeInteraction.prompt
      ) {
        return activeInteraction;
      }
      
      return null;
    })
    .filter(Boolean) as Interaction[];

  // Convert filtered interactions to UIMessage format
  const uiMessages: any[] = filteredInteractions.flatMap((i) => {
    const msgs: any[] = [];
    
    // Add user message
    if (i.prompt) {
      const userMessage: any = {
        id: i.id + "-user",
        role: "user",
        content: i.prompt.content || "",
      };
      
      if (i.prompt.metadata?.attachedFiles && i.prompt.metadata.attachedFiles.length > 0) {
        userMessage.attachments = i.prompt.metadata.attachedFiles.map(f => ({
          name: f.name,
          contentType: f.type,
          url: f.contentBase64 ? `data:${f.type};base64,${f.contentBase64}` : undefined
        }));
      }
      
      msgs.push(userMessage);
    }

    // Add assistant message
    if (i.response || (i.metadata?.toolCalls && i.metadata.toolCalls.length > 0)) {
      const assistantMessage: any = {
        id: i.id + "-assistant",
        role: "assistant",
        content: i.response || "",
      };
      
      // Add tool invocations if present
      if (i.metadata?.toolCalls && i.metadata.toolCalls.length > 0) {
        assistantMessage.toolInvocations = i.metadata.toolCalls.map((callStr, idx) => {
          try {
            const parsedCall = JSON.parse(callStr);
            const toolInvocation: any = {
              toolCallId: parsedCall.toolCallId,
              toolName: parsedCall.toolName,
              args: parsedCall.input,
              state: "result"
            };
            
            // Find matching result
            if (i.metadata?.toolResults && i.metadata.toolResults[idx]) {
              try {
                const parsedResult = JSON.parse(i.metadata.toolResults[idx]);
                toolInvocation.result = parsedResult.output;
              } catch (e) {
                console.error("Failed to parse tool result:", e);
              }
            }
            
            return toolInvocation;
          } catch (e) {
            console.error("Failed to parse tool call:", e);
            return null;
          }
        }).filter(Boolean);
      }
      
      msgs.push(assistantMessage);
    }
    
    return msgs;
  });

  // Convert UIMessages to ModelMessages using the official function
  return convertToModelMessages(uiMessages);
}

export async function buildCurrentPromptTurnData(overrideContent?: string): Promise<PromptTurnObject> {
  const registeredPromptControls = useControlRegistryStore.getState().promptControls;
  const promptControls = Object.values(registeredPromptControls);
  const currentAttachedFiles = useInputStore.getState().attachedFilesMetadata;
  const currentModelIdFromPromptStore = usePromptStateStore.getState().modelId;
  const valueFromRef = overrideContent ?? "";
  const trimmedValue = valueFromRef.trim();

  let parameters: Record<string, any> = {};
  let metadata: Record<string, any> = {};

  for (const control of promptControls) {
    if (control.getParameters) {
      const params = await control.getParameters();
      if (params) parameters = { ...parameters, ...params };
    }
    if (control.getMetadata) {
      const meta = await control.getMetadata();
      if (meta) metadata = { ...metadata, ...meta };
    }
  }

  if (currentAttachedFiles.length > 0) {
    metadata.attachedFiles = [...currentAttachedFiles];
  }

  if (!metadata.modelId && currentModelIdFromPromptStore) {
    metadata.modelId = currentModelIdFromPromptStore;
  }

  let turnData: PromptTurnObject = {
    id: nanoid(),
    content: trimmedValue,
    parameters,
    metadata,
  };

  emitter.emit(promptEvent.submitted, { turnData });

  return turnData;
}
