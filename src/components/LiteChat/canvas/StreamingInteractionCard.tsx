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
import { StopButton } from "../common/StopButton";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useSettingsStore } from "@/store/settings.store";
import { BrainCircuitIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { ActionTooltipButton } from "../common/ActionTooltipButton";

interface StreamingInteractionCardProps {
  interactionId: string;
  onStop?: (interactionId: string) => void;
  className?: string;
}

export const StreamingInteractionCard: React.FC<StreamingInteractionCardProps> =
  React.memo(({ interactionId, onStop, className }) => {
    // Get interaction data and buffered content
    const { interaction, interactionStatus } = useInteractionStore(
      useShallow((state) => {
        const interaction = state.interactions.find(
          (i) => i.id === interactionId,
        );
        return {
          interaction,
          interactionStatus: interaction?.status,
        };
      }),
    );

    // Get FPS setting
    const streamingRenderFPS = useSettingsStore(
      (state) => state.streamingRenderFPS,
    );

    // Local state for the *displayed* content, updated throttled
    const [displayedContent, setDisplayedContent] = useState("");
    // Add state for the reasoning buffer content
    const [reasoningContent, setReasoningContent] = useState("");
    const [isReasoningFolded, setIsReasoningFolded] = useState(true); // State for folding reasoning

    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);

    // Effect to handle throttled updates for BOTH buffers
    useEffect(() => {
      const interval = 1000 / streamingRenderFPS;
      let isMounted = true;

      const updateDisplay = (timestamp: number) => {
        if (!isMounted) return;

        // Check if the interaction is still streaming
        const isStillStreaming = useInteractionStore
          .getState()
          .streamingInteractionIds.includes(interactionId);

        if (isStillStreaming) {
          if (timestamp - lastUpdateTimeRef.current >= interval) {
            // Get the latest buffer content directly from the store state
            const latestBuffer =
              useInteractionStore.getState().activeStreamBuffers[
                interactionId
              ] ?? "";
            const latestReasoningBuffer =
              useInteractionStore.getState().activeReasoningBuffers[
                interactionId
              ] ?? "";
            setDisplayedContent(latestBuffer);
            setReasoningContent(latestReasoningBuffer); // Update reasoning content state
            lastUpdateTimeRef.current = timestamp;
          }
          // Continue requesting frames
          animationFrameRef.current = requestAnimationFrame(updateDisplay);
        } else {
          // Ensure the final content is displayed when streaming stops
          const finalBuffer =
            useInteractionStore.getState().activeStreamBuffers[interactionId] ??
            "";
          const finalReasoningBuffer =
            useInteractionStore.getState().activeReasoningBuffers[
              interactionId
            ] ?? "";
          setDisplayedContent(finalBuffer);
          setReasoningContent(finalReasoningBuffer); // Update reasoning content state
          animationFrameRef.current = null;
        }
      };

      // Start the animation loop
      animationFrameRef.current = requestAnimationFrame(updateDisplay);

      // Cleanup function
      return () => {
        isMounted = false;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
      // Re-run effect if interactionId or FPS changes
    }, [interactionId, streamingRenderFPS]);

    // Effect to ensure final content is displayed when interaction status changes from STREAMING
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
        setReasoningContent(finalReasoningBuffer); // Update reasoning content state
        // Ensure the animation loop is stopped if it hasn't already
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    }, [interactionStatus, interactionId]);

    // Get provider data using useShallow
    const { dbProviderConfigs, getAllAvailableModelDefsForProvider } =
      useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          getAllAvailableModelDefsForProvider:
            state.getAllAvailableModelDefsForProvider,
        })),
      );

    // --- Memoize Model Name Calculation ---
    const displayModelName = useMemo(() => {
      const modelIdFromMeta = interaction?.metadata?.modelId;
      if (!modelIdFromMeta) return "Loading Model...";

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
      interaction?.metadata?.modelId,
      dbProviderConfigs,
      getAllAvailableModelDefsForProvider,
    ]);
    // --- End Memoize Model Name Calculation ---

    const toggleReasoningFold = useCallback(
      () => setIsReasoningFolded((prev) => !prev),
      [],
    );

    if (!interaction) {
      console.warn(
        `StreamingInteractionCard: Interaction data for ${interactionId} not found yet.`,
      );
      return (
        <div
          className={cn(
            "group/card relative rounded-lg border border-primary/30 bg-card p-4 shadow-sm animate-pulse",
            className,
          )}
        >
          <div className="h-8 bg-muted rounded w-3/4 mb-4"></div>{" "}
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Assistant (Loading...)
              </span>
              <span className="text-xs text-muted-foreground">
                Streaming...
              </span>
            </div>
            <div className="h-16 bg-muted rounded w-full"></div>{" "}
          </div>
        </div>
      );
    }

    const handleStopClick = () => {
      if (onStop) {
        onStop(interactionId);
      }
    };

    return (
      <div
        className={cn(
          "group/card relative rounded-lg border border-primary/30 bg-card p-4 shadow-sm animate-fadeIn",
          className,
        )}
      >
        {interaction.prompt && (
          <UserPromptDisplay
            turnData={interaction.prompt}
            timestamp={interaction.startedAt}
            // Indicate assistant is not complete
            isAssistantComplete={false}
          />
        )}
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Assistant ({displayModelName})
            </span>
            <span className="text-xs text-muted-foreground">Streaming...</span>
          </div>

          {/* Display Streaming Reasoning */}
          {reasoningContent && (
            <div className="my-2 p-2 border border-blue-500/30 bg-blue-500/10 rounded-md text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <BrainCircuitIcon className="h-3.5 w-3.5" /> Reasoning
                  (Streaming)
                </span>
                <ActionTooltipButton
                  tooltipText={
                    isReasoningFolded ? "Show Reasoning" : "Hide Reasoning"
                  }
                  onClick={toggleReasoningFold}
                  aria-label={
                    isReasoningFolded ? "Show reasoning" : "Hide reasoning"
                  }
                  icon={
                    isReasoningFolded ? <ChevronDownIcon /> : <ChevronUpIcon />
                  }
                  iconClassName="h-3 w-3"
                  className="h-5 w-5 text-muted-foreground"
                />
              </div>
              {!isReasoningFolded && (
                <pre className="whitespace-pre-wrap text-xs font-mono p-2 bg-background/30 rounded mt-1 overflow-wrap-anywhere">
                  {reasoningContent}
                </pre>
              )}
            </div>
          )}

          {/* Render throttled main content */}
          <StreamingContentView
            markdownContent={displayedContent}
            isStreaming={true}
          />
        </div>
        {onStop && (
          <div className="absolute bottom-1 right-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
            <StopButton onStop={handleStopClick} aria-label="Stop Generation" />
          </div>
        )}
      </div>
    );
  });
StreamingInteractionCard.displayName = "StreamingInteractionCard";
