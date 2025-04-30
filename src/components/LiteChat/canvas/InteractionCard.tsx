// src/components/LiteChat/canvas/InteractionCard.tsx
// Entire file content provided
import React, { useMemo } from "react"; // Import useMemo
import type { Interaction } from "@/types/litechat/interaction";
import { UserPromptDisplay } from "./UserPromptDisplay";
import { StreamingContentView } from "./StreamingContentView";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon, Trash2Icon, EditIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useShallow } from "zustand/react/shallow"; // Import useShallow

interface InteractionCardProps {
  interaction: Interaction;
  onRegenerate?: (interactionId: string) => void;
  onDelete?: (interactionId: string) => void;
  onEdit?: (interactionId: string) => void;
  className?: string;
}

export const InteractionCard: React.FC<InteractionCardProps> = React.memo(
  ({ interaction, onRegenerate, onDelete, onEdit, className }) => {
    // Use useShallow for potentially complex state or multiple selections
    const { dbProviderConfigs, getAllAvailableModelDefsForProvider } =
      useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          getAllAvailableModelDefsForProvider:
            state.getAllAvailableModelDefsForProvider,
        })),
      );

    const handleDelete = () => {
      if (
        onDelete &&
        window.confirm("Are you sure you want to delete this interaction?")
      ) {
        onDelete(interaction.id);
      }
    };

    const handleRegenerate = () => {
      if (onRegenerate) {
        onRegenerate(interaction.id);
      }
    };

    const handleEdit = () => {
      if (onEdit) {
        onEdit(interaction.id);
      }
    };

    const timeAgo = interaction.endedAt
      ? formatDistanceToNow(new Date(interaction.endedAt), { addSuffix: true })
      : "Processing...";

    // --- Memoize Model Name Calculation ---
    const displayModelName = useMemo(() => {
      const modelIdFromMeta = interaction.metadata?.modelId;
      if (!modelIdFromMeta) return "Unknown Model";

      const { providerId, modelId: specificModelId } =
        splitModelId(modelIdFromMeta);
      if (!providerId || !specificModelId) {
        return modelIdFromMeta; // Fallback if split fails
      }

      const provider = dbProviderConfigs.find((p) => p.id === providerId);
      const providerName = provider?.name ?? providerId;

      // Use the stable selector function from the store
      const allModels = getAllAvailableModelDefsForProvider(providerId);
      const modelDef = allModels.find((m) => m.id === specificModelId);

      return `${modelDef?.name ?? specificModelId} (${providerName})`;
    }, [
      interaction.metadata?.modelId,
      dbProviderConfigs, // Depend on the array reference
      getAllAvailableModelDefsForProvider, // Depend on the stable selector function
    ]);
    // --- End Memoize Model Name Calculation ---

    const showActions =
      interaction.status === "COMPLETED" || interaction.status === "ERROR";
    const isError = interaction.status === "ERROR";

    return (
      <div
        className={cn(
          "group relative rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50",
          isError ? "border-destructive/50 bg-destructive/5" : "border-border",
          className,
        )}
      >
        {/* User Prompt */}
        {interaction.prompt && (
          <UserPromptDisplay
            turnData={interaction.prompt}
            timestamp={interaction.startedAt}
          />
        )}

        {/* Assistant Response */}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Assistant ({displayModelName})
            </span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          {isError && interaction.metadata?.error && (
            <div className="mb-2 rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive-foreground">
              <p className="font-semibold">Error:</p>
              <p>{interaction.metadata.error}</p>
            </div>
          )}
          {/* Render response content */}
          <StreamingContentView
            markdownContent={interaction.response}
            isStreaming={false}
          />
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="absolute bottom-1 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-card/80 backdrop-blur-sm p-0.5 rounded">
            <TooltipProvider delayDuration={100}>
              {onEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleEdit}
                      aria-label="Edit User Prompt"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Edit</TooltipContent>
                </Tooltip>
              )}
              {onRegenerate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleRegenerate}
                      aria-label="Regenerate Response"
                    >
                      <RefreshCwIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Regenerate</TooltipContent>
                </Tooltip>
              )}
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive/80"
                      onClick={handleDelete}
                      aria-label="Delete Interaction"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Delete</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        )}
      </div>
    );
  },
);
InteractionCard.displayName = "InteractionCard";
