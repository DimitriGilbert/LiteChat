// src/components/LiteChat/canvas/ChatCanvas.tsx
// FULL FILE
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
import { EmptyStateReady } from "./empty-states/EmptyStateReady";
import { EmptyStateSetup } from "./empty-states/EmptyStateSetup";
import { useProviderStore } from "@/store/provider.store";
import { useConversationStore } from "@/store/conversation.store"; // Import ConversationStore
import { useProjectStore } from "@/store/project.store"; // Import ProjectStore
import { useShallow } from "zustand/react/shallow";

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

  // --- State for Setup Check ---
  const { isLoading: isProviderLoading } = useProviderStore(
    useShallow((state) => ({
      providers: state.dbProviderConfigs,
      apiKeys: state.dbApiKeys,
      isLoading: state.isLoading,
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );

  // Get conversation and project counts
  const { conversationCount, isConversationLoading } = useConversationStore(
    useShallow((state) => ({
      conversationCount: state.conversations.length,
      isConversationLoading: state.isLoading,
    })),
  );
  const { projectCount, isProjectLoading } = useProjectStore(
    useShallow((state) => ({
      projectCount: state.projects.length,
      isProjectLoading: state.isLoading,
    })),
  );

  // --- Determine if initial setup state should be shown ---
  const showSetupState = useMemo(() => {
    // Don't show setup if core data is still loading
    if (isProviderLoading || isConversationLoading || isProjectLoading) {
      return false;
    }
    // Show setup if there are no conversations AND no projects
    return conversationCount === 0 && projectCount === 0;
  }, [
    conversationCount,
    projectCount,
    isProviderLoading,
    isConversationLoading,
    isProjectLoading,
  ]);
  // --- End Setup Status ---

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
    handleScroll();

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
    // Show loading if any core data is loading
    if (isProviderLoading || isConversationLoading || isProjectLoading) {
      return (
        <div className="space-y-4 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    // Show setup guide if no conversations or projects exist yet
    if (showSetupState) {
      return <EmptyStateSetup />;
    }

    // If setup is done (or skipped), but no conversation is selected, show ready state
    if (!conversationId) {
      return <EmptyStateReady />;
    }

    // Render conversation content if conversationId exists
    if (conversationId) {
      if (interactions.length === 0 && status !== "streaming") {
        // Show ready state even if conversation selected but has no messages
        return <EmptyStateReady />;
      }

      return (
        <div className="space-y-4 p-4">
          {interactionGroups.map((group) => {
            const interaction = group[0];
            const isStreaming = streamingInteractionIds.includes(
              interaction.id,
            );

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
                  onDelete={undefined} // Delete is handled internally now
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
    }

    // Fallback (shouldn't be reached with the above logic)
    return null;
  };

  return (
    <div className={cn("flex-grow relative", className)}>
      <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
        {renderContent()}
      </ScrollArea>
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
