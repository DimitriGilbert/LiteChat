// src/components/LiteChat/canvas/StreamingInteractionCard.tsx
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
  ClipboardIcon,
  CheckIcon,
} from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";

interface StreamingInteractionCardProps {
  interactionId: string;
  onStop?: (interactionId: string) => void;
  className?: string;
  renderSlot?: (slotName: "actions" | "menu" | "content") => React.ReactNode[];
}

export const StreamingInteractionCard: React.FC<StreamingInteractionCardProps> =
  React.memo(({ interactionId, onStop, className, renderSlot }) => {
    const { interaction, interactionStatus } = useInteractionStore(
      useShallow((state) => {
        const interaction = state.interactions.find(
          (i) => i.id === interactionId
        );
        return {
          interaction,
          interactionStatus: interaction?.status,
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
    const [isReasoningCopied, setIsReasoningCopied] = useState(false);
    const [isResponseCopied, setIsResponseCopied] = useState(false);

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

    useEffect(() => {
      if (cardRef.current) {
        emitter.emit(canvasEvent.interactionMounted, {
          interactionId: interactionId,
          element: cardRef.current,
        });

        return () => {
          emitter.emit(canvasEvent.interactionUnmounted, {
            interactionId: interactionId,
          });
        };
      }
    }, [interactionId]);

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
      emitter.emit(canvasEvent.interactionExpanded, {
        interactionId: interactionId,
      });
    }, [interactionId]);

    const handleCollapse = useCallback(() => {
      setIsResponseFolded(true);
      emitter.emit(canvasEvent.interactionCollapsed, {
        interactionId: interactionId,
      });
    }, [interactionId]);

    const toggleResponseFold = useCallback(() => {
      if (isResponseFolded) {
        handleExpand();
      } else {
        handleCollapse();
      }
    }, [isResponseFolded, handleExpand, handleCollapse]);

    const handleCopyReasoning = useCallback(async () => {
      if (!reasoningContent) return;
      try {
        await navigator.clipboard.writeText(reasoningContent);
        setIsReasoningCopied(true);
        toast.success("Reasoning copied!");
        setTimeout(() => setIsReasoningCopied(false), 1500);
      } catch (err) {
        toast.error("Failed to copy reasoning.");
      }
    }, [reasoningContent]);

    const handleCopyResponse = useCallback(async () => {
      if (!displayedContent) return;
      try {
        await navigator.clipboard.writeText(displayedContent);
        setIsResponseCopied(true);
        toast.success("Response copied!");
        setTimeout(() => setIsResponseCopied(false), 1500);
      } catch (err) {
        toast.error("Failed to copy response.");
      }
    }, [displayedContent]);

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
      if (onStop) {
        onStop(interactionId);
      }
    };

    const canFoldResponse =
      (displayedContent && displayedContent.trim().length > 0) ||
      (reasoningContent && reasoningContent.trim().length > 0);

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
          {/* Render custom menu items if provided */}
          {renderSlot?.("menu")}

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
                    {displayedContent && (
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
                        className="h-5 w-5"
                      />
                    )}
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
              {/* Render custom content if provided */}
              {renderSlot?.("content")}
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
                      <ActionTooltipButton
                        tooltipText="Copy Reasoning"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyReasoning();
                        }}
                        aria-label="Copy reasoning"
                        icon={
                          isReasoningCopied ? (
                            <CheckIcon className="text-green-500" />
                          ) : (
                            <ClipboardIcon />
                          )
                        }
                        className="h-5 w-5 text-muted-foreground"
                      />
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
        {onStop && (
          <>
            {/* Render custom actions if provided */}
            {renderSlot?.("actions")}
            <div className="absolute bottom-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
              <StopButton
                onStop={handleStopClick}
                aria-label="Stop Generation"
              />
            </div>
          </>
        )}
      </div>
    );
  });
StreamingInteractionCard.displayName = "StreamingInteractionCard";
