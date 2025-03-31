import React from "react";
import type { Message } from "@/lib/types";
import { MessageActions } from "./message-actions";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// Choose a style. Example: vscDarkPlus or prism
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { BotIcon, UserIcon } from "lucide-react"; // Example icons

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  className?: string;
}

// Custom Code component for Syntax Highlighting
const CodeBlock: React.FC<any> = React.memo(
  ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <SyntaxHighlighter
        style={vscDarkPlus} // Or your chosen style
        language={match[1]}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    ) : (
      <code className={cn("font-mono text-sm", className)} {...props}>
        {children}
      </code>
    );
  },
);
CodeBlock.displayName = "CodeBlock";

export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(
  ({ message, onRegenerate, className }) => {
    const isUser = message.role === "user";
    const displayContent = message.isStreaming
      ? (message.streamedContent ?? "") + "▍" // Add cursor during streaming
      : message.content;

    return (
      <div
        className={cn(
          "group flex gap-3 p-3 rounded-lg", // Slightly larger gap/padding
          // isUser ? "bg-primary/5" : "bg-muted/50", // Subtle background difference
          className,
        )}
      >
        {/* Avatar/Icon */}
        <div
          className={cn(
            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
            isUser
              ? "bg-primary/20 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isUser ? (
            <UserIcon className="w-4 h-4" />
          ) : (
            <BotIcon className="w-4 h-4" />
          )}
        </div>

        <div className="flex-grow min-w-0">
          {" "}
          {/* Ensure content wraps */}
          {/* Removed role display, icon is enough */}
          {/* <div className="font-semibold text-sm mb-1 capitalize">{message.role}</div> */}
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0", // Tighten prose spacing
              "prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded", // Inline code style
              "prose-pre:bg-muted prose-pre:p-0 prose-pre:rounded-md prose-pre:my-2", // Pre block style reset for highlighter
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock, // Use custom component for code blocks
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex-shrink-0 self-start pt-1">
          <MessageActions
            messageContent={message.content} // Always copy final content
            onRegenerate={
              !isUser && onRegenerate && !message.isStreaming && !message.error
                ? () => onRegenerate(message.id)
                : undefined
            }
          />
        </div>
      </div>
    );
  },
);

MessageBubble.displayName = "MessageBubble";

// Keep the custom comparison function for React.memo
const messagesAreEqual = (
  prevProps: MessageBubbleProps,
  nextProps: MessageBubbleProps,
): boolean => {
  // If error state changes, rerender
  if (prevProps.message.error !== nextProps.message.error) return false;

  // If it's not streaming, compare normally (id, content, role, error)
  if (!nextProps.message.isStreaming && !prevProps.message.isStreaming) {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.message.role === nextProps.message.role &&
      prevProps.message.error === nextProps.message.error // Include error check
    );
  }

  // If streaming state changes, rerender
  if (prevProps.message.isStreaming !== nextProps.message.isStreaming) {
    return false;
  }

  // If it *is* streaming, only compare streamedContent, ID and error
  if (nextProps.message.isStreaming) {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.streamedContent === nextProps.message.streamedContent &&
      prevProps.message.error === nextProps.message.error // Include error check
    );
  }

  // Fallback (shouldn't be reached often)
  return false; // Rerender if unsure
};

export const MemoizedMessageBubble = React.memo(
  MessageBubble,
  messagesAreEqual,
);
