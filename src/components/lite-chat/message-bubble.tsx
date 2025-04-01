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
      <div className="relative group">
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-gray-800/80 hover:bg-gray-700 text-gray-200"
            onClick={() => {
              navigator.clipboard.writeText(
                String(children).replace(/\n$/, ""),
              );
              toast.success("Code copied to clipboard");
            }}
            aria-label="Copy code"
          >
            <CopyIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          className="rounded-md !mt-3 !mb-3 !bg-gray-800 dark:!bg-gray-900"
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code
        className={cn(
          "font-mono text-sm px-1 py-0.5 rounded-sm bg-gray-100 dark:bg-gray-800",
          className,
        )}
        {...props}
      >
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
      ? (message.streamedContent ?? "") + "▍"
      : message.content;

    return (
      <div
        className={cn(
          "group flex gap-4 px-4 py-5 transition-colors",
          isUser ? "bg-gray-900" : "bg-gray-800",
          className,
        )}
      >
        {/* Avatar/Icon */}
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1",
            isUser
              ? "bg-blue-900/30 text-blue-400"
              : "bg-violet-900/30 text-violet-400",
          )}
        >
          {isUser ? (
            <UserIcon className="w-4 h-4" />
          ) : (
            <BotIcon className="w-4 h-4" />
          )}
        </div>

        <div className="flex-grow min-w-0">
          {/* Role label */}
          <div className="text-xs font-medium text-gray-400 mb-1">
            {isUser ? "You" : "Assistant"}
          </div>

          <div
            className={cn(
              "prose prose-sm prose-invert max-w-none",
              "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
              "prose-headings:mt-4 prose-headings:mb-2",
              "prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm",
              "prose-pre:bg-gray-700 prose-pre:p-0 prose-pre:rounded-md prose-pre:my-2",
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
              }}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </div>

        <div className="flex-shrink-0 self-start pt-1">
          <MessageActions
            messageContent={message.content}
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
