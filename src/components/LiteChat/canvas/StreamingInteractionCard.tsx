// src/components/LiteChat/canvas/StreamingInteractionCard.tsx
// FULL FILE
import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { UserPromptDisplay } from "./UserPromptDisplay";
import { StreamingContentView } from "./StreamingContentView";
import { StopButton } from "@/components/LiteChat/common/StopButton";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useSettingsStore } from "@/store/settings.store";
import {
  BrainCircuitIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BotIcon,
} from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import type { Interaction } from "@/types/litechat/interaction";
import type { CanvasControl } from "@/types/litechat/canvas/control";
import { InteractionService } from "@/services/interaction.service";

interface StreamingInteractionCardProps {
  interactionId: string;
  className?: string;
  renderSlot?: (
    targetSlotName: CanvasControl["targetSlot"],
    contextInteraction: Interaction
  ) => React.ReactNode[];
}

export const StreamingInteractionCard: React.FC<StreamingInteractionCardProps> =
  React.memo(({ interactionId, className, renderSlot }) => {
    const { interaction, interactionStatus } = useInteractionStore(
      useShallow((state) => {
        const currentInteraction = state.interactions.find(
          (i) => i.id === interactionId
        );
        return {
          interaction: currentInteraction,
          interactionStatus: currentInteraction?.status,
        };
      })
    );

    const streamingRenderFPS = useSettingsStore(
      (state) => state.streamingRenderFPS
    );

    const [displayedContent, setDisplayedContent] = useState("");
    const [reasoningContent, setReasoningContent] = useState("");
    const [isReasoningFolded, setIsReasoningFolded] = useState(true);
    const [isResponseFolded, setIsResponseFolded] = useState(false);

    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const interval = 1000 / streamingRenderFPS;
      let isMounted = true;

      const updateDisplay = (timestamp: number) => {
        if (!isMounted) return;

        const isStillStreaming = useInteractionStore
          .getState()
          .streamingInteractionIds.includes(interactionId);

        if (isStillStreaming) {
          if (timestamp - lastUpdateTimeRef.current >= interval) {
            const latestBuffer =
              useInteractionStore.getState().activeStreamBuffers[
                interactionId
              ] ?? "";
            const latestReasoningBuffer =
              useInteractionStore.getState().activeReasoningBuffers[
                interactionId
              ] ?? "";
            setDisplayedContent(latestBuffer);
            setReasoningContent(latestReasoningBuffer);
            lastUpdateTimeRef.current = timestamp;
          }
          animationFrameRef.current = requestAnimationFrame(updateDisplay);
        } else {
          const finalBuffer =
            useInteractionStore.getState().activeStreamBuffers[interactionId] ??
            "";
          const finalReasoningBuffer =
            useInteractionStore.getState().activeReasoningBuffers[
              interactionId
            ] ?? "";
          setDisplayedContent(finalBuffer);
          setReasoningContent(finalReasoningBuffer);
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(updateDisplay);

      return () => {
        isMounted = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }, [interactionId, streamingRenderFPS]);

    useEffect(() => {
      if (interactionStatus && interactionStatus !== "STREAMING") {
        const finalBuffer =
          useInteractionStore.getState().activeStreamBuffers[interactionId] ??
          "";
        const finalReasoningBuffer =
          useInteractionStore.getState().activeReasoningBuffers[
            interactionId
          ] ?? "";
        setDisplayedContent(finalBuffer);
        setReasoningContent(finalReasoningBuffer);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    }, [interactionStatus, interactionId]);

    const { dbProviderConfigs, getAllAvailableModelDefsForProvider } =
      useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          getAllAvailableModelDefsForProvider:
            state.getAllAvailableModelDefsForProvider,
        }))
      );

    const displayModelName = useMemo(() => {
      const modelIdFromMeta = interaction?.metadata?.modelId;
      if (!modelIdFromMeta) return "Loading Model...";
      const { providerId, modelId: specificModelId } =
        splitModelId(modelIdFromMeta);
      if (!providerId || !specificModelId) return modelIdFromMeta;
      const provider = dbProviderConfigs.find((p) => p.id === providerId);
      const providerName = provider?.name ?? providerId;
      const allModels = getAllAvailableModelDefsForProvider(providerId);
      const modelDef = allModels.find((m) => m.id === specificModelId);
      return `${modelDef?.name ?? specificModelId} (${providerName})`;
    }, [
      interaction?.metadata?.modelId,
      dbProviderConfigs,
      getAllAvailableModelDefsForProvider,
    ]);

    const toggleReasoningFold = useCallback(
      () => setIsReasoningFolded((prev) => !prev),
      []
    );

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

    if (!interaction) {
      return (
        <div
          className={cn(
            "group/card relative rounded-lg border border-primary/30 bg-card p-4 shadow-sm animate-pulse",
            className
          )}
        >
          <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Assistant (Loading...)
              </span>
              <span className="text-xs text-muted-foreground">
                Streaming...
              </span>
            </div>
            <div className="h-16 bg-muted rounded w-full"></div>
          </div>
        </div>
      );
    }

    const handleStopClick = () => {
      InteractionService.abortInteraction(interactionId);
    };

    const canFoldResponse =
      (displayedContent && displayedContent.trim().length > 0) ||
      (reasoningContent && reasoningContent.trim().length > 0);

    const headerActionsSlot = renderSlot?.(
      "header-actions",
      interaction
    );
    const footerActionsSlot = renderSlot?.(
      "actions",
      interaction
    );
    const contentSlot = renderSlot?.("content", interaction);

    return (
      <div
        ref={cardRef}
        className={cn(
          "group/card relative rounded-lg border border-primary/30 bg-card p-4 shadow-sm animate-fadeIn",
          className
        )}
      >
        {interaction.prompt && (
          <UserPromptDisplay
            turnData={interaction.prompt}
            timestamp={interaction.startedAt}
            isAssistantComplete={false}
          />
        )}
        <div className="mt-3 pt-3 border-t border-border/50">
          {renderSlot?.("menu", interaction)}

          <div
            className={cn(
              "flex flex-col sm:flex-row justify-between items-start mb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-20 p-1 -m-1 rounded-t"
            )}
          >
            <div className="flex items-start gap-1 min-w-0 mb-1 sm:mb-0">
              <BotIcon className="h-4 w-4 text-secondary flex-shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-secondary truncate mr-1">
                    Assistant ({displayModelName})
                  </span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/assistant:opacity-100 focus-within:opacity-100 transition-opacity">
                    {headerActionsSlot}
                    {canFoldResponse && (
                      <ActionTooltipButton
                        tooltipText={isResponseFolded ? "Unfold" : "Fold"}
                        onClick={toggleResponseFold}
                        aria-label={
                          isResponseFolded ? "Unfold response" : "Fold response"
                        }
                        icon={
                          isResponseFolded ? (
                            <ChevronDownIcon />
                          ) : (
                            <ChevronUpIcon />
                          )
                        }
                        iconClassName="h-3.5 w-3.5"
                        className="h-5 w-5"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-start flex-shrink-0 gap-1 self-end sm:self-start">
              <span className="text-xs text-muted-foreground mt-0.5">
                Streaming...
              </span>
            </div>
          </div>

          {!isResponseFolded && (
            <>
              {contentSlot}
              {reasoningContent && (
                <div className="my-2 p-2 border border-blue-500/30 bg-blue-500/10 rounded-md text-xs">
                  <div
                    className="flex items-center justify-between mb-1 cursor-pointer group/reasoning"
                    onClick={toggleReasoningFold}
                  >
                    <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <BrainCircuitIcon className="h-3.5 w-3.5" /> Reasoning
                      (Streaming)
                    </span>
                    <div className="flex items-center opacity-0 group-hover/reasoning:opacity-100 focus-within:opacity-100 transition-opacity">
                      {/* Copy for reasoning is internal to AssistantResponse for now */}
                      <ActionTooltipButton
                        tooltipText={
                          isReasoningFolded
                            ? "Show Reasoning"
                            : "Hide Reasoning"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReasoningFold();
                        }}
                        aria-label={
                          isReasoningFolded
                            ? "Show reasoning"
                            : "Hide reasoning"
                        }
                        icon={
                          isReasoningFolded ? (
                            <ChevronDownIcon />
                          ) : (
                            <ChevronUpIcon />
                          )
                        }
                        iconClassName="h-3 w-3"
                        className="h-5 w-5 text-muted-foreground"
                      />
                    </div>
                  </div>
                  {!isReasoningFolded && (
                    <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-background/30 rounded mt-1 overflow-wrap-anywhere">
                      {reasoningContent}
                    </pre>
                  )}
                </div>
              )}
              <StreamingContentView
                markdownContent={displayedContent}
                isStreaming={true}
              />
            </>
          )}
          {isResponseFolded && (
            <div
              className="text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20 p-1 rounded"
              onClick={toggleResponseFold}
            >
              {reasoningContent ? "[Reasoning] " : ""}
              {displayedContent && typeof displayedContent === "string"
                ? `"${displayedContent.substring(0, 80)}${
                    displayedContent.length > 80 ? "..." : ""
                  }"`
                : "[Streaming...]"}
            </div>
          )}
        </div>
        <div
          className={cn(
            "absolute bottom-1 right-1 md:bottom-2 md:right-2 flex items-center space-x-0.5 md:space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200",
            "bg-card/80 backdrop-blur-sm p-0.5 md:p-1 rounded-md shadow-md z-20"
          )}
        >
          {footerActionsSlot}
          <StopButton onStop={handleStopClick} aria-label="Stop Generation" />
        </div>
      </div>
    );
  });
StreamingInteractionCard.displayName = "StreamingInteractionCard";
