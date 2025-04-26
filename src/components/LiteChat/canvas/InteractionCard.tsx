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
import { useMarkdownParser } from "@/lib/litechat/useMarkdownParser"; // Import the hook

interface InteractionCardProps {
  interaction: Interaction; // This should be the ASSISTANT interaction
  allInteractionsInGroup: Interaction[]; // All interactions with the same index
  onRegenerate?: (id: string) => void;
  className?: string;
}

export const InteractionCard: React.FC<InteractionCardProps> = ({
  interaction, // Expecting the assistant interaction here
  allInteractionsInGroup,
  onRegenerate,
  className,
}) => {
  const [revisionIndex, setRevisionIndex] = useState(0); // 0 is the latest

  // Find all assistant revisions for the current interaction's index
  const revisions = useMemo(() => {
    return allInteractionsInGroup
      .filter(
        (i) =>
          i.type === "message.user_assistant" && // Only assistant parts
          i.status !== "STREAMING" &&
          i.response !== null, // Ensure it's an assistant response
      )
      .sort(
        (a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
      ); // Sort descending by time (latest first)
  }, [allInteractionsInGroup]);

  // The interaction currently being displayed (based on revisionIndex)
  const displayedInteraction = revisions[revisionIndex] || interaction; // Fallback

  // Parse the Markdown content
  const renderedHtml = useMarkdownParser(
    typeof displayedInteraction.response === "string"
      ? displayedInteraction.response
      : null,
  );

  const canRegenerate =
    displayedInteraction.status === "COMPLETED" &&
    typeof onRegenerate === "function" &&
    revisionIndex === 0; // Only allow regenerating the latest revision

  const handleRegenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRegenerate) {
      // We need the ID of the *user* interaction that prompted this response
      const userInteraction = allInteractionsInGroup.find(
        (i) => i.type === "message.user_assistant" && i.prompt !== null,
      );
      if (userInteraction) {
        onRegenerate(userInteraction.id); // Regenerate based on the user prompt interaction ID
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
      {/* Header Info - Simplified for Assistant Response */}
      <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
        <span>
          Assistant | {displayedInteraction.status}
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

      {/* Response Content - Rendered as HTML */}
      <div
        className="text-sm markdown-content" // Add markdown-content class
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />

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
