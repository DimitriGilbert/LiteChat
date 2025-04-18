// src/components/lite-chat/message-content-renderer.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { CodeBlock } from "./code-block"; // Import CodeBlock

interface MessageContentRendererProps {
  message: Message;
}

export const MessageContentRenderer: React.FC<MessageContentRendererProps> =
  React.memo(({ message }) => {
    const streamingContent = message.streamedContent ?? "";
    const finalContent = message.content;

    if (message.isStreaming) {
      return (
        <div className="text-gray-200 text-sm whitespace-pre-wrap break-words">
          {streamingContent}
          <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
        </div>
      );
    }

    // Don't render content for system messages unless explicitly needed
    if (message.role === "system" && !finalContent) {
      return null;
    }

    return (
      <div
        className={cn(
          "prose prose-sm prose-invert max-w-none",
          "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
          "prose-headings:mt-4 prose-headings:mb-2",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0",
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code: CodeBlock, // Use the imported CodeBlock
          }}
        >
          {finalContent}
        </ReactMarkdown>
      </div>
    );
  });
MessageContentRenderer.displayName = "MessageContentRenderer";
