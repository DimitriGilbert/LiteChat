// src/components/LiteChat/canvas/UserPromptDisplay.tsx
import React from "react";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { FilePreviewRenderer } from "../common/FilePreviewRenderer";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface UserPromptDisplayProps {
  // Changed prop name from 'prompt' to 'turnData'
  turnData: Readonly<PromptTurnObject>;
  timestamp: Date | null;
  className?: string;
}

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = React.memo(
  ({ turnData, timestamp, className }) => {
    const timeAgo = timestamp
      ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
      : "Sending...";

    const hasFiles =
      turnData.metadata?.attachedFiles &&
      turnData.metadata.attachedFiles.length > 0;
    const hasContent = turnData.content && turnData.content.trim().length > 0;

    return (
      <div className={cn("user-prompt", className)}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-muted-foreground">
            User
          </span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        {/* Display attached files if any */}
        {hasFiles && (
          <div className="mb-2 space-y-1">
            {turnData.metadata.attachedFiles?.map((fileMeta) => (
              <FilePreviewRenderer
                key={fileMeta.id}
                fileMeta={fileMeta}
                isReadOnly={true} // Prompts in history are read-only
              />
            ))}
          </div>
        )}
        {/* Display text content if any */}
        {hasContent && (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {turnData.content}
          </p>
        )}
      </div>
    );
  },
);
UserPromptDisplay.displayName = "UserPromptDisplay";
