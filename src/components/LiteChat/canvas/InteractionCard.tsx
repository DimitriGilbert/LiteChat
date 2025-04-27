// src/components/LiteChat/canvas/InteractionCard.tsx
import React, { useState, useMemo, useCallback } from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardIcon,
  CheckIcon,
  ChevronsUpDownIcon, // Icon for fold/unfold
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useMarkdownParser,
  type ParsedContent,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { memo } from "react";
import { toast } from "sonner"; // For copy feedback

interface InteractionCardProps {
  interaction: Interaction;
  allInteractionsInGroup: Interaction[];
  onRegenerate?: (id: string) => void;
  className?: string;
}

const InteractionCardComponent: React.FC<InteractionCardProps> = ({
  interaction,
  allInteractionsInGroup,
  onRegenerate,
  className,
}) => {
  const [revisionIndex, setRevisionIndex] = useState(0);
  const [isFolded, setIsFolded] = useState(false); // State for folding
  const [isCopied, setIsCopied] = useState(false); // State for copy button

  const revisions = useMemo(() => {
    return allInteractionsInGroup
      .filter(
        (i) =>
          i.type === "message.user_assistant" &&
          i.status === "COMPLETED" &&
          i.prompt === null,
      )
      .sort(
        (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      );
  }, [allInteractionsInGroup]);

  const displayedInteraction = revisions[revisionIndex] || interaction;
  const responseText =
    typeof displayedInteraction.response === "string"
      ? displayedInteraction.response
      : null;

  const parsedContent: ParsedContent = useMarkdownParser(responseText);

  const canRegenerate =
    displayedInteraction.status === "COMPLETED" &&
    typeof onRegenerate === "function" &&
    revisionIndex === 0;

  const handleRegenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRegenerate && displayedInteraction.prompt) {
      onRegenerate(displayedInteraction.id);
    } else {
      console.error(
        "Could not regenerate: No callback or prompt data found in the interaction.",
        displayedInteraction,
      );
    }
  };

  const handleRevisionChange = (direction: "prev" | "next") => {
    setRevisionIndex((prev) => {
      if (direction === "prev") {
        return Math.min(prev + 1, revisions.length - 1);
      } else {
        return Math.max(prev - 1, 0);
      }
    });
  };

  const handleCopy = useCallback(async () => {
    if (!responseText) return;
    try {
      await navigator.clipboard.writeText(responseText);
      setIsCopied(true);
      toast.success("Response copied to clipboard!");
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy response.");
      console.error("Clipboard copy failed:", err);
    }
  }, [responseText]);

  const toggleFold = () => setIsFolded((prev) => !prev);

  const hasRevisions = revisions.length > 1;
  const canGoPrevRevision = revisionIndex < revisions.length - 1;
  const canGoNextRevision = revisionIndex > 0;

  // Get first few lines for folded preview
  const foldedPreviewText = useMemo(() => {
    if (!responseText) return "";
    return responseText.split("\n").slice(0, 3).join("\n");
  }, [responseText]);

  return (
    <div
      className={cn(
        "p-3 my-2 border rounded-md shadow-sm bg-card relative group",
        className,
      )}
    >
      {/* Header */}
      <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
        <span>
          Assistant | {displayedInteraction.status}
          {displayedInteraction.metadata?.modelId && (
            <span className="ml-2 text-blue-400">
              ({displayedInteraction.metadata.modelId})
            </span>
          )}
        </span>
        {/* Action Buttons Container - Now Sticky */}
        <div className="interaction-card-actions-sticky">
          {/* Fold/Unfold Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold response" : "Fold response"}
                >
                  <ChevronsUpDownIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFolded ? "Unfold" : "Fold"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Revision Navigation */}
          {hasRevisions && (
            <div className="flex items-center border border-border rounded bg-background/50">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRevisionChange("prev")}
                      disabled={!canGoPrevRevision}
                      aria-label="Previous revision"
                    >
                      <ChevronLeftIcon className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Previous Revision</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-[10px] px-1 text-muted-foreground select-none">
                {revisionIndex + 1}/{revisions.length}
              </span>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRevisionChange("next")}
                      disabled={!canGoNextRevision}
                      aria-label="Next revision"
                    >
                      <ChevronRightIcon className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Next Revision</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Copy Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                  aria-label="Copy response"
                  disabled={!responseText}
                >
                  {isCopied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Regenerate Button */}
          {canRegenerate && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={handleRegenerateClick}
                    aria-label="Regenerate response"
                  >
                    <RefreshCwIcon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Regenerate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="text-sm markdown-content">
        {isFolded ? (
          // Folded Preview
          <div className="folded-content-preview" onClick={toggleFold}>
            {/* Render first few lines as plain text or simple markdown */}
            <pre className="whitespace-pre-wrap break-words text-muted-foreground">
              {foldedPreviewText}
            </pre>
          </div>
        ) : (
          // Full Content
          parsedContent.map((part, index) => {
            if (typeof part === "string") {
              return (
                <div key={index} dangerouslySetInnerHTML={{ __html: part }} />
              );
            } else if (part.type === "code") {
              return (
                <CodeBlockRenderer
                  key={index}
                  lang={part.lang}
                  code={part.code}
                />
              );
            }
            return null;
          })
        )}
      </div>

      {/* Error Display */}
      {displayedInteraction.status === "ERROR" &&
        displayedInteraction.metadata?.error && (
          <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
            <AlertCircleIcon className="h-3.5 w-3.5" />
            <span>Error: {displayedInteraction.metadata.error}</span>
          </div>
        )}
    </div>
  );
};

export const InteractionCard = memo(InteractionCardComponent);
