// src/components/LiteChat/canvas/InteractionCard.tsx
// FULL FILE
import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { UserPromptDisplay } from "@/components/LiteChat/canvas/UserPromptDisplay";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useShallow } from "zustand/react/shallow";
import { CardHeader } from "@/components/LiteChat/canvas/interaction/CardHeader";
import { CardActions } from "@/components/LiteChat/canvas/interaction/CardActions";
import { AssistantResponse } from "@/components/LiteChat/canvas/interaction/AssistantResponse";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";

interface InteractionCardProps {
  interaction: Interaction;
  onRegenerate?: (interactionId: string) => void;
  onDelete?: (interactionId: string) => void;
  onEdit?: (interactionId: string) => void;
  className?: string;
  renderSlot?: (slotName: "actions" | "menu" | "content") => React.ReactNode[];
}

export const InteractionCard: React.FC<InteractionCardProps> = React.memo(
  ({ interaction, onRegenerate, onDelete, onEdit, className, renderSlot }) => {
    const [isResponseFolded, setIsResponseFolded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (cardRef.current) {
        emitter.emit(canvasEvent.interactionMounted, {
          interactionId: interaction.id,
          element: cardRef.current,
        });

        return () => {
          emitter.emit(canvasEvent.interactionUnmounted, {
            interactionId: interaction.id,
          });
        };
      }
    }, [interaction.id]);

    const handleExpand = useCallback(() => {
      setIsResponseFolded(false);
      emitter.emit(canvasEvent.interactionExpanded, {
        interactionId: interaction.id,
      });
    }, [interaction.id]);

    const handleCollapse = useCallback(() => {
      setIsResponseFolded(true);
      emitter.emit(canvasEvent.interactionCollapsed, {
        interactionId: interaction.id,
      });
    }, [interaction.id]);

    const toggleResponseFold = useCallback(() => {
      if (isResponseFolded) {
        handleExpand();
      } else {
        handleCollapse();
      }
    }, [isResponseFolded, handleExpand, handleCollapse]);

    const { dbProviderConfigs, getAllAvailableModelDefsForProvider } =
      useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          getAllAvailableModelDefsForProvider:
            state.getAllAvailableModelDefsForProvider,
        }))
      );

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

    const isComplete = interaction.status === "COMPLETED";
    const showActions = isComplete || interaction.status === "ERROR";
    const isError = interaction.status === "ERROR";
    const hasResponseContent =
      interaction.response &&
      (typeof interaction.response !== "string" ||
        interaction.response.trim().length > 0);
    const hasToolCalls =
      interaction.metadata?.toolCalls &&
      interaction.metadata.toolCalls.length > 0;
    const hasToolResults =
      interaction.metadata?.toolResults &&
      interaction.metadata.toolResults.length > 0;
    const hasReasoning = !!interaction.metadata?.reasoning;
    const canFoldResponse =
      hasResponseContent || hasToolCalls || hasToolResults || hasReasoning;

    return (
      <div
        ref={cardRef}
        className={cn(
          "group/card relative rounded-lg border bg-card p-3 md:p-4 shadow-sm transition-colors hover:bg-muted/50",
          "overflow-wrap-anywhere",
          isError ? "border-destructive/50 bg-destructive/5" : "border-border",
          className
        )}
      >
        {interaction.prompt && (
          <UserPromptDisplay
            turnData={interaction.prompt}
            timestamp={interaction.startedAt}
            isAssistantComplete={isComplete}
          />
        )}

        <div className="mt-3 pt-3 border-t border-border/50 relative group/assistant">
          {/* Render custom menu items if provided */}
          {renderSlot?.("menu")}

          <CardHeader
            displayModelName={displayModelName}
            timeAgo={timeAgo}
            responseContent={
              typeof interaction.response === "string"
                ? interaction.response
                : null
            }
            isFolded={isResponseFolded}
            toggleFold={toggleResponseFold}
            canFold={canFoldResponse}
            promptTokens={interaction.metadata?.promptTokens}
            completionTokens={interaction.metadata?.completionTokens}
            timeToFirstToken={interaction.metadata?.timeToFirstToken}
            generationTime={interaction.metadata?.generationTime}
          />

          {/* Render custom content if provided */}
          {renderSlot?.("content")}

          <AssistantResponse
            response={interaction.response}
            toolCalls={interaction.metadata?.toolCalls}
            toolResults={interaction.metadata?.toolResults}
            reasoning={interaction.metadata?.reasoning}
            isError={isError}
            errorMessage={interaction.metadata?.error}
            isFolded={isResponseFolded}
            toggleFold={toggleResponseFold}
          />
        </div>

        {showActions && (
          <>
            {/* Render custom actions if provided */}
            {renderSlot?.("actions")}
            <CardActions
              interaction={interaction}
              onEdit={onEdit}
              onRegenerate={onRegenerate}
              onDelete={onDelete}
            />
          </>
        )}
      </div>
    );
  }
);
InteractionCard.displayName = "InteractionCard";
