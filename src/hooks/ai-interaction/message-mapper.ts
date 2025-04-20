// src/hooks/ai-interaction/message-mapper.ts
import {
  CoreMessage,
  TextPart,
  ImagePart,
  ToolCallPart,
  ToolResultPart,
} from "ai";
// Import the MessageContent type from our types.ts
import { Message } from "@/lib/types";

type LocalToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

/**
 * Maps local message format to AI SDK CoreMessage format
 */
export function mapToCoreMessages(localMessages: Message[]): CoreMessage[] {
  return localMessages
    .filter((m) => m.role !== "system") // Keep system messages out of CoreMessage array
    .map((m): CoreMessage | null => {
      try {
        if (m.role === "user") {
          let coreContent: CoreMessage["content"];
          if (typeof m.content === "string") {
            coreContent = m.content;
          } else if (Array.isArray(m.content)) {
            // Map local parts to SDK parts
            coreContent = m.content
              .map((part): TextPart | ImagePart | null => {
                // Use type guards to determine the correct SDK type
                if (part.type === "text") {
                  return part as TextPart; // Direct cast if structure matches
                }
                if (part.type === "image") {
                  // Ensure 'image' property exists before proceeding
                  if (typeof part.image !== "string") return null;
                  const base64Data = part.image.startsWith("data:")
                    ? part.image.split(",")[1]
                    : part.image;
                  if (!base64Data) return null;
                  // Construct the SDK ImagePart
                  return {
                    type: "image",
                    image: Buffer.from(base64Data, "base64"),
                    mimeType: part.mediaType, // Use mediaType if available
                  };
                }
                // Ignore other part types for user messages
                return null;
              })
              .filter(
                (p: TextPart | ImagePart | null): p is TextPart | ImagePart =>
                  p !== null,
              );
          } else {
            coreContent = ""; // Default to empty string if content is unexpected
          }
          // Ensure content is not an empty array, default to empty string
          if (Array.isArray(coreContent) && coreContent.length === 0) {
            coreContent = "";
          }
          return { role: "user", content: coreContent };
        } else if (m.role === "assistant") {
          const contentParts: Array<TextPart | ToolCallPart> = [];
          if (typeof m.content === "string") {
            contentParts.push({ type: "text", text: m.content });
          } else if (Array.isArray(m.content)) {
            // Map local parts to SDK parts
            m.content.forEach((part) => {
              if (part.type === "text") {
                contentParts.push(part as TextPart);
              } else if (part.type === "tool-call") {
                // Construct SDK ToolCallPart
                contentParts.push({
                  type: "tool-call",
                  toolCallId: part.toolCallId ?? "", // Provide default if missing
                  toolName: part.toolName ?? "", // Provide default if missing
                  args: part.args ?? {}, // Provide default if missing
                });
              }
            });
          }
          // Also map from the separate tool_calls property if necessary
          if (
            m.tool_calls &&
            !contentParts.some((p) => p.type === "tool-call")
          ) {
            m.tool_calls.forEach((tc: LocalToolCall) => {
              try {
                contentParts.push({
                  type: "tool-call",
                  toolCallId: tc.id,
                  toolName: tc.function.name,
                  args: JSON.parse(tc.function.arguments || "{}"),
                });
              } catch (e) {
                console.error(
                  "Failed to parse tool call arguments from local message:",
                  tc.function.arguments,
                  e,
                );
              }
            });
          }
          // Ensure there's at least a text part if content is empty
          if (contentParts.length === 0) {
            contentParts.push({ type: "text", text: "" });
          }
          return { role: "assistant", content: contentParts };
        } else if (m.role === "tool") {
          const toolResultParts: ToolResultPart[] = [];
          if (Array.isArray(m.content)) {
            // Map local parts to SDK parts
            m.content.forEach((part) => {
              if (part.type === "tool-result" && m.tool_call_id) {
                // Construct SDK ToolResultPart
                toolResultParts.push({
                  type: "tool-result",
                  toolCallId: m.tool_call_id,
                  toolName: part.toolName ?? "", // Provide default
                  result: part.result ?? null, // Provide default
                  isError: part.isError ?? false, // Provide default
                });
              }
            });
          } else if (m.tool_call_id) {
            console.warn(
              "Mapping tool message with non-array content, structure assumed:",
              m,
            );
            // Attempt to create a result part if possible, otherwise skip
          }

          if (toolResultParts.length === 0) return null; // Skip if no valid results
          return { role: "tool", content: toolResultParts };
        }
        return null; // Ignore other roles like 'system'
      } catch (error) {
        console.error("Error mapping local message to CoreMessage:", m, error);
        return null;
      }
    })
    .filter((m): m is CoreMessage => m !== null); // Filter out any null results
}

/**
 * Local ResponseMessage definition (Use ONLY if TS2459 persists)
 * This mirrors the SDK structure but is defined locally.
 */
export type LocalResponseMessage = (
  | CoreMessage
  | { role: "tool"; content: ToolResultPart[] }
) & {
  id: string;
};
