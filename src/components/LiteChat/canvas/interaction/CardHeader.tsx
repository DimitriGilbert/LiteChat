// src/components/LiteChat/canvas/interaction/CardHeader.tsx
// FULL FILE
import React, { useState, useCallback } from "react";
import {
  BotIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon,
  ClockIcon,
  ZapIcon,
  CoinsIcon,
} from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CardHeaderProps {
  displayModelName: string;
  timeAgo: string;
  responseContent: string | null;
  isFolded: boolean;
  toggleFold: () => void;
  canFold: boolean;
  promptTokens?: number;
  completionTokens?: number;
  timeToFirstToken?: number;
  generationTime?: number;
}

const formatMs = (ms: number | undefined): string => {
  if (ms === undefined) return "?";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

export const CardHeader: React.FC<CardHeaderProps> = ({
  displayModelName,
  timeAgo,
  responseContent,
  isFolded,
  toggleFold,
  canFold,
  promptTokens,
  completionTokens,
  timeToFirstToken,
  generationTime,
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

  const totalTokens =
    promptTokens !== undefined && completionTokens !== undefined
      ? promptTokens + completionTokens
      : undefined;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row justify-between items-start mb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-20 p-1 -m-1 rounded-t",
      )}
    >
      <div className="flex items-start gap-1 min-w-0 mb-1 sm:mb-0">
        <BotIcon className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-secondary truncate mr-1">
              Assistant ({displayModelName})
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity">
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
                  className="h-5 w-5"
                />
              )}
              {canFold && (
                <ActionTooltipButton
                  tooltipText={isFolded ? "Unfold" : "Fold"}
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold response" : "Fold response"}
                  icon={isFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
                  iconClassName="h-3.5 w-3.5"
                  className="h-5 w-5"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {totalTokens !== undefined && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-0.5 cursor-default">
                    <CoinsIcon className="h-3 w-3" />
                    <span>{totalTokens.toLocaleString()}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Tokens: {promptTokens ?? "?"} (Prompt) +{" "}
                    {completionTokens ?? "?"} (Completion) = {totalTokens}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {timeToFirstToken !== undefined && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-0.5 cursor-default">
                    <ZapIcon className="h-3 w-3" />
                    <span>{formatMs(timeToFirstToken)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Time to First Token
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {generationTime !== undefined && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-0.5 cursor-default">
                    <ClockIcon className="h-3 w-3" />
                    <span>{formatMs(generationTime)}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Total Generation Time
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start flex-shrink-0 gap-1 self-end sm:self-start">
        <span className="text-xs text-muted-foreground mt-0.5">{timeAgo}</span>
      </div>
    </div>
  );
};
