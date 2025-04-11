// src/components/lite-chat/message-bubble.tsx
import React, { useState } from "react";
import type { Message } from "@/lib/types";
import { MessageActions } from "./message-actions";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  BotIcon,
  UserIcon,
  CopyIcon,
  FileTextIcon,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageBubbleProps {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  className?: string;
}

// --- Enhanced CodeBlock Component ---
const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}> = React.memo(({ inline, className, children, ...props }) => {
  const [isFolded, setIsFolded] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text"; // Default to 'text' if no language detected
  const codeContent = String(children).replace(/\n$/, ""); // Remove trailing newline

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    toast.success("Code copied to clipboard");
  };

  if (inline) {
    return (
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
  }

  return (
    <div className="relative group/codeblock my-3 rounded-md border border-gray-700/50 bg-gray-800 dark:bg-gray-900">
      {/* Codeblock Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-700/30 dark:bg-gray-800/40 border-b border-gray-700/50">
        <span className="text-xs font-semibold text-gray-400 select-none">
          {language}
        </span>
        <div className="flex items-center gap-1">
          {/* Fold/Unfold Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                  onClick={() => setIsFolded(!isFolded)}
                  aria-label={isFolded ? "Expand code" : "Collapse code"}
                >
                  {isFolded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isFolded ? "Expand code" : "Collapse code"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* Copy Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                  onClick={handleCopy}
                  aria-label="Copy code"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Copy code</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Code Content (Conditionally Rendered) */}
      {!isFolded && (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          className="!py-3 !px-0 !m-0 !bg-transparent" // Adjusted styling
          codeTagProps={{
            style: {
              // Ensure code tag itself doesn't have conflicting background/padding
              fontFamily: "var(--font-mono)", // Example: Use Tailwind's mono font variable
              fontSize: "0.875rem", // text-sm
              lineHeight: "1.25rem", // leading-5
              display: "block",
              paddingLeft: "1rem", // px-4 equivalent for line numbers
              paddingRight: "1rem",
            },
          }}
          showLineNumbers // Optionally show line numbers
          lineNumberStyle={{
            minWidth: "2.25em",
            paddingRight: "1em",
            textAlign: "right",
            color: "#858585",
            userSelect: "none",
          }}
          {...props}
        >
          {codeContent}
        </SyntaxHighlighter>
      )}
    </div>
  );
});
CodeBlock.displayName = "CodeBlock";

