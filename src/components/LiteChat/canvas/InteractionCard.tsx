// src/components/LiteChat/canvas/InteractionCard.tsx
// Entire file content provided
import React, { useMemo, useState, useCallback } from "react"; // Import useState, useCallback
import type { Interaction } from "@/types/litechat/interaction";
import { UserPromptDisplay } from "./UserPromptDisplay";
import { StreamingContentView } from "./StreamingContentView";
import { Button } from "@/components/ui/button";
import {
  RefreshCwIcon,
  Trash2Icon,
  EditIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon,
} from "lucide-react"; // Import icons
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
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner"; // Import toast

interface InteractionCardProps {
  interaction: Interaction;
  onRegenerate?: (interactionId: string) => void;
  onDelete?: (interactionId: string) => void;
  onEdit?: (interactionId: string) => void;
  className?: string;
}

export const InteractionCard: React.FC<InteractionCardProps> = React.memo(
  ({ interaction, onRegenerate, onDelete, onEdit, className }) => {
    const [isResponseFolded, setIsResponseFolded] = useState(false); // State for folding response
    const [isResponseCopied, setIsResponseCopied] = useState(false); // State for copy button

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

    const toggleResponseFold = useCallback(
      () => setIsResponseFolded((prev) => !prev),
      [],
    );

    const handleCopyResponse = useCallback(async () => {
      if (!interaction.response || typeof interaction.response !== "string") {
        toast.info("No text response to copy.");
        return;
      }
      try {
        await navigator.clipboard.writeText(interaction.response);
        setIsResponseCopied(true);
        toast.success("Assistant response copied!");
        setTimeout(() => setIsResponseCopied(false), 1500);
      } catch (err) {
        toast.error("Failed to copy response.");
        console.error("Clipboard copy failed:", err);
      }
    }, [interaction.response]);

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
    const hasResponseContent =
      interaction.response &&
      (typeof interaction.response !== "string" ||
        interaction.response.trim().length > 0);

    return (
      <div
        className={cn(
          "group/card relative rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50",
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
        <div className="mt-3 pt-3 border-t border-border/50 relative group/assistant">
          {/* Header */}
          <div className="flex justify-between items-center mb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-10 p-1 -m-1 rounded-t">
            <div className="flex items-center gap-2">
              <BotIcon className="h-4 w-4 text-secondary" />
              <span className="text-xs font-semibold text-secondary">
                Assistant ({displayModelName})
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-xs text-muted-foreground mr-2">
                {timeAgo}
              </span>
              {/* Copy Button */}
              {hasResponseContent &&
                typeof interaction.response === "string" && (
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity"
                          onClick={handleCopyResponse}
                          aria-label="Copy assistant response"
                        >
                          {isResponseCopied ? (
                            <CheckIcon className="h-3 w-3 text-green-500" />
                          ) : (
                            <ClipboardIcon className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Copy Response</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              {/* Fold Button */}
              {hasResponseContent && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity"
                        onClick={toggleResponseFold}
                        aria-label={
                          isResponseFolded ? "Unfold response" : "Fold response"
                        }
                      >
                        {isResponseFolded ? (
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronUpIcon className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {isResponseFolded ? "Unfold" : "Fold"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Content (Conditionally Rendered) */}
          {!isResponseFolded && (
            <>
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
            </>
          )}
          {isResponseFolded && (
            <div
              className="text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20 p-1 rounded"
              onClick={toggleResponseFold}
            >
              {typeof interaction.response === "string"
                ? `"${interaction.response.substring(0, 80)}${interaction.response.length > 80 ? "..." : ""}"`
                : "[Non-text response]"}
            </div>
          )}
        </div>

        {/* Action Buttons (Floating within the card) */}
        {showActions && (
          <div
            className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200
                       bg-card/80 backdrop-blur-sm p-1 rounded-md shadow-md z-20"
          >
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
