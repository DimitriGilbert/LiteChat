// src/components/LiteChat/canvas/ChatCanvas.tsx
import React from "react";
import type { Interaction } from "@/types/litechat/interaction";
import type { ChatCanvasProps } from "@/types/litechat/chat";
import { cn } from "@/lib/utils";

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  interactionRenderer,
  streamingInteractionsRenderer,
  status,
  className,
  // Add default empty functions for optional props if needed
  // onRegenerateInteraction = () => {}, // Keep if needed by interactionRenderer
  // onEditInteraction = () => {}, // Keep if needed by interactionRenderer
}) => {
  const streamingIds = interactions
    .filter((i) => i.status === "STREAMING")
    .map((i) => i.id);

  const groupedInteractions = interactions.reduce(
    (acc, i) => {
      const indexKey = i.index ?? -1;
      (acc[indexKey] = acc[indexKey] || []).push(i);
      return acc;
    },
    {} as Record<string | number, Interaction[]>,
  );

  const sortedIndices = Object.keys(groupedInteractions)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  return (
    <div className={cn(className)}>
      {sortedIndices.map((index) => {
        const group = groupedInteractions[index];
        const latest = group
          .filter((i) => i.status !== "STREAMING")
          .sort(
            (a, b) =>
              (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
          )[0];

        // Pass the full interactions list to the renderer
        return latest ? interactionRenderer(latest, interactions) : null;
      })}

      {streamingInteractionsRenderer &&
        streamingIds.length > 0 &&
        streamingInteractionsRenderer(streamingIds)}

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
