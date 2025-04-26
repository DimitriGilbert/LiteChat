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

interface InteractionCardProps {
  interaction: Interaction;
  allInteractions: Interaction[]; // Re-added prop
  onRegenerate?: (id: string) => void;
  className?: string;
}

export const InteractionCard: React.FC<InteractionCardProps> = ({
  interaction,
  allInteractions, // Use this prop
  onRegenerate,
  className,
}) => {
  const [revisionIndex, setRevisionIndex] = useState(0); // 0 is the latest

  // Find all revisions for the current interaction's index
  const revisions = useMemo(() => {
    return allInteractions
      .filter(
        (i) =>
          i.index === interaction.index &&
          i.status !== "STREAMING" &&
          i.type === interaction.type, // Ensure same type for revisions
      )
      .sort(
        (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      ); // Sort descending by time (latest first)
  }, [allInteractions, interaction.index, interaction.type]);

  // The interaction currently being displayed (based on revisionIndex)
  const displayedInteraction = revisions[revisionIndex] || interaction; // Fallback to original prop

  const isAssistant = displayedInteraction.type === "message.user_assistant";
  const canRegenerate =
    isAssistant &&
    displayedInteraction.status === "COMPLETED" &&
    typeof onRegenerate === "function" &&
    revisionIndex === 0; // Only allow regenerating the latest revision

  const handleRegenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRegenerate) {
      onRegenerate(displayedInteraction.id); // Regenerate the currently displayed one
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
      {/* Header Info */}
      <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
        <span>
          Idx:{displayedInteraction.index}{" "}
          {displayedInteraction.parentId &&
            `(Parent:${displayedInteraction.parentId.substring(0, 4)})`}{" "}
          | {displayedInteraction.type} | {displayedInteraction.status}
          {displayedInteraction.metadata?.modelId && (
            <span className="ml-2 text-blue-400">
              ({displayedInteraction.metadata.modelId})
            </span>
          )}
        </span>
        {/* Actions (Regenerate, Revisions) - Positioned top-right */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
          {/* Revision Controls */}
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

      {/* Prompt Data (if available) */}
      {displayedInteraction.prompt && (
        <details className="mb-1 cursor-pointer">
          <summary className="text-xs text-muted-foreground hover:text-foreground">
            Show Turn Data
          </summary>
          <pre className="text-xs bg-muted p-1 rounded mt-1 overflow-x-auto">
            {JSON.stringify(displayedInteraction.prompt, null, 2)}
          </pre>
        </details>
      )}

      {/* Response Content */}
      <pre className="text-sm whitespace-pre-wrap">
        {typeof displayedInteraction.response === "string" ||
        displayedInteraction.response === null
          ? displayedInteraction.response
          : JSON.stringify(displayedInteraction.response, null, 2)}
      </pre>

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
