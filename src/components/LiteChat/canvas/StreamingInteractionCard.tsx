// src/components/LiteChat/canvas/StreamingInteractionCard.tsx
// FULL FILE
import React, { useMemo, useState, useEffect, useRef } from "react";
import { UserPromptDisplay } from "./UserPromptDisplay";
import { StreamingContentView } from "./StreamingContentView";
import { StopButton } from "../common/StopButton";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useProviderStore } from "@/store/provider.store";
import { splitModelId } from "@/lib/litechat/provider-helpers";
import { useSettingsStore } from "@/store/settings.store"; // Import settings store

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
          interactionStatus: interaction?.status, // Get status for final update check
        };
      }),
    );

    // Get FPS setting
    const streamingRenderFPS = useSettingsStore(
      (state) => state.streamingRenderFPS,
    );

    // Local state for the *displayed* content, updated throttled
    const [displayedContent, setDisplayedContent] = useState("");
    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(0);

    // Effect to handle throttled updates
    useEffect(() => {
      const interval = 1000 / streamingRenderFPS;
      let isMounted = true; // Flag to prevent updates after unmount

      const updateDisplay = (timestamp: number) => {
        if (!isMounted) return; // Exit if unmounted

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
            setDisplayedContent(latestBuffer);
            lastUpdateTimeRef.current = timestamp;
          }
          // Continue requesting frames
          animationFrameRef.current = requestAnimationFrame(updateDisplay);
        } else {
          // Ensure the final content is displayed when streaming stops
          const finalBuffer =
            useInteractionStore.getState().activeStreamBuffers[interactionId] ??
            "";
          setDisplayedContent(finalBuffer);
          animationFrameRef.current = null; // Stop the loop
        }
      };

      // Start the animation loop
      animationFrameRef.current = requestAnimationFrame(updateDisplay);

      // Cleanup function
      return () => {
        isMounted = false; // Set flag on unmount
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        // Ensure final update on unmount if needed (optional, might cause flicker if state is already updated)
        // const finalBuffer = useInteractionStore.getState().activeStreamBuffers[interactionId] ?? "";
        // setDisplayedContent(finalBuffer);
      };
      // Re-run effect if interactionId or FPS changes
    }, [interactionId, streamingRenderFPS]);

    // Effect to ensure final content is displayed when interaction status changes from STREAMING
    // This handles the case where the loop might stop slightly before the status update
    useEffect(() => {
      if (interactionStatus && interactionStatus !== "STREAMING") {
        const finalBuffer =
          useInteractionStore.getState().activeStreamBuffers[interactionId] ??
          "";
        setDisplayedContent(finalBuffer);
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
          {/* Render throttled content */}
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
