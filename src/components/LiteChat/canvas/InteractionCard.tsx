// src/components/LiteChat/canvas/InteractionCard.tsx
// FULL FILE
import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { UserPromptDisplay } from "@/components/LiteChat/canvas/UserPromptDisplay";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useShallow } from "zustand/react/shallow";
import { CardHeader } from "@/components/LiteChat/canvas/interaction/CardHeader";
import { AssistantResponse } from "@/components/LiteChat/canvas/interaction/AssistantResponse";
import type { CanvasControl, CanvasControlRenderContext } from "@/types/litechat/canvas/control";

interface InteractionCardProps {
  interaction: Interaction;
  className?: string;
  renderSlot?: (
    targetSlotName: CanvasControl["targetSlot"],
    contextInteraction: Interaction,
    overrideContext?: Partial<CanvasControlRenderContext>
  ) => React.ReactNode[];
  showPrompt?: boolean;
}

export const InteractionCard: React.FC<InteractionCardProps> = React.memo(
  ({ interaction, className, renderSlot, showPrompt = true }) => {
    const [isResponseFolded, setIsResponseFolded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const handleExpand = useCallback(() => {
      setIsResponseFolded(false);
    }, []);

    const handleCollapse = useCallback(() => {
      setIsResponseFolded(true);
    }, []);

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

    const headerActionsSlot = renderSlot?.(
      "header-actions",
      interaction,
      {
        isFolded: isResponseFolded,
        toggleFold: toggleResponseFold,
      }
    );
    const footerActionsSlot = renderSlot?.(
      "actions",
      interaction
    );
    const contentSlot = renderSlot?.("content", interaction);
    const menuSlot = renderSlot?.("menu", interaction);

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
        {showPrompt && interaction.prompt && (
          <UserPromptDisplay
            turnData={interaction.prompt}
            timestamp={interaction.startedAt}
            isAssistantComplete={isComplete}
            interactionId={interaction.id}
          />
        )}

        <div className={cn(
          "relative group/assistant",
          showPrompt && interaction.prompt ? "mt-3 pt-3 border-t border-border/50" : ""
        )}>
          {menuSlot}

          <CardHeader
            displayModelName={displayModelName}
            timeAgo={timeAgo}
            isFolded={isResponseFolded}
            toggleFold={toggleResponseFold}
            canFold={canFoldResponse}
            promptTokens={interaction.metadata?.promptTokens}
            completionTokens={interaction.metadata?.completionTokens}
            timeToFirstToken={interaction.metadata?.timeToFirstToken}
            generationTime={interaction.metadata?.generationTime}
            headerActionsSlot={
              headerActionsSlot && headerActionsSlot.length > 0 ? (
                <>{headerActionsSlot}</>
              ) : undefined
            }
          />

          {contentSlot}

          <AssistantResponse
            interactionId={interaction.id}
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

        {showActions && footerActionsSlot && footerActionsSlot.length > 0 && (
          <div
            className={cn(
              "absolute bottom-1 left-1 md:bottom-2 md:left-2 flex items-center space-x-0.5 md:space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200",
              "bg-card/80 backdrop-blur-sm p-0.5 md:p-1 rounded-md shadow-md z-[var(--z-sticky)]"
            )}
          >
            {footerActionsSlot}
          </div>
        )}
      </div>
    );
  }
);
InteractionCard.displayName = "InteractionCard";
