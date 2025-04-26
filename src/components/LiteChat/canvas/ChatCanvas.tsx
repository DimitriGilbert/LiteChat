// src/components/LiteChat/canvas/ChatCanvas.tsx
import React from "react";
import type { Interaction } from "@/types/litechat/interaction";
import type { ChatCanvasProps } from "@/types/litechat/chat";
import { cn } from "@/lib/utils";
import { InteractionCard } from "./InteractionCard"; // Keep this for assistant
import { UserPromptDisplay } from "./UserPromptDisplay"; // Import user display

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  // interactionRenderer is now specifically for assistant responses
  // streamingInteractionsRenderer remains for streaming assistant responses
  streamingInteractionsRenderer,
  status,
  className,
  onRegenerateInteraction, // Pass this down
}) => {
  const streamingIds = interactions
    .filter((i) => i.status === "STREAMING")
    .map((i) => i.id);

  // Group interactions by index to handle revisions and user/assistant pairs
  const groupedInteractions = interactions.reduce(
    (acc, i) => {
      const indexKey = i.index ?? -1; // Use -1 for interactions without an index (shouldn't happen)
      (acc[indexKey] = acc[indexKey] || []).push(i);
      return acc;
    },
    {} as Record<string | number, Interaction[]>,
  );

  // Sort indices numerically
  const sortedIndices = Object.keys(groupedInteractions)
    .map(Number)
    .filter((n) => !isNaN(n) && n >= 0) // Filter out invalid indices
    .sort((a, b) => a - b);

  return (
    <div className={cn(className)}>
      {sortedIndices.map((index) => {
        const group = groupedInteractions[index] || [];

        // Find the user interaction for this index (should be only one)
        const userInteraction = group.find(
          (i) => i.type === "message.user_assistant" && i.prompt !== null,
        );

        // Find the latest completed assistant interaction for this index
        const latestAssistantInteraction = group
          .filter(
            (i) =>
              i.type === "message.user_assistant" &&
              i.response !== null && // It's an assistant response
              i.status !== "STREAMING", // Not currently streaming
          )
          .sort(
            (a, b) =>
              (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
          )[0]; // Get the latest one

        return (
          <React.Fragment key={index}>
            {/* Render User Prompt */}
            {userInteraction && (
              <UserPromptDisplay interaction={userInteraction} />
            )}
            {/* Render Assistant Response Card (if it exists) */}
            {latestAssistantInteraction && (
              <InteractionCard
                interaction={latestAssistantInteraction}
                allInteractionsInGroup={group} // Pass the whole group for revision handling
                onRegenerate={onRegenerateInteraction}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Render Streaming Assistant Responses */}
      {streamingInteractionsRenderer &&
        streamingIds.length > 0 &&
        streamingInteractionsRenderer(streamingIds)}

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