// --- Main Message Bubble Component ---
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRegenerate,
  className,
}) => {
  const [isMessageFolded, setIsMessageFolded] = useState(false);
  const isUser = message.role === "user";
  const streamingContent = message.streamedContent ?? "";
  const finalContent = message.content;
  const vfsPaths = message.vfsContextPaths;

  const toggleMessageFold = () => setIsMessageFolded(!isMessageFolded);

  return (
    <div
      className={cn(
        "group/message flex gap-3 px-4 py-3 transition-colors relative rounded-lg", // Adjusted padding/gap/rounded
        isUser ? "bg-gray-900/50" : "bg-gray-800/60", // Slightly adjusted background
        "hover:bg-gray-800", // Common hover for both user/assistant
        className,
      )}
    >
      {/* Avatar/Icon & Fold Button */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5 mt-1">
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
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
        {/* Message Fold Button */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded"
                onClick={toggleMessageFold}
                aria-label={
                  isMessageFolded ? "Expand message" : "Collapse message"
                }
              >
                {isMessageFolded ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isMessageFolded ? "Expand message" : "Collapse message"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Message Content Area */}
      <div className="flex-grow min-w-0 pr-12">
        {/* Role label */}
        <div className="text-xs font-medium text-gray-400 mb-1 select-none">
          {isUser ? "You" : "Assistant"}
        </div>

        {/* Content (Conditionally Rendered) */}
        {!isMessageFolded && (
          <>
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
                  "prose-code:before:content-none prose-code:after:content-none", // Handled by CodeBlock component now
                  "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0", // Handled by CodeBlock component now
                )}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: CodeBlock, // Use the enhanced CodeBlock
                  }}
                >
                  {finalContent}
                </ReactMarkdown>
              </div>
            )}

            {/* VFS Context Paths */}
            {isUser && vfsPaths && vfsPaths.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700/50 flex flex-wrap gap-x-3 gap-y-1">
                <span className="text-xs text-gray-500 font-medium w-full mb-0.5 select-none">
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

            {/* Metadata (Provider, Tokens, Speed) */}
            {!isUser && (
              <div className="mt-2 opacity-0 group-hover/message:opacity-100 transition-opacity text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 select-none">
                {message.providerId && message.modelId && (
                  <span>
                    {message.providerId}:
                    <span className="ml-1 font-medium text-gray-400">
                      {message.modelId}
                    </span>
                  </span>
                )}
                {(message.tokensInput !== undefined ||
                  message.tokensOutput !== undefined) && (
                  <span>
                    Tokens:
                    {message.tokensInput !== undefined && (
                      <>
                        {" "}
                        In{" "}
                        <strong className="text-gray-400">
                          {message.tokensInput}
                        </strong>
                      </>
                    )}
                    {message.tokensOutput !== undefined && (
                      <>
                        , Out{" "}
                        <strong className="text-gray-400">
                          {message.tokensOutput}
                        </strong>
                      </>
                    )}
                  </span>
                )}
                {message.tokensPerSecond !== undefined && (
                  <span>
                    Speed:{" "}
                    <strong className="text-gray-400">
                      {message.tokensPerSecond.toFixed(1)}
                    </strong>{" "}
                    tok/s
                  </span>
                )}
              </div>
            )}

            {/* Error */}
            {message.error && (
              <p className="text-xs text-red-400 mt-1">
                Error: {message.error}
              </p>
            )}
          </>
        )}
        {/* Show placeholder if folded */}
        {isMessageFolded && (
          <div className="text-sm text-gray-500 italic mt-1 select-none">
            Message content hidden...
          </div>
        )}
      </div>

      {/* Actions Area */}
      <div className="absolute right-4 h-full top-0">
        <div className="sticky top-3.5">
          {" "}
          {/* Adjusted sticky position */}
          <MessageActions
            message={message}
            onRegenerate={
              !isUser &&
              onRegenerate &&
              message.id &&
              !message.isStreaming &&
              !message.error
                ? () => onRegenerate(message.id!)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
};

// Custom comparison function for React.memo - ADD isMessageFolded check
const messagesAreEqual = (
  prevProps: MessageBubbleProps & { isMessageFolded?: boolean }, // Include internal state if needed for comparison logic
  nextProps: MessageBubbleProps & { isMessageFolded?: boolean },
): boolean => {
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;

  // Compare folding state if it were passed (it's internal, so this isn't strictly needed for memoization unless passed as prop)
  // if (prevProps.isMessageFolded !== nextProps.isMessageFolded) return false;

  // Basic checks for changes that always warrant a rerender
  if (
    prevMsg.id !== nextMsg.id ||
    prevMsg.role !== nextMsg.role ||
    prevMsg.error !== nextMsg.error ||
    prevMsg.isStreaming !== nextMsg.isStreaming ||
    prevMsg.vfsContextPaths !== nextMsg.vfsContextPaths ||
    (prevMsg.vfsContextPaths &&
      nextMsg.vfsContextPaths &&
      (prevMsg.vfsContextPaths.length !== nextMsg.vfsContextPaths.length ||
        !prevMsg.vfsContextPaths.every(
          (val, index) => val === nextMsg.vfsContextPaths?.[index],
        ))) ||
    // Compare metadata that might change after streaming finishes
    prevMsg.providerId !== nextMsg.providerId ||
    prevMsg.modelId !== nextMsg.modelId ||
    prevMsg.tokensInput !== nextMsg.tokensInput ||
    prevMsg.tokensOutput !== nextMsg.tokensOutput ||
    prevMsg.tokensPerSecond !== nextMsg.tokensPerSecond
  ) {
    return false;
  }

  // If streaming, compare streamedContent
  if (nextMsg.isStreaming) {
    // Optimization: Only rerender if streamed content actually changes significantly
    // This simple check might be sufficient if updates are frequent but small
    return prevMsg.streamedContent === nextMsg.streamedContent;
    // More complex check (e.g., length difference threshold) could be added if needed
  }

  // If not streaming, compare final content
  return prevMsg.content === nextMsg.content;
};

export const MemoizedMessageBubble = React.memo(
  MessageBubble,
  messagesAreEqual,
);
