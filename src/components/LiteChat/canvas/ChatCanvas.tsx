// src/components/LiteChat/canvas/ChatCanvas.tsx
import React, { useRef, useState, useEffect, useCallback } from "react"; // Added refs/state/effect/callback
import type { Interaction } from "@/types/litechat/interaction";
import type { ChatCanvasProps } from "@/types/litechat/chat";
import { cn } from "@/lib/utils";
import { InteractionCard } from "./InteractionCard";
import { UserPromptDisplay } from "./UserPromptDisplay";
import { StreamingInteractionCard } from "./StreamingInteractionCard";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { Button } from "@/components/ui/button"; // Import Button
import { ArrowDownIcon } from "lucide-react"; // Import Icon

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  status,
  className,
  onRegenerateInteraction,
  onStopInteraction,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container
  const [showScrollButton, setShowScrollButton] = useState(false); // State for button visibility

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

  // Function to scroll to the bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: behavior,
      });
    }
  }, []);

  // Effect to scroll to bottom when new interactions are added or streaming starts/ends
  // Only auto-scroll if user is already near the bottom
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      const isNearBottom =
        scrollElement.scrollHeight -
          scrollElement.scrollTop -
          scrollElement.clientHeight <
        150; // Threshold

      if (isNearBottom) {
        scrollToBottom("smooth");
      }
    }
    // Depend on interactions length and status to trigger scroll check
  }, [interactions.length, status, scrollToBottom]);

  // Effect to handle scroll button visibility
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleScroll = () => {
      const isNearBottom =
        scrollElement.scrollHeight -
          scrollElement.scrollTop -
          scrollElement.clientHeight <
        150;
      setShowScrollButton(!isNearBottom);
    };

    scrollElement.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check

    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    // Added relative positioning for the button
    <div className={cn("relative", className)}>
      {/* Scrollable container */}
      <div ref={scrollRef} className="h-full overflow-y-auto pr-2">
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
          <div className="p-4 space-y-4">
            <Skeleton className="h-16 w-3/4 ml-auto rounded-md" />
            <Skeleton className="h-12 w-3/4 mr-auto rounded-md" />
            <Skeleton className="h-16 w-3/4 ml-auto rounded-md" />
            <Skeleton className="h-12 w-3/4 mr-auto rounded-md" />
          </div>
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

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <Button
          variant="outline"
          size="icon"
          className="absolute bottom-4 right-4 h-10 w-10 rounded-full shadow-lg bg-card/80 backdrop-blur-sm hover:bg-muted"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Scroll to bottom"
        >
          <ArrowDownIcon className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};
