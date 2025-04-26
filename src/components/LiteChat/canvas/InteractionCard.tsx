// src/components/LiteChat/canvas/InteractionCard.tsx
import React, { useState, useMemo } from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  RefreshCwIcon,
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Import the new parser hook and types
import {
  useMarkdownParser,
  type ParsedContent,
  type CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
// Import the new CodeBlockRenderer
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";
import { memo } from "react";

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

  const revisions = useMemo(() => {
    return allInteractionsInGroup
      .filter(
        (i) =>
          i.type === "message.user_assistant" &&
          i.status !== "STREAMING" &&
          i.response !== null,
      )
      .sort(
        (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      );
  }, [allInteractionsInGroup]);

  const displayedInteraction = revisions[revisionIndex] || interaction;

  // Use the new parser hook
  const parsedContent: ParsedContent = useMarkdownParser(
    typeof displayedInteraction.response === "string"
      ? displayedInteraction.response
      : null,
  );

  const canRegenerate =
    displayedInteraction.status === "COMPLETED" &&
    typeof onRegenerate === "function" &&
    revisionIndex === 0;

  const handleRegenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRegenerate) {
      const userInteraction = allInteractionsInGroup.find(
        (i) => i.type === "message.user_assistant" && i.prompt !== null,
      );
      if (userInteraction) {
        onRegenerate(userInteraction.id);
      } else {
        console.error("Could not find user interaction to regenerate from.");
      }
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

  const hasRevisions = revisions.length > 1;
  const canGoPrevRevision = revisionIndex < revisions.length - 1;
  const canGoNextRevision = revisionIndex > 0;

  return (
    <div
      className={cn(
        "p-3 my-2 border rounded-md shadow-sm bg-card relative group",
        className,
      )}
    >
      {/* Header remains the same */}
      <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
        <span>
          Assistant | {displayedInteraction.status}
          {displayedInteraction.metadata?.modelId && (
            <span className="ml-2 text-blue-400">
              ({displayedInteraction.metadata.modelId})
            </span>
          )}
        </span>
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
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

      {/* Render mixed content */}
      <div className="text-sm markdown-content">
        {parsedContent.map((part, index) => {
          if (typeof part === "string") {
            // Render HTML string parts
            return (
              <div key={index} dangerouslySetInnerHTML={{ __html: part }} />
            );
          } else if (part.type === "code") {
            // Render CodeBlockRenderer for code parts
            return (
              <CodeBlockRenderer
                key={index}
                lang={part.lang}
                code={part.code}
              />
            );
          }
          return null;
        })}
      </div>

      {/* Error Display remains the same */}
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
