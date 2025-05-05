// src/components/LiteChat/canvas/UserPromptDisplay.tsx
// FULL FILE - Adjusted padding for mobile
import React, { useState, useCallback, useEffect } from "react";
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
import { useSettingsStore } from "@/store/settings.store"; // Import settings store

interface UserPromptDisplayProps {
  turnData: Readonly<PromptTurnObject>;
  timestamp: Date | null;
  className?: string;
  // Add prop to indicate if the corresponding assistant response is complete
  isAssistantComplete?: boolean;
}

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = React.memo(
  ({ turnData, timestamp, className, isAssistantComplete = true }) => {
    // Get the setting from the store
    const foldUserMessagesOnCompletion = useSettingsStore(
      (state) => state.foldUserMessagesOnCompletion,
    );

    // Initialize fold state based on setting and completion status
    const [isFolded, setIsFolded] = useState(
      isAssistantComplete && foldUserMessagesOnCompletion,
    );
    const [isCopied, setIsCopied] = useState(false);

    // Effect to fold the message if the setting is enabled *after* the assistant completes
    useEffect(() => {
      if (isAssistantComplete && foldUserMessagesOnCompletion) {
        setIsFolded(true);
      }
      // We only want this effect to run when the assistant completion status changes
      // or the setting changes. We don't want it to re-run if the user manually unfolds.
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

    return (
      <div className={cn("user-prompt relative group/user", className)}>
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
