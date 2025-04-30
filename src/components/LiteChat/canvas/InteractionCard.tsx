// src/components/LiteChat/canvas/InteractionCard.tsx
// Entire file content provided
import React, { useMemo, useState, useCallback } from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { UserPromptDisplay } from "./UserPromptDisplay";
// Removed StreamingContentView import
import {
  RefreshCwIcon,
  Trash2Icon,
  EditIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { ActionTooltipButton } from "../common/ActionTooltipButton";
// Import the markdown parser hook and types
import {
  useMarkdownParser,
  CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "../common/CodeBlockRenderer"; // Keep CodeBlockRenderer

interface InteractionCardProps {
  interaction: Interaction;
  onRegenerate?: (interactionId: string) => void;
  onDelete?: (interactionId: string) => void;
  onEdit?: (interactionId: string) => void;
  className?: string;
}

// Component to render static markdown content
const StaticContentView: React.FC<{ markdownContent: string | null }> = ({
  markdownContent,
}) => {
  const parsedContent = useMarkdownParser(markdownContent); // Use the parser hook

  if (!markdownContent?.trim()) {
    return (
      <div className="text-muted-foreground italic">No response content.</div>
    );
  }

  return (
    <div>
      {parsedContent.map((item, index) => {
        if (typeof item === "string") {
          return (
            <div
              key={`html-${index}`}
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          );
        } else if (item.type === "code") {
          const codeData = item as CodeBlockData;
          return (
            <CodeBlockRenderer
              key={`code-${index}`}
              lang={codeData.lang}
              code={codeData.code}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export const InteractionCard: React.FC<InteractionCardProps> = React.memo(
  ({ interaction, onRegenerate, onDelete, onEdit, className }) => {
    const [isResponseFolded, setIsResponseFolded] = useState(false);
    const [isResponseCopied, setIsResponseCopied] = useState(false);

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

    const displayModelName = useMemo(() => {
      const modelIdFromMeta = interaction.metadata?.modelId;
      if (!modelIdFromMeta) return "Unknown Model";

      const { providerId, modelId: specificModelId } =
        splitModelId(modelIdFromMeta);
      if (!providerId || !specificModelId) {
        return modelIdFromMeta;
      }

      const provider = dbProviderConfigs.find((p) => p.id === providerId);
      const providerName = provider?.name ?? providerId;

      const allModels = getAllAvailableModelDefsForProvider(providerId);
      const modelDef = allModels.find((m) => m.id === specificModelId);

      return `${modelDef?.name ?? specificModelId} (${providerName})`;
    }, [
      interaction.metadata?.modelId,
      dbProviderConfigs,
      getAllAvailableModelDefsForProvider,
    ]);

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
        {interaction.prompt && (
          <UserPromptDisplay
            turnData={interaction.prompt}
            timestamp={interaction.startedAt}
          />
        )}

        <div className="mt-3 pt-3 border-t border-border/50 relative group/assistant">
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
              {hasResponseContent &&
                typeof interaction.response === "string" && (
                  <ActionTooltipButton
                    tooltipText="Copy Response"
                    onClick={handleCopyResponse}
                    aria-label="Copy assistant response"
                    icon={
                      isResponseCopied ? (
                        <CheckIcon className="text-green-500" />
                      ) : (
                        <ClipboardIcon />
                      )
                    }
                    className="h-5 w-5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity"
                  />
                )}
              {hasResponseContent && (
                <ActionTooltipButton
                  tooltipText={isResponseFolded ? "Unfold" : "Fold"}
                  onClick={toggleResponseFold}
                  aria-label={
                    isResponseFolded ? "Unfold response" : "Fold response"
                  }
                  icon={
                    isResponseFolded ? <ChevronDownIcon /> : <ChevronUpIcon />
                  }
                  iconClassName="h-3.5 w-3.5"
                  className="h-5 w-5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity"
                />
              )}
            </div>
          </div>

          {!isResponseFolded && (
            <>
              {isError && interaction.metadata?.error && (
                <div className="mb-2 rounded border border-destructive bg-destructive/10 p-2 text-xs text-destructive-foreground">
                  <p className="font-semibold">Error:</p>
                  <p>{interaction.metadata.error}</p>
                </div>
              )}
              {/* Use StaticContentView for completed interactions */}
              <StaticContentView markdownContent={interaction.response} />
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

        {showActions && (
          <div
            className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200
                       bg-card/80 backdrop-blur-sm p-1 rounded-md shadow-md z-20"
          >
            {onEdit && (
              <ActionTooltipButton
                tooltipText="Edit"
                onClick={handleEdit}
                aria-label="Edit User Prompt"
                icon={<EditIcon />}
                className="h-6 w-6"
              />
            )}
            {onRegenerate && (
              <ActionTooltipButton
                tooltipText="Regenerate"
                onClick={handleRegenerate}
                aria-label="Regenerate Response"
                icon={<RefreshCwIcon />}
                className="h-6 w-6"
              />
            )}
            {onDelete && (
              <ActionTooltipButton
                tooltipText="Delete"
                onClick={handleDelete}
                aria-label="Delete Interaction"
                icon={<Trash2Icon />}
                className="h-6 w-6 text-destructive hover:text-destructive/80"
              />
            )}
          </div>
        )}
      </div>
    );
  },
);
InteractionCard.displayName = "InteractionCard";
