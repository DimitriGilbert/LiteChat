// src/components/lite-chat/message/message-content-renderer.tsx
import React from "react";
import { Remarkable } from "remarkable";
import hljs from "highlight.js";
import { cn } from "@/lib/utils";
import ReactDOMServer from "react-dom/server"; // Import for server-side rendering

import type {
  Message,
  ImagePart,
  // ToolCallPart, // Removed unused import
  // ToolResultPart, // Removed unused import
  // MessageContent, // Removed unused import
} from "@/lib/types";
import { FileContextBlock } from "./file-context-block";
import { CodeBlock } from "@/components/lite-chat/code-block"; // Import CodeBlock

// Explicitly type the md instance
const md = new Remarkable({
  html: false, // Keep false for security
  breaks: true,
  typographer: false,
  // Highlight function is now only for inline code if Remarkable uses it,
  // or as a fallback. Fenced blocks are handled by the rule override.
  highlight: function (str: string, lang: string): string {
    // This might still be used for inline code depending on Remarkable config,
    // but primary highlighting for blocks is handled by the rule override.
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true })
          .value;
      } catch (__) {
        /* ignore */
      }
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch (__) {
      /* ignore */
    }
    return Remarkable.utils.escapeHtml(str);
  },
});

// --- Override Remarkable's fence rule ---
// Store the original fence rule
// const originalFenceRule = md.renderer.rules.fence;

md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const lang = token.params ? token.params.split(/\s+/g)[0] : "";
  const codeContent = token.content;

  // Render the CodeBlock component to an HTML string
  const codeBlockHtml = ReactDOMServer.renderToString(
    <CodeBlock code={codeContent} language={lang} />,
  );

  // Return the rendered HTML string
  return codeBlockHtml;
};
// --- End Rule Override ---

interface MessageContentRendererProps {
  message: Message;
  enableStreamingMarkdown: boolean;
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

export const MessageContentRenderer: React.FC<MessageContentRendererProps> =
  React.memo(({ message }) => {
    const finalContent = message.content;

    if (message.role === "system" && !finalContent) {
      return null;
    }
    if (!finalContent) {
      return null;
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
      // --- Handle string content ---
      if (typeof finalContent === "string") {
        const { fileBlocks, contentParts } =
          extractFileContextBlocks(finalContent);

        return contentParts.map((part: string | number, index: number) => {
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
            // Render markdown string using Remarkable (which now uses CodeBlock for fences)
            return (
              <div
                key={`text-part-${index}`}
                dangerouslySetInnerHTML={{ __html: md.render(part) }}
              />
            );
          }
        });
      }
      // --- Handle array content ---
      else if (Array.isArray(finalContent)) {
        return finalContent.map((part, index) => {
          // Use type guards
          if (part.type === "text") {
            const { fileBlocks, contentParts } = extractFileContextBlocks(
              part.text,
            );
            return contentParts.map(
              (subPart: string | number, subIndex: number) => {
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
                    <div
                      key={`text-part-${index}-${subIndex}`}
                      dangerouslySetInnerHTML={{ __html: md.render(subPart) }}
                    />
                  );
                }
              },
            );
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
                className="my-2 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg h-auto rounded border border-border"
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
                className={cn(
                  "my-2 p-3 rounded border border-dashed text-xs",
                  part.isError
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                <p className="font-semibold">Tool Result ({part.toolName}):</p>
                <pre className="mt-1 text-foreground/80 overflow-x-auto">
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

    const isPurelyImages =
      Array.isArray(finalContent) &&
      finalContent.length > 0 &&
      finalContent.every((part): part is ImagePart => part.type === "image");

    return (
      <>
        {isPurelyImages ? (
          <div className="grid grid-cols-2 gap-2 not-prose max-w-full overflow-hidden">
            {renderContent()}
          </div>
        ) : (
          // Apply markdown-content for general prose styling
          <div className="max-w-full overflow-x-auto markdown-content">
            {renderContent()}
          </div>
        )}
      </>
    );
  });
MessageContentRenderer.displayName = "MessageContentRenderer";
