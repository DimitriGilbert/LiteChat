// src/components/lite-chat/message/message-content-renderer.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
// Ensure TextPart and ImagePart are NOT imported if unused
import type { Message } from "@/lib/types";
import { CodeBlock } from "@/components/lite-chat/code-block";

interface MessageContentRendererProps {
  message: Message;
}

export const MessageContentRenderer: React.FC<MessageContentRendererProps> =
  React.memo(({ message }) => {
    const streamedContent = message.streamedContent ?? "";
    const finalContent = message.content;

    // --- Streaming Case (Handles only text streaming) ---
    if (message.isStreaming) {
      // Display accumulated streamed content + cursor
      return (
        <div className="text-gray-200 text-sm whitespace-pre-wrap break-words">
          {/* Render streamed content using Markdown for partial formatting */}
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code: CodeBlock }}
          >
            {streamedContent}
          </ReactMarkdown>
          {/* Blinking cursor */}
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
        </div>
      );
    }

    // --- Non-Streaming Case ---

    // Don't render content for system messages unless explicitly needed
    if (message.role === "system" && !finalContent) {
      return null;
    }

    // --- Render based on final content type ---
    const renderContent = () => {
      if (typeof finalContent === "string") {
        // --- String Content: Render with ReactMarkdown ---
        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: CodeBlock,
              p: ({ node, children, ...props }) => (
                <p {...props} className="my-3 leading-relaxed text-[15px]">
                  {children}
                </p>
              ),
              ul: ({ node, children, ...props }) => (
                <ul {...props} className="my-3 list-disc list-inside pl-4">
                  {children}
                </ul>
              ),
              ol: ({ node, children, ...props }) => (
                <ol {...props} className="my-3 list-decimal list-inside pl-4">
                  {children}
                </ol>
              ),
              li: ({ node, children, ...props }) => (
                <li {...props} className="my-1">
                  {children}
                </li>
              ),
            }}
          >
            {finalContent}
          </ReactMarkdown>
        );
      } else if (Array.isArray(finalContent)) {
        // --- Array Content: Map over parts ---
        return finalContent.map((part, index) => {
          if (part.type === "text") {
            // --- Text Part: Render with ReactMarkdown ---
            return (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                  p: ({ node, children, ...props }) => (
                    <p {...props} className="my-3 leading-relaxed text-[15px]">
                      {children}
                    </p>
                  ),
                  ul: ({ node, children, ...props }) => (
                    <ul {...props} className="my-3 list-disc list-inside pl-4">
                      {children}
                    </ul>
                  ),
                  ol: ({ node, children, ...props }) => (
                    <ol
                      {...props}
                      className="my-3 list-decimal list-inside pl-4"
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ node, children, ...props }) => (
                    <li {...props} className="my-1">
                      {children}
                    </li>
                  ),
                }}
              >
                {part.text}
              </ReactMarkdown>
            );
          } else if (part.type === "image") {
            // --- Image Part: Render <img> tag ---
            // Handles both uploaded (data URL) and generated (base64 data URL) images
            return (
              <img
                key={index}
                // Use part.image directly (should be base64 data URL)
                src={part.image}
                alt={
                  message.role === "assistant"
                    ? "Generated image"
                    : "Uploaded content"
                }
                className="my-2 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg h-auto rounded border border-gray-600" // Adjusted max-width
              />
            );
          } else if (part.type === "tool-call") {
            // --- Tool Call Part: Render placeholder ---
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
            // --- Tool Result Part: Render placeholder ---
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
          // Handle potential unknown part types gracefully
          console.warn("Unknown content part type:", part);
          return <div key={index}>[Unsupported Content Part]</div>;
        });
      }
      // Handle null/undefined content if necessary
      return null;
    };

    // Check if the content is purely image parts (for grid layout)
    const isPurelyImages =
      Array.isArray(finalContent) &&
      finalContent.length > 0 &&
      finalContent.every((part) => part.type === "image");

    return (
      <div
        className={cn(
          // Base styling for the container
          "prose prose-sm prose-invert max-w-none",
          "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
          "prose-headings:mt-4 prose-headings:mb-2",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0",
          // Remove default img margin from prose if using grid
          !isPurelyImages && "[&_img]:my-3",
          // Apply grid layout if content is purely images
          isPurelyImages && "grid grid-cols-2 gap-2 not-prose", // Use grid, disable prose styles for the container
          "py-2",
        )}
      >
        {renderContent()}
      </div>
    );
  });
MessageContentRenderer.displayName = "MessageContentRenderer";
