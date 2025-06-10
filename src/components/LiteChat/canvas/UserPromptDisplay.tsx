// src/components/LiteChat/canvas/UserPromptDisplay.tsx
// FULL FILE
import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { FilePreviewRenderer } from "@/components/LiteChat/common/FilePreviewRenderer";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { useSettingsStore } from "@/store/settings.store";
// Import markdown parser and types
import {
  useMarkdownParser,
  CodeBlockData,
  MermaidBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { MermaidBlockRenderer } from "@/components/LiteChat/common/MermaidBlockRenderer";

interface UserPromptDisplayProps {
  turnData: Readonly<PromptTurnObject>;
  timestamp: Date | null;
  className?: string;
  isAssistantComplete?: boolean;
}

// Component to render parsed user content
const UserContentView: React.FC<{ markdownContent: string | null }> = ({
  markdownContent,
}) => {
  const parsedContent = useMarkdownParser(markdownContent);

  if (!markdownContent?.trim()) {
    return null;
  }

  return (
    // Add overflow-wrap here for the main text content
    <div className="overflow-wrap-anywhere">
      {parsedContent.map((item, index) => {
        if (typeof item === "string") {
          return (
            <div
              key={`html-${index}`}
              // Apply markdown styles, but maybe slightly different for user prompts?
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          );
        } else if (item.type === "code") {
          const codeData = item as CodeBlockData;
          // Use CodeBlockRenderer for consistency
          return (
            <CodeBlockRenderer
              key={`code-${index}`}
              lang={codeData.lang}
              code={codeData.code}
              filepath={codeData.filepath}
            />
          );
        } else if (item.type === "mermaid") {
          const mermaidData = item as MermaidBlockData;
          return (
            <MermaidBlockRenderer
              key={`mermaid-${index}`}
              code={mermaidData.code}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = React.memo(
  ({ turnData, timestamp, className, isAssistantComplete = true }) => {
    const foldUserMessagesOnCompletion = useSettingsStore(
      (state) => state.foldUserMessagesOnCompletion,
    );

    const [isFolded, setIsFolded] = useState(
      isAssistantComplete && foldUserMessagesOnCompletion,
    );
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
      if (isAssistantComplete && foldUserMessagesOnCompletion) {
        setIsFolded(true);
      }
    }, [isAssistantComplete, foldUserMessagesOnCompletion]);

    const timeAgo = timestamp
      ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
      : "Sending...";

    const hasFiles =
      turnData.metadata?.attachedFiles &&
      turnData.metadata.attachedFiles.length > 0;
    const hasContent = turnData.content && turnData.content.trim().length > 0;

    const toggleFold = useCallback(() => setIsFolded((prev) => !prev), []);

    const handleCopy = useCallback(async () => {
      if (!turnData.content) return;
      try {
        await navigator.clipboard.writeText(turnData.content);
        setIsCopied(true);
        toast.success("User prompt copied!");
        setTimeout(() => setIsCopied(false), 1500);
      } catch (err) {
        toast.error("Failed to copy prompt.");
        console.error("Clipboard copy failed:", err);
      }
    }, [turnData.content]);

    // Memoize folded summary text
    const foldedSummaryText = useMemo(() => {
      let summary = "";
      if (hasContent) {
        summary += `"${turnData.content.substring(0, 50)}${turnData.content.length > 50 ? "..." : ""}"`;
      }
      if (hasContent && hasFiles) {
        summary += " + ";
      }
      if (hasFiles) {
        summary += `${turnData.metadata.attachedFiles?.length} file(s)`;
      }
      return summary || "[Empty Prompt]"; // Fallback if somehow both are false
    }, [hasContent, hasFiles, turnData.content, turnData.metadata]);

    return (
      <div
        className={cn(
          "user-prompt relative group/user overflow-wrap-anywhere",
          className,
        )}
      >
        <div
          className={cn(
            "flex flex-col sm:flex-row justify-between items-start mb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-10 p-1 -m-1 rounded-t",
          )}
        >
          {/* Left Group: Icon, Name, Actions */}
          <div className="flex items-center gap-1 mb-1 sm:mb-0">
            <UserIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-primary mr-1">
              User
            </span>
            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/user:opacity-100 focus-within:opacity-100 transition-opacity">
              {hasContent && (
                <ActionTooltipButton
                  tooltipText="Copy Prompt"
                  onClick={handleCopy}
                  aria-label="Copy user prompt"
                  icon={
                    isCopied ? (
                      <CheckIcon className="text-green-500" />
                    ) : (
                      <ClipboardIcon />
                    )
                  }
                  className="h-5 w-5"
                />
              )}
              {(hasContent || hasFiles) && (
                <ActionTooltipButton
                  tooltipText={isFolded ? "Unfold" : "Fold"}
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold prompt" : "Fold prompt"}
                  icon={isFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
                  iconClassName="h-3.5 w-3.5"
                  className="h-5 w-5"
                />
              )}
            </div>
          </div>
          {/* Right Group: Timestamp */}
          <div className="flex items-center flex-shrink-0 self-end sm:self-start">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
        </div>

        {!isFolded && (
          <>
            {hasFiles && (
              <div className="mb-2 space-y-1">
                {turnData.metadata.attachedFiles?.map((fileMeta) => (
                  <FilePreviewRenderer
                    key={fileMeta.id}
                    fileMeta={fileMeta}
                    isReadOnly={true}
                  />
                ))}
              </div>
            )}
            {/* Use the new UserContentView component */}
            <UserContentView markdownContent={turnData.content} />
          </>
        )}
        {isFolded && (
          <div
            className="text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20 p-1 rounded"
            onClick={toggleFold}
          >
            {foldedSummaryText}
          </div>
        )}
      </div>
    );
  },
);
UserPromptDisplay.displayName = "UserPromptDisplay";
