// src/components/lite-chat/message/message-content-renderer.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types"; // Import ImagePart
import { CodeBlock } from "@/components/lite-chat/code-block";

interface MessageContentRendererProps {
  message: Message;
}

export const MessageContentRenderer: React.FC<MessageContentRendererProps> =
  React.memo(({ message }) => {
    const streamingContent = message.streamedContent ?? "";
    const finalContent = message.content;

    // --- Streaming Case (Handles only text streaming) ---
    if (message.isStreaming && typeof finalContent === "string") {
      // Only show streaming indicator if the base content is text
      const baseContent = finalContent;
      return (
        <div className="text-gray-200 text-sm whitespace-pre-wrap break-words">
          {baseContent}
          {streamingContent}
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
        </div>
      );
    } else if (message.isStreaming) {
      // Handle streaming placeholder for non-text (e.g., image generation)
      return (
        <div className="text-gray-400 text-sm italic">
          {typeof finalContent === "string" ? finalContent : "Processing..."}
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-gray-400 align-baseline"></span>
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
        )}
      >
        {renderContent()}
      </div>
    );
  });
MessageContentRenderer.displayName = "MessageContentRenderer";
