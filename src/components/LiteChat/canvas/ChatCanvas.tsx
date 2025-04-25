import React from "react";
import type { ChatCanvasProps, Interaction } from "@/types/litechat/chat";

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  interactionRenderer,
  streamingInteractionsRenderer,
  status,
  className,
}) => {
  const streamingIds = interactions
    .filter((i) => i.status === "STREAMING")
    .map((i) => i.id);
  const groupedInteractions = interactions.reduce(
    (acc, i) => {
      (acc[i.index] = acc[i.index] || []).push(i);
      return acc;
    },
    {} as Record<number, Interaction[]>,
  );
  const sortedIndices = Object.keys(groupedInteractions)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className={className}>
      {sortedIndices.map((index) => {
        const group = groupedInteractions[index];
        const latest = group
          .filter((i) => i.status !== "STREAMING")
          .sort(
            (a, b) =>
              (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
          )[0];
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
          Select/start conversation.
        </div>
      )}
      {interactions.length === 0 && status === "idle" && conversationId && (
        <div className="p-4 text-center text-muted-foreground">
          Send message.
        </div>
      )}
    </div>
  );
};
