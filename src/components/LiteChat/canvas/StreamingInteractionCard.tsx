// src/components/LiteChat/canvas/StreamingInteractionCard.tsx
import React, { memo } from "react";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { StopButton } from "@/components/LiteChat/common/StopButton";
import { StreamingContentView } from "./StreamingContentView"; // Import the content view
import { WrenchIcon, Loader2 } from "lucide-react"; // Import icons for tool call

interface StreamingInteractionCardProps {
  interactionId: string;
  onStop: (id: string) => void;
}

export const StreamingInteractionCard: React.FC<StreamingInteractionCardProps> =
  memo(({ interactionId, onStop }) => {
    // Fetch minimal data needed for the shell display (only once ideally)
    // We select specific fields to minimize re-renders of this shell component
    const interactionShellData = useInteractionStore(
      useShallow((state) => {
        const interaction = state.interactions.find(
          (i) => i.id === interactionId,
        );
        // Return only necessary shell data, or null if not found/not streaming
        return interaction && interaction.status === "STREAMING"
          ? {
              index: interaction.index,
              type: interaction.type,
              modelId: interaction.metadata?.modelId,
              // Check if there are tool calls in metadata
              hasToolCalls: (interaction.metadata?.toolCalls?.length ?? 0) > 0,
            }
          : null;
      }),
    );

    // If interaction disappears or stops streaming while shell is rendered
    if (!interactionShellData) {
      console.log(
        `[StreamingInteractionCard] Shell data not found or not streaming for ${interactionId}, rendering null.`,
      );
      return null;
    }

    const { index, type, modelId, hasToolCalls } = interactionShellData;

    return (
      <div
        key={interactionId} // Use interactionId as key
        className={cn(
          // Add group class
          "p-3 my-2 border rounded-md shadow-sm bg-card border-dashed relative group",
        )}
      >
        {/* Header - Renders based on minimally selected data */}
        <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            Idx:{index} | {type} | Streaming
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            {modelId && <span className="ml-1 text-blue-400">({modelId})</span>}
            {/* Display indicator if tool calls are present */}
            {hasToolCalls && (
              <span className="ml-2 flex items-center gap-1 text-orange-400">
                <WrenchIcon className="h-3 w-3" />
                (Using Tools...)
              </span>
            )}
          </span>
          {/* Use the sticky class for the stop button container */}
          <div className="interaction-card-actions-sticky">
            <StopButton interactionId={interactionId} onStop={onStop} />
          </div>
        </div>
        {/* Content Area - Render the dedicated streaming view component */}
        <StreamingContentView interactionId={interactionId} />
        {/* Optionally show a placeholder if tools are being called but no text is streaming yet */}
        {hasToolCalls &&
          !useInteractionStore.getState().activeStreamBuffers[
            interactionId
          ] && (
            <div className="mt-2 text-xs text-muted-foreground italic flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Executing tools...
            </div>
          )}
      </div>
    );
  });
StreamingInteractionCard.displayName = "StreamingInteractionCard";
