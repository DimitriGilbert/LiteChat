// src/components/LiteChat/canvas/UserPromptDisplay.tsx

import React, { useState, useCallback } from "react";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { FilePreviewRenderer } from "../common/FilePreviewRenderer";
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
import { ActionTooltipButton } from "../common/ActionTooltipButton";

interface UserPromptDisplayProps {
  turnData: Readonly<PromptTurnObject>;
  timestamp: Date | null;
  className?: string;
}

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = React.memo(
  ({ turnData, timestamp, className }) => {
    const [isFolded, setIsFolded] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

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

    return (
      <div className={cn("user-prompt relative group/user", className)}>
        <div className="flex justify-between items-center mb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-10 p-1 -m-1 rounded-t">
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">User</span>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-xs text-muted-foreground mr-2">
              {timeAgo}
            </span>
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
                className="h-5 w-5 opacity-0 group-hover/user:opacity-100 focus-within:opacity-100 transition-opacity"
              />
            )}
            {(hasContent || hasFiles) && (
              <ActionTooltipButton
                tooltipText={isFolded ? "Unfold" : "Fold"}
                onClick={toggleFold}
                aria-label={isFolded ? "Unfold prompt" : "Fold prompt"}
                icon={isFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
                iconClassName="h-3.5 w-3.5"
                className="h-5 w-5 opacity-0 group-hover/user:opacity-100 focus-within:opacity-100 transition-opacity"
              />
            )}
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
            {hasContent && (
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {turnData.content}
              </p>
            )}
          </>
        )}
        {isFolded && (
          <div
            className="text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20 p-1 rounded"
            onClick={toggleFold}
          >
            {hasContent
              ? `"${turnData.content.substring(0, 50)}${turnData.content.length > 50 ? "..." : ""}"`
              : ""}
            {hasContent && hasFiles ? " + " : ""}
            {hasFiles
              ? `${turnData.metadata.attachedFiles?.length} file(s)`
              : ""}
          </div>
        )}
      </div>
    );
  },
);
UserPromptDisplay.displayName = "UserPromptDisplay";
