// src/components/lite-chat/message/message-content-renderer.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types"; // Removed unused MessageContent, TextPart, ImagePart
import { CodeBlock } from "@/components/lite-chat/code-block"; // Import CodeBlock

interface MessageContentRendererProps {
  message: Message;
}

export const MessageContentRenderer: React.FC<MessageContentRendererProps> =
  React.memo(({ message }) => {
    const streamingContent = message.streamedContent ?? "";
    const finalContent = message.content; // This can be string | Array<TextPart | ImagePart>

    // --- Streaming Case (Handles only text streaming) ---
    if (message.isStreaming) {
      // Streaming content is always appended text for now
      const baseContent =
        typeof finalContent === "string"
          ? finalContent
          : // If base content is array, find the last text part to append to? Or just show streamed?
            // For simplicity, let's just show the streaming text for now.
            // A more complex approach could try merging with the last text part.
            "";

      return (
        <div className="text-gray-200 text-sm whitespace-pre-wrap break-words">
          {/* Render existing content if it was simple text */}
          {typeof finalContent === "string" && baseContent}
          {/* Render the currently streamed part */}
          {streamingContent}
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
          {/* TODO: Consider how to display images while text streams */}
        </div>
      );
    }

    // --- Non-Streaming Case ---

    // Don't render content for system messages unless explicitly needed
    if (message.role === "system" && !finalContent) {
      return null;
    }

    // --- Render based on content type ---
    const renderContent = () => {
      if (typeof finalContent === "string") {
        // --- String Content: Render with ReactMarkdown ---
        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code: CodeBlock }}
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
                key={index}
                remarkPlugins={[remarkGfm]}
                components={{ code: CodeBlock }}
              >
                {part.text}
              </ReactMarkdown>
            );
          } else if (part.type === "image") {
            // --- Image Part: Render <img> tag ---
            return (
              <img
                key={index}
                src={part.image} // Assumes part.image is a base64 data URL or a direct URL
                alt="Uploaded content" // Consider more descriptive alt text if possible
                className="my-2 max-w-full h-auto rounded border border-gray-600" // Add some styling
              />
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

    return (
      <div
        className={cn(
          // Base styling for the container
          "prose prose-sm prose-invert max-w-none",
          // Apply prose styles only if content is string or contains text parts?
          // Or apply globally and let non-prose elements (img) override? Applying globally for now.
          "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
          "prose-headings:mt-4 prose-headings:mb-2",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0",
          // Add specific styling for rendered images within this container if needed
          "[&_img]:my-3", // Example: add margin to images rendered inside
        )}
      >
        {renderContent()}
      </div>
    );
  });
MessageContentRenderer.displayName = "MessageContentRenderer";
