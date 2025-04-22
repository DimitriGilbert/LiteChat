// src/components/lite-chat/message/message-content-renderer.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { CodeBlock } from "@/components/lite-chat/code-block";
import { FileContextBlock } from "./file-context-block";

interface MessageContentRendererProps {
  message: Message;
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

// Custom component renderer for paragraphs to handle potential block children
const ParagraphRenderer = ({ children, ...props }: any) => {
  // Check if children contain elements that shouldn't be nested in <p>
  // This is a basic check; more complex checks might be needed for other block elements
  const containsBlockElement = React.Children.toArray(children).some(
    (child: any) =>
      React.isValidElement(child) &&
      (child.type === CodeBlock ||
        child.type === FileContextBlock ||
        child.type === "div"),
  );

  if (containsBlockElement) {
    // Render as a div if it contains block-level elements
    return (
      <div {...props} className="my-3 leading-relaxed text-[15px]">
        {children}
      </div>
    );
  }

  // Render as a p otherwise
  return (
    <p {...props} className="my-3 leading-relaxed text-[15px]">
      {children}
    </p>
  );
};

export const MessageContentRenderer: React.FC<MessageContentRendererProps> =
  React.memo(({ message }) => {
    const streamedContent = message.streamedContent ?? "";
    const finalContent = message.content;

    if (message.isStreaming) {
      return (
        <div className="text-gray-200 text-sm whitespace-pre-wrap break-words">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code: CodeBlock, p: ParagraphRenderer }} // Use custom p renderer
          >
            {streamedContent}
          </ReactMarkdown>
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
        </div>
      );
    }

    if (message.role === "system" && !finalContent) {
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
      if (typeof finalContent === "string") {
        const { fileBlocks, contentParts } =
          extractFileContextBlocks(finalContent);

        if (
          fileBlocks.length === 0 &&
          contentParts.length === 1 &&
          typeof contentParts[0] === "string"
        ) {
          return (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
                p: ParagraphRenderer, // Use custom p renderer
                ul: ({ children, ...props }) => (
                  <ul {...props} className="my-3 list-disc list-inside pl-4">
                    {children}
                  </ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol {...props} className="my-3 list-decimal list-inside pl-4">
                    {children}
                  </ol>
                ),
                li: ({ children, ...props }) => (
                  <li {...props} className="my-1">
                    {children}
                  </li>
                ),
              }}
            >
              {contentParts[0]}
            </ReactMarkdown>
          );
        }

        return contentParts.map((part, index) => {
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
            return (
              <ReactMarkdown
                key={`text-part-${index}`}
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                  p: ParagraphRenderer, // Use custom p renderer
                  ul: ({ children, ...props }) => (
                    <ul {...props} className="my-3 list-disc list-inside pl-4">
                      {children}
                    </ul>
                  ),
                  ol: ({ children, ...props }) => (
                    <ol
                      {...props}
                      className="my-3 list-decimal list-inside pl-4"
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ children, ...props }) => (
                    <li {...props} className="my-1">
                      {children}
                    </li>
                  ),
                }}
              >
                {part}
              </ReactMarkdown>
            );
          }
        });
      } else if (Array.isArray(finalContent)) {
        return finalContent.map((part, index) => {
          if (part.type === "text") {
            const { fileBlocks, contentParts } = extractFileContextBlocks(
              part.text,
            );

            if (
              fileBlocks.length === 0 &&
              contentParts.length === 1 &&
              typeof contentParts[0] === "string"
            ) {
              return (
                <ReactMarkdown
                  key={`text-part-${index}`}
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: CodeBlock,
                    p: ParagraphRenderer, // Use custom p renderer
                    ul: ({ children, ...props }) => (
                      <ul
                        {...props}
                        className="my-3 list-disc list-inside pl-4"
                      >
                        {children}
                      </ul>
                    ),
                    ol: ({ children, ...props }) => (
                      <ol
                        {...props}
                        className="my-3 list-decimal list-inside pl-4"
                      >
                        {children}
                      </ol>
                    ),
                    li: ({ children, ...props }) => (
                      <li {...props} className="my-1">
                        {children}
                      </li>
                    ),
                  }}
                >
                  {contentParts[0]}
                </ReactMarkdown>
              );
            }

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
                    components={{
                      code: CodeBlock,
                      p: ParagraphRenderer, // Use custom p renderer
                      ul: ({ children, ...props }) => (
                        <ul
                          {...props}
                          className="my-3 list-disc list-inside pl-4"
                        >
                          {children}
                        </ul>
                      ),
                      ol: ({ children, ...props }) => (
                        <ol
                          {...props}
                          className="my-3 list-decimal list-inside pl-4"
                        >
                          {children}
                        </ol>
                      ),
                      li: ({ children, ...props }) => (
                        <li {...props} className="my-1">
                          {children}
                        </li>
                      ),
                    }}
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

    const isPurelyImages =
      Array.isArray(finalContent) &&
      finalContent.length > 0 &&
      finalContent.every((part) => part.type === "image");

    return (
      <div
        className={cn(
          "prose prose-sm prose-invert max-w-none",
          "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
          "prose-headings:mt-4 prose-headings:mb-2",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0",
          !isPurelyImages && "[&_img]:my-3",
          isPurelyImages && "grid grid-cols-2 gap-2 not-prose",
          "py-2",
        )}
      >
        {renderContent()}
      </div>
    );
  });
MessageContentRenderer.displayName = "MessageContentRenderer";
