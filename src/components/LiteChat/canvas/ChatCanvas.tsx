// src/components/LiteChat/canvas/ChatCanvas.tsx
import React, { useMemo, useRef, useEffect } from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { InteractionCard } from "./InteractionCard";
import { StreamingInteractionCard } from "./StreamingInteractionCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useInteractionStore } from "@/store/interaction.store";
import { Skeleton } from "@/components/ui/skeleton";

export interface ChatCanvasProps {
  conversationId: string | null;
  interactions: Interaction[];
  status: "idle" | "loading" | "streaming" | "error";
  className?: string;
  onRegenerateInteraction?: (interactionId: string) => void;
  onEditInteraction?: (interactionId: string) => void; // Add onEdit prop
  onStopInteraction?: (interactionId: string) => void;
}

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  status,
  className,
  onRegenerateInteraction,
  onEditInteraction, // Receive onEdit prop
  onStopInteraction,
}) => {
  // Ref for the ScrollArea component itself
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const streamingInteractionIds = useInteractionStore(
    (state) => state.streamingInteractionIds,
  );

  // Group interactions by their parentId or index for potential future grouping logic
  // For now, we'll treat each interaction as its own group for simplicity
  const interactionGroups = useMemo(() => {
    const groups: Interaction[][] = [];
    // const interactionMap = new Map(interactions.map((i) => [i.id, i]));
    const processedIds = new Set<string>();

    interactions
      .sort((a, b) => a.index - b.index)
      .forEach((interaction) => {
        if (processedIds.has(interaction.id)) return;

        // Simple grouping: each interaction is its own group for now
        const group = [interaction];
        processedIds.add(interaction.id);
        groups.push(group);

        // Example of potential future grouping logic (e.g., by parentId for revisions)
        // let current = interaction;
        // const group = [current];
        // processedIds.add(current.id);
        // while (current.parentId && interactionMap.has(current.parentId) && !processedIds.has(current.parentId)) {
        //     const parent = interactionMap.get(current.parentId)!;
        //     group.unshift(parent); // Add parent to the beginning
        //     processedIds.add(parent.id);
        //     current = parent;
        // }
        // groups.push(group);
      });
    return groups;
  }, [interactions]);

  // Scroll to bottom effect
  useEffect(() => {
    // Find the viewport element within the ScrollArea ref
    const viewportElement = scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]",
    );

    if (viewportElement) {
      // Scroll down only if not already near the bottom (e.g., user scrolled up)
      // or if a new streaming interaction started
      const { scrollHeight, clientHeight, scrollTop } = viewportElement;
      const isAtBottom = scrollHeight - clientHeight <= scrollTop + 100; // Threshold
      const isStreamingJustStarted =
        status === "streaming" && streamingInteractionIds.length > 0;

      if (isAtBottom || isStreamingJustStarted) {
        viewportElement.scrollTo({
          top: scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [interactions, status, streamingInteractionIds]); // Depend on interactions and status

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="space-y-4 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    if (!conversationId) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">
            Select a conversation or start a new one.
          </p>
        </div>
      );
    }

    if (interactions.length === 0 && status !== "streaming") {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">No messages yet.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        {interactionGroups.map((group) => {
          // For now, render each interaction individually
          const interaction = group[0]; // Get the single interaction from the group
          const isStreaming = streamingInteractionIds.includes(interaction.id);

          if (isStreaming) {
            return (
              <StreamingInteractionCard
                key={`${interaction.id}-streaming`}
                interactionId={interaction.id}
                onStop={onStopInteraction}
              />
            );
          } else {
            return (
              <InteractionCard
                key={interaction.id}
                interaction={interaction}
                // Pass onEdit prop down
                onEdit={onEditInteraction}
                onRegenerate={onRegenerateInteraction}
                onDelete={
                  interaction.type === "message.user_assistant"
                    ? useInteractionStore.getState().deleteInteraction
                    : undefined
                }
              />
            );
          }
        })}
        {/* Render placeholder for newly started streaming interactions not yet in the main list */}
        {status === "streaming" &&
          streamingInteractionIds
            .filter((id) => !interactions.some((i) => i.id === id))
            .map((id) => (
              <StreamingInteractionCard
                key={`${id}-streaming-new`}
                interactionId={id}
                onStop={onStopInteraction}
              />
            ))}
      </div>
    );
  };

  return (
    // Pass the ref to the ScrollArea component itself
    <ScrollArea className={cn("flex-grow", className)} ref={scrollAreaRef}>
      {renderContent()}
    </ScrollArea>
  );
};
