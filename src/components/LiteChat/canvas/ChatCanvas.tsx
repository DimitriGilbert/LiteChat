// src/components/LiteChat/canvas/ChatCanvas.tsx
import React from "react";
import type { Interaction } from "@/types/litechat/interaction";
import type { ChatCanvasProps } from "@/types/litechat/chat";
import { cn } from "@/lib/utils"; // Import cn

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  interactionRenderer,
  streamingInteractionsRenderer,
  status,
  className,
  // Add default empty functions for optional props if needed
  // onRegenerateInteraction = () => {},
  // onEditInteraction = () => {},
}) => {
  // Filter interactions to get IDs of those currently streaming
  const streamingIds = interactions
    .filter((i) => i.status === "STREAMING")
    .map((i) => i.id);

  // Group interactions by their index property
  const groupedInteractions = interactions.reduce(
    (acc, i) => {
      // Ensure index exists and is treated as a number/string key
      const indexKey = i.index ?? -1; // Handle potential null/undefined index
      (acc[indexKey] = acc[indexKey] || []).push(i);
      return acc;
    },
    {} as Record<string | number, Interaction[]>, // Allow string or number keys
  );

  // Get sorted indices (ensure they are numbers for sorting)
  const sortedIndices = Object.keys(groupedInteractions)
    .map(Number) // Convert keys to numbers
    .filter((n) => !isNaN(n)) // Filter out potential NaN from conversion
    .sort((a, b) => a - b); // Sort numerically

  return (
    <div className={cn(className)}>
      {/* Render non-streaming interactions */}
      {sortedIndices.map((index) => {
        const group = groupedInteractions[index];
        // Find the latest interaction in the group that is NOT streaming
        const latest = group
          .filter((i) => i.status !== "STREAMING")
          .sort(
            (a, b) =>
              (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
          )[0]; // Get the most recent one based on startedAt

        // Call the interactionRenderer prop with the latest interaction and the full list
        return latest ? interactionRenderer(latest, interactions) : null;
      })}

      {/* Render streaming interactions if the renderer exists and there are streaming IDs */}
      {streamingInteractionsRenderer &&
        streamingIds.length > 0 &&
        streamingInteractionsRenderer(streamingIds)}

      {/* Display loading state */}
      {status === "loading" && (
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      )}

      {/* Display empty states */}
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
