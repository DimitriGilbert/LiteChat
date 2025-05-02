// src/components/LiteChat/canvas/interaction/CardHeader.tsx

import React, { useState, useCallback } from "react";
import {
  BotIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon,
} from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { toast } from "sonner";

interface CardHeaderProps {
  displayModelName: string;
  timeAgo: string;
  responseContent: string | null; // Needed for copy functionality
  isFolded: boolean;
  toggleFold: () => void;
  canFold: boolean; // Determine if fold button should be shown
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  displayModelName,
  timeAgo,
  responseContent,
  isFolded,
  toggleFold,
  canFold,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!responseContent || typeof responseContent !== "string") {
      toast.info("No text response to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(responseContent);
      setIsCopied(true);
      toast.success("Assistant response copied!");
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy response.");
      console.error("Clipboard copy failed:", err);
    }
  }, [responseContent]);

  return (
    <div className="flex justify-between items-center mb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-10 p-1 -m-1 rounded-t">
      <div className="flex items-center gap-2">
        <BotIcon className="h-4 w-4 text-secondary" />
        <span className="text-xs font-semibold text-secondary">
          Assistant ({displayModelName})
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <span className="text-xs text-muted-foreground mr-2">{timeAgo}</span>
        {responseContent && typeof responseContent === "string" && (
          <ActionTooltipButton
            tooltipText="Copy Response"
            onClick={handleCopy}
            aria-label="Copy assistant response"
            icon={
              isCopied ? (
                <CheckIcon className="text-green-500" />
              ) : (
                <ClipboardIcon />
              )
            }
            className="h-5 w-5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity"
          />
        )}
        {canFold && (
          <ActionTooltipButton
            tooltipText={isFolded ? "Unfold" : "Fold"}
            onClick={toggleFold}
            aria-label={isFolded ? "Unfold response" : "Fold response"}
            icon={isFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
            iconClassName="h-3.5 w-3.5"
            className="h-5 w-5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity"
          />
        )}
      </div>
    </div>
  );
};
