// src/components/LiteChat/canvas/InteractionCard.tsx
import React from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon, AlertCircleIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InteractionCardProps {
  interaction: Interaction;
  // allInteractions: Interaction[]; // Keep if needed for revision display later
  onRegenerate?: (id: string) => void;
  className?: string;
}

export const InteractionCard: React.FC<InteractionCardProps> = ({
  interaction,
  // allInteractions,
  onRegenerate,
  className,
}) => {
  const isAssistant = interaction.type === "message.user_assistant"; // Assuming this type for now
  const canRegenerate =
    isAssistant &&
    interaction.status === "COMPLETED" &&
    typeof onRegenerate === "function";

  const handleRegenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRegenerate) {
      onRegenerate(interaction.id);
    }
  };

  return (
    <div
      className={cn(
        "p-3 my-2 border rounded-md shadow-sm bg-card relative group", // Add relative and group
        className,
      )}
    >
      {/* Header Info */}
      <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
        <span>
          Idx:{interaction.index}{" "}
          {interaction.parentId &&
            `(Parent:${interaction.parentId.substring(0, 4)})`}{" "}
          | {interaction.type} | {interaction.status}
          {interaction.metadata?.modelId && (
            <span className="ml-2 text-blue-400">
              ({interaction.metadata.modelId})
            </span>
          )}
        </span>
        {/* Actions (Regenerate) - Positioned top-right within the card */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                <TooltipContent side="top">
                  <p>Regenerate</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Prompt Data (if available) */}
      {interaction.prompt && (
        <details className="mb-1 cursor-pointer">
          <summary className="text-xs text-muted-foreground hover:text-foreground">
            Show Turn Data
          </summary>
          <pre className="text-xs bg-muted p-1 rounded mt-1 overflow-x-auto">
            {JSON.stringify(interaction.prompt, null, 2)}
          </pre>
        </details>
      )}

      {/* Response Content */}
      <pre className="text-sm whitespace-pre-wrap">
        {typeof interaction.response === "string" ||
        interaction.response === null
          ? interaction.response
          : JSON.stringify(interaction.response, null, 2)}
      </pre>

      {/* Error Display */}
      {interaction.status === "ERROR" && interaction.metadata?.error && (
        <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
          <AlertCircleIcon className="h-3.5 w-3.5" />
          <span>Error: {interaction.metadata.error}</span>
        </div>
      )}

      {/* TODO: Add revision display logic using allInteractions and parentId */}
    </div>
  );
};
