// src/components/lite-chat/message-bubble.tsx
import React from "react";
import type { Message } from "@/lib/types";
import { MessageActions } from "./message-actions";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { BotIcon, UserIcon, CopyIcon, FileTextIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  className?: string;
}

// Custom Code component for Syntax Highlighting
const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = React.memo(({ inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || "");
  return !inline && match ? (
    <div className="relative group/codeblock">
      <div className="absolute right-2 top-2 opacity-0 group-hover/codeblock:opacity-100 transition-opacity">
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
        "font-mono text-sm px-1 py-0.5 rounded-sm bg-gray-700",
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
  const streamingContent = message.streamedContent ?? "";
  const finalContent = message.content;
  const vfsPaths = message.vfsContextPaths;

  return (
    <div
      className={cn(
        "group/message flex gap-4 px-4 py-5 transition-colors relative", // Added group/message
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

      {/* Message Content Area */}
      <div className="flex-grow min-w-0 pr-12">
        {/* Role label */}
        <div className="text-xs font-medium text-gray-400 mb-1">
          {isUser ? "You" : "Assistant"}
        </div>

        {/* Content */}
        {message.isStreaming ? (
          <div className="text-gray-200 text-sm whitespace-pre-wrap break-words">
            {streamingContent}
            <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
          </div>
        ) : (
          <div
            className={cn(
              "prose prose-sm prose-invert max-w-none",
              "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
              "prose-headings:mt-4 prose-headings:mb-2",
              "prose-code:before:content-none prose-code:after:content-none prose-code:bg-gray-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm",
              "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-2",
            )}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
              }}
            >
              {finalContent}
            </ReactMarkdown>
          </div>
        )}

        {/* VFS Context Paths */}
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
        {!isUser && (
          <div className="mt-2 opacity-0 group-hover/message:opacity-100 transition-opacity text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
            {message.providerId && message.modelId && (
              <span>
                <strong>{message.providerId}</strong>:
                <span className="ml-1">{message.modelId}</span>
              </span>
            )}
            {(message.tokensInput !== undefined ||
              message.tokensOutput !== undefined) && (
              <span>
                tokens:
                {message.tokensInput !== undefined && (
                  <>
                    in <strong>{message.tokensInput}</strong>
                  </>
                )}
                {message.tokensOutput !== undefined && (
                  <>
                    , out <strong>{message.tokensOutput}</strong>
                  </>
                )}
              </span>
            )}
            {message.tokensPerSecond !== undefined && (
              <span>
                speed: <strong>{message.tokensPerSecond.toFixed(1)}</strong>{" "}
                tok/s
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {message.error && (
          <p className="text-xs text-red-400 mt-1">Error: {message.error}</p>
        )}
      </div>

      {/* Actions Area */}
      <div className="absolute right-4 h-full top-0">
        <div className="sticky top-5">
          {" "}
          {/* This makes it stick within its container */}
          <MessageActions
            message={message}
            onRegenerate={
              !isUser && onRegenerate && !message.isStreaming && !message.error
                ? () => onRegenerate(message.id)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};

// Custom comparison function for React.memo
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
