// src/components/LiteChat/canvas/ChatCanvas.tsx
import React from "react";
import type { Interaction } from "@/types/litechat/interaction";
import type { ChatCanvasProps } from "@/types/litechat/chat";
import { cn } from "@/lib/utils";
import { InteractionCard } from "./InteractionCard";
import { UserPromptDisplay } from "./UserPromptDisplay";
import { StreamingInteractionCard } from "./StreamingInteractionCard";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  status,
  className,
  onRegenerateInteraction,
  onStopInteraction,
}) => {
  const streamingIds = useInteractionStore(
    useShallow((state) => new Set(state.streamingInteractionIds)),
  );

  // Group interactions by index to handle potential revisions/regenerations
  const groupedInteractions = interactions.reduce(
    (acc, i) => {
      // Only group user_assistant messages for display
      if (i.type === "message.user_assistant") {
        const indexKey = i.index ?? -1;
        (acc[indexKey] = acc[indexKey] || []).push(i);
      }
      return acc;
    },
    {} as Record<string | number, Interaction[]>,
  );

  // Sort indices numerically
  const sortedIndices = Object.keys(groupedInteractions)
    .map(Number)
    .filter((n) => !isNaN(n) && n >= 0)
    .sort((a, b) => a - b);

  return (
    <div className={cn(className)}>
      {sortedIndices.map((index) => {
        const group = groupedInteractions[index] || [];

        // Find the latest interaction within the group (for revisions)
        const latestInteraction = group.sort(
          (a, b) =>
            (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
        )[0];

        // If no interaction found for this index (shouldn't happen with grouping logic), skip
        if (!latestInteraction) {
          return null;
        }

        return (
          <React.Fragment key={`${index}-${latestInteraction.id}`}>
            {/* Render User Prompt Display using the prompt from the latest interaction */}
            {latestInteraction.prompt && (
              <UserPromptDisplay interaction={latestInteraction} />
            )}

            {/* Render Assistant Response Card (Streaming or Completed) */}
            {/* Only render assistant card if it's not just a user prompt OR if it's streaming */}
            {(latestInteraction.response !== null ||
              latestInteraction.status === "STREAMING") &&
              (streamingIds.has(latestInteraction.id) ? (
                <StreamingInteractionCard
                  interactionId={latestInteraction.id}
                  onStop={onStopInteraction!}
                />
              ) : (
                <InteractionCard
                  interaction={latestInteraction}
                  allInteractionsInGroup={group} // Pass the whole group for revision handling
                  onRegenerate={onRegenerateInteraction}
                />
              ))}
          </React.Fragment>
        );
      })}

      {/* Loading/Empty States */}
      {status === "loading" && (
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      )}
      {interactions.length === 0 && status === "idle" && !conversationId && (
        <div className="p-4 text-center text-muted-foreground">
          Select or start a new conversation.
        </div>
      )}
      {interactions.length === 0 && status === "idle" && conversationId && (
        <div className="p-4 text-center text-muted-foreground">
          Send a message to start chatting.
        </div>
      )}
    </div>
  );
};
