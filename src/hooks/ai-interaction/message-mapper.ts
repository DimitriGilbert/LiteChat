// src/hooks/ai-interaction/message-mapper.ts
import {
  CoreMessage,
  TextPart,
  ImagePart,
  ToolCallPart,
  ToolResultPart,
} from "ai";

import { Message } from "@/lib/types";

// Local type definition for tool calls within DbMessage/Message
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
                  return part as TextPart; // Assuming local TextPart matches SDK TextPart
                }
                if (part.type === "image") {
                  // Ensure 'image' property exists and is a string before proceeding
                  if (typeof part.image !== "string") return null;
                  // Handle both data URLs and raw base64 strings
                  const base64Data = part.image.startsWith("data:")
                    ? part.image.split(",")[1]
                    : part.image;
                  if (!base64Data) return null; // Skip if base64 data is missing
                  return {
                    type: "image",
                    image: Buffer.from(base64Data, "base64"),
                    mimeType: part.mediaType,
                  };
                }
                // Ignore other part types (like tool-call/tool-result) for user messages
                return null;
              })
              .filter(
                (p: TextPart | ImagePart | null): p is TextPart | ImagePart =>
                  p !== null,
              );
          } else {
            // Handle cases where content might be null/undefined unexpectedly
            console.warn("User message content is not string or array:", m);
            coreContent = "";
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
                contentParts.push(part as TextPart); // Assuming local TextPart matches SDK TextPart
              } else if (part.type === "tool-call") {
                // Construct SDK ToolCallPart
                contentParts.push({
                  type: "tool-call",
                  toolCallId: part.toolCallId ?? "", // Ensure non-null string
                  toolName: part.toolName ?? "", // Ensure non-null string
                  args: part.args ?? {}, // Ensure non-null object
                });
              }
              // Ignore ImagePart and ToolResultPart for assistant messages in CoreMessage
            });
          }
          // Also map from the separate tool_calls property if necessary and not already mapped
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
                  args: JSON.parse(tc.function.arguments || "{}"), // Safely parse arguments
                });
              } catch (e) {
                console.error(
                  "Failed to parse tool call arguments from local message:",
                  tc.function.arguments,
                  e,
                );
                // Optionally add a placeholder or skip the tool call
              }
            });
          }
          // Ensure there's at least a text part if content is empty (some models require this)
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
                  toolCallId: m.tool_call_id, // Use tool_call_id from the parent message
                  toolName: part.toolName ?? "", // Ensure non-null string
                  result: part.result ?? null, // Allow null result
                  isError: part.isError ?? false, // Default isError to false
                });
              }
              // Ignore other part types for tool messages
            });
          } else if (m.tool_call_id) {
            // Handle case where content might not be an array but tool_call_id exists
            // This might indicate an older format or an error state.
            // We might try to infer the result or log a warning.
            console.warn(
              "Mapping tool message with non-array content, structure assumed:",
              m,
            );
            // Example: Try to use content directly if it's primitive, otherwise stringify
            // const resultValue = (typeof m.content === 'string' || typeof m.content === 'number' || typeof m.content === 'boolean') ? m.content : JSON.stringify(m.content);
            // toolResultParts.push({
            //   type: 'tool-result',
            //   toolCallId: m.tool_call_id,
            //   toolName: 'unknown', // Cannot infer toolName reliably
            //   result: resultValue,
            //   isError: false, // Assume not an error unless indicated elsewhere
            // });
          }

          // Only return a tool message if we successfully created ToolResultParts
          if (toolResultParts.length === 0) return null;
          return { role: "tool", content: toolResultParts };
        }
        // Ignore other roles like 'system'
        return null;
      } catch (error) {
        console.error("Error mapping local message to CoreMessage:", m, error);
        return null; // Skip message on error
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
