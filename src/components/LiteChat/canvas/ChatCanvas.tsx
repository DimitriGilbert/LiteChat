// src/components/LiteChat/canvas/ChatCanvas.tsx
// Entire file content provided
import React, { useMemo, useRef, useEffect, useState } from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { InteractionCard } from "./InteractionCard";
import { StreamingInteractionCard } from "./StreamingInteractionCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useInteractionStore } from "@/store/interaction.store";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowDownIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ChatCanvasProps {
  conversationId: string | null;
  interactions: Interaction[];
  status: "idle" | "loading" | "streaming" | "error";
  className?: string;
  onRegenerateInteraction?: (interactionId: string) => void;
  onEditInteraction?: (interactionId: string) => void;
  onStopInteraction?: (interactionId: string) => void;
}

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  status,
  className,
  onRegenerateInteraction,
  onEditInteraction,
  onStopInteraction,
}) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const streamingInteractionIds = useInteractionStore(
    (state) => state.streamingInteractionIds,
  );

  const interactionGroups = useMemo(() => {
    const groups: Interaction[][] = [];
    const processedIds = new Set<string>();
    const sortedInteractions = [...interactions].sort(
      (a, b) => a.index - b.index,
    );
    sortedInteractions.forEach((interaction) => {
      if (processedIds.has(interaction.id)) return;
      const group = [interaction];
      processedIds.add(interaction.id);
      groups.push(group);
    });
    return groups;
  }, [interactions]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: behavior,
      });
    }
  };

  useEffect(() => {
    if (viewportRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = viewportRef.current;
      const isAtBottom = scrollHeight - clientHeight <= scrollTop + 150;
      const isStreamingJustStarted =
        status === "streaming" && streamingInteractionIds.length > 0;

      if (isAtBottom || isStreamingJustStarted) {
        scrollToBottom(isStreamingJustStarted ? "smooth" : "auto");
      }
    }
  }, [interactions, status, streamingInteractionIds]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollHeight, clientHeight, scrollTop } = viewport;
      const shouldShow =
        scrollTop < scrollHeight - clientHeight - clientHeight * 0.5;
      setShowJumpToBottom(shouldShow);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      viewportRef.current = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
    }
  }, []);

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
          const interaction = group[0];
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
                onEdit={onEditInteraction}
                onRegenerate={onRegenerateInteraction}
              />
            );
          }
        })}
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
    // Reverted: Container is flex-grow and relative, ScrollArea is NOT absolutely positioned
    <div className={cn("flex-grow relative", className)}>
      <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
        {renderContent()}
      </ScrollArea>
      {/* Jump to Bottom Button remains absolutely positioned relative to the container */}
      {showJumpToBottom && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="absolute bottom-4 right-4 z-20 h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur-sm hover:bg-muted"
                onClick={() => scrollToBottom()}
                aria-label="Scroll to bottom"
              >
                <ArrowDownIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Scroll to Bottom</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
