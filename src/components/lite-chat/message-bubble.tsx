// src/components/lite-chat/message-bubble.tsx
import React from "react";
import type { Message } from "@/lib/types";
import { MessageActions } from "./message-actions";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { BotIcon, UserIcon, CopyIcon, FileTextIcon } from "lucide-react"; // Added FileTextIcon
import { Button } from "@/components/ui/button"; // Import Button
import { toast } from "sonner"; // Import toast

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  className?: string;
}

// Custom Code component for Syntax Highlighting (Keep as is)
const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = React.memo(({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || "");
  return !inline && match ? (
    <div className="relative group/codeblock">
      {" "}
      {/* Added group/codeblock */}
      <div className="absolute right-2 top-2 opacity-0 group-hover/codeblock:opacity-100 transition-opacity">
        {" "}
        {/* Use group-hover/codeblock */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-gray-800/80 hover:bg-gray-700 text-gray-200"
          onClick={() => {
            navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
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
        "font-mono text-sm px-1 py-0.5 rounded-sm bg-gray-700", // Adjusted inline code style
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
});
CodeBlock.displayName = "CodeBlock";

// Main Message Bubble Component
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRegenerate,
  className,
}) => {
  const isUser = message.role === "user";
  // Content for streaming state (plain text)
  const streamingContent = message.streamedContent ?? "";
  // Final content (potentially markdown)
  const finalContent = message.content;
  // VFS context paths for user messages
  const vfsPaths = message.vfsContextPaths;

  return (
    <div
      // Add group class here for MessageActions hover effect
      className={cn(
        "group/message flex gap-4 px-4 py-5 transition-colors",
        isUser ? "bg-gray-900" : "bg-gray-800", // Keep distinct backgrounds
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

      {/* Message Content Area */}
      <div className="flex-grow min-w-0">
        {/* Role label */}
        <div className="text-xs font-medium text-gray-400 mb-1">
          {isUser ? "You" : "Assistant"}
        </div>

        {/* Conditional Rendering: Plain text during stream, Markdown after */}
        {message.isStreaming ? (
          // Render plain text during streaming, preserving whitespace/newlines
          <div className="text-gray-200 text-sm whitespace-pre-wrap break-words">
            {streamingContent}
            <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>{" "}
            {/* Streaming indicator */}
          </div>
        ) : (
          // Render final content with Markdown processing
          <div
            className={cn(
              "prose prose-sm prose-invert max-w-none",
              // Add styling for prose elements if needed
              "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
              "prose-headings:mt-4 prose-headings:mb-2",
              "prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm",
              "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-2", // Make pre background transparent so CodeBlock controls it
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock, // Use custom CodeBlock for highlighting
              }}
            >
              {finalContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Display VFS Context Paths for User Messages */}
        {isUser && vfsPaths && vfsPaths.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700/50 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-xs text-gray-500 font-medium w-full mb-0.5">
              Included context:
            </span>
            {vfsPaths.map((path) => (
              <div
                key={path}
                className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded"
                title={path}
              >
                <FileTextIcon className="h-3 w-3 flex-shrink-0" />
                <span className="font-mono truncate max-w-[200px]">
                  {path.startsWith("/") ? path.substring(1) : path}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Display error if present */}
        {message.error && (
          <p className="text-xs text-red-400 mt-1">Error: {message.error}</p>
        )}
      </div>

      {/* Actions Area */}
      <div className="flex-shrink-0 self-start pt-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
        {" "}
        {/* Use group-hover/message */}
        <MessageActions
          messageContent={message.content} // Pass final content for copy
          onRegenerate={
            !isUser && onRegenerate && !message.isStreaming && !message.error
              ? () => onRegenerate(message.id)
              : undefined
          }
        />
      </div>
    </div>
  );
};

// Keep the custom comparison function for React.memo
const messagesAreEqual = (
  prevProps: MessageBubbleProps,
  nextProps: MessageBubbleProps,
): boolean => {
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  // Basic checks for changes that always warrant a rerender
  if (
    prevMsg.id !== nextMsg.id ||
    prevMsg.role !== nextMsg.role ||
    prevMsg.error !== nextMsg.error ||
    prevMsg.isStreaming !== nextMsg.isStreaming || // Crucial: rerender when streaming starts/stops
    // Check if vfsContextPaths array has changed (simple reference check first)
    prevMsg.vfsContextPaths !== nextMsg.vfsContextPaths ||
    // Deeper check if references are different but content might be the same
    (prevMsg.vfsContextPaths &&
      nextMsg.vfsContextPaths &&
      (prevMsg.vfsContextPaths.length !== nextMsg.vfsContextPaths.length ||
        !prevMsg.vfsContextPaths.every(
          (val, index) => val === nextMsg.vfsContextPaths?.[index],
        )))
  ) {
    return false;
  }

  // If streaming, compare streamedContent
  if (nextMsg.isStreaming) {
    return prevMsg.streamedContent === nextMsg.streamedContent;
  }

  // If not streaming, compare final content
  return prevMsg.content === nextMsg.content;
};

export const MemoizedMessageBubble = React.memo(
  MessageBubble,
  messagesAreEqual,
);
