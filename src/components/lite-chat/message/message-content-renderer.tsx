// src/components/lite-chat/message/message-content-renderer.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message, ImagePart } from "@/lib/types"; // Added TextPart, ImagePart
import { FileContextBlock } from "./file-context-block";
// Import shared utils
import { markdownComponents } from "./message-content-utils";

interface MessageContentRendererProps {
  message: Message;
  enableStreamingMarkdown: boolean;
  // REMOVED: portalTargetId?: string;
}

const decodeXml = (encoded: string): string => {
  if (typeof document === "undefined" || !encoded?.includes("&")) {
    return encoded;
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = encoded;
    return textarea.value;
  } catch (e) {
    console.error("Failed to decode XML:", e);
    return encoded;
  }
};

// REMOVED: Portal logic (useEffect, useState for portalNode)
// REMOVED: StreamingContent component

export const MessageContentRenderer: React.FC<MessageContentRendererProps> =
  React.memo(({ message, enableStreamingMarkdown }) => {
    // Use streamedContent if streaming, otherwise final content
    const contentToRender = message.isStreaming
      ? (message.streamedContent ?? "")
      : message.content;
    const finalContent = message.content; // Keep reference to final content for type checks

    // --- Render Logic (Handles both streaming and final) ---

    // Handle empty content cases
    if (message.role === "system" && !contentToRender) {
      return null;
    }
    // Render placeholder or nothing if streaming but no content yet
    if (message.isStreaming && !contentToRender) {
      // Render only the pulse indicator if streaming hasn't produced text yet
      return (
        <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
      );
    }

    const extractFileContextBlocks = (content: string) => {
      const fileRegex = /<file_context\s+([^>]*?)>([\s\S]*?)<\/file_context>/g;
      const fileBlocks: Array<{
        fullMatch: string;
        attributes: Record<string, string>;
        content: string | null;
      }> = [];
      let lastIndex = 0;
      const contentParts: Array<string | number> = [];
      let match;
      while ((match = fileRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          contentParts.push(content.substring(lastIndex, match.index));
        }
        const attributeString = match[1];
        const rawBlockContent = match[2];
        const attributes: Record<string, string> = {};
        const attrRegex = /(\S+)=["']([^"']*)["']/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attributeString)) !== null) {
          attributes[attrMatch[1]] = decodeXml(attrMatch[2]);
        }
        const hasError = attributes.error !== undefined;
        const hasStatus = attributes.status !== undefined;
        let processedContent: string | null = null;
        if (!hasError && !hasStatus) {
          const trimmedContent = rawBlockContent ? rawBlockContent.trim() : "";
          if (trimmedContent) {
            processedContent = decodeXml(trimmedContent);
          } else {
            processedContent = "";
          }
        }
        fileBlocks.push({
          fullMatch: match[0],
          attributes: attributes,
          content: processedContent,
        });
        contentParts.push(fileBlocks.length - 1);
        lastIndex = fileRegex.lastIndex;
      }
      if (lastIndex < content.length) {
        contentParts.push(content.substring(lastIndex));
      }
      const finalContentParts = contentParts.filter(
        (part) => typeof part === "number" || part.trim() !== "",
      );
      return { fileBlocks, contentParts: finalContentParts };
    };

    const renderContent = () => {
      // Handle string content (potentially streaming or final)
      if (typeof contentToRender === "string") {
        const { fileBlocks, contentParts } =
          extractFileContextBlocks(contentToRender);

        const elements = contentParts.map((part, index) => {
          if (typeof part === "number") {
            const block = fileBlocks[part];
            if (!block) return null;
            return (
              <FileContextBlock
                key={`file-block-${index}`}
                type={block.attributes.type as "vfs" | "attached"}
                pathOrName={
                  block.attributes.path || block.attributes.name || ""
                }
                content={block.content}
                extension={block.attributes.extension || ""}
                error={block.attributes.error}
                status={block.attributes.status}
              />
            );
          } else {
            // Render markdown only if enabled OR if it's the final render
            const shouldRenderMarkdown =
              enableStreamingMarkdown || !message.isStreaming;
            return shouldRenderMarkdown ? (
              <ReactMarkdown
                key={`text-part-${index}`}
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {part}
              </ReactMarkdown>
            ) : (
              <pre key={`text-part-${index}`} className="font-sans text-sm">
                <code>{part}</code>
              </pre>
            );
          }
        });

        // Add pulse indicator if streaming
        if (message.isStreaming) {
          elements.push(
            <span
              key="pulse"
              className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"
            ></span>,
          );
        }
        return elements;
      }
      // Handle array content (final render only, streaming uses streamedContent string)
      else if (Array.isArray(contentToRender)) {
        return contentToRender.map((part, index) => {
          if (part.type === "text") {
            // Always render final text parts as markdown
            const { fileBlocks, contentParts } = extractFileContextBlocks(
              part.text,
            );
            return contentParts.map((subPart, subIndex) => {
              if (typeof subPart === "number") {
                const block = fileBlocks[subPart];
                if (!block) return null;
                return (
                  <FileContextBlock
                    key={`file-block-${index}-${subIndex}`}
                    type={block.attributes.type as "vfs" | "attached"}
                    pathOrName={
                      block.attributes.path || block.attributes.name || ""
                    }
                    content={block.content}
                    extension={block.attributes.extension || ""}
                    error={block.attributes.error}
                    status={block.attributes.status}
                  />
                );
              } else {
                return (
                  <ReactMarkdown
                    key={`text-part-${index}-${subIndex}`}
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {subPart}
                  </ReactMarkdown>
                );
              }
            });
          } else if (part.type === "image") {
            return (
              <img
                key={index}
                src={part.image}
                alt={
                  message.role === "assistant"
                    ? "Generated image"
                    : "Uploaded content"
                }
                className="my-2 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg h-auto rounded border border-gray-600"
              />
            );
          } else if (part.type === "tool-call") {
            return (
              <div
                key={index}
                className="my-2 p-3 rounded border border-dashed border-blue-700 bg-blue-900/20 text-xs text-blue-300"
              >
                <p className="font-semibold">
                  Tool Call: <code>{part.toolName}</code>
                </p>
                <pre className="mt-1 text-blue-200/80 overflow-x-auto">
                  {JSON.stringify(part.args, null, 2)}
                </pre>
              </div>
            );
          } else if (part.type === "tool-result") {
            return (
              <div
                key={index}
                className={`my-2 p-3 rounded border border-dashed ${part.isError ? "border-red-700 bg-red-900/20 text-red-300" : "border-gray-700 bg-gray-800/30 text-gray-400"} text-xs`}
              >
                <p className="font-semibold">Tool Result ({part.toolName}):</p>
                <pre className="mt-1 text-gray-300 overflow-x-auto">
                  {typeof part.result === "string"
                    ? part.result
                    : JSON.stringify(part.result, null, 2)}
                </pre>
              </div>
            );
          }
          console.warn("Unknown content part type:", part);
          return <div key={index}>[Unsupported Content Part]</div>;
        });
      }
      return null;
    };

    // Use finalContent (the original message.content) for the type check
    const isPurelyImages =
      Array.isArray(finalContent) &&
      finalContent.length > 0 &&
      // Correctly check if every part is an ImagePart
      finalContent.every((part): part is ImagePart => part.type === "image");

    return (
      <div
        className={cn(
          // Apply prose styles only if markdown is enabled OR it's the final render
          (enableStreamingMarkdown || !message.isStreaming) &&
            "prose prose-sm prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-headings:mt-4 prose-headings:mb-2 prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0",
          // Base text styles apply always
          "text-gray-200 text-sm whitespace-pre-wrap break-words",
          !isPurelyImages && "[&_img]:my-3",
          isPurelyImages && "grid grid-cols-2 gap-2 not-prose", // Keep grid for final image rendering
          "py-2", // Keep padding consistent
        )}
      >
        {renderContent()}
      </div>
    );
  });
MessageContentRenderer.displayName = "MessageContentRenderer";
