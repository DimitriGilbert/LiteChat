// src/components/LiteChat/canvas/ChatCanvas.tsx
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
import { useConversationStore } from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { useShallow } from "zustand/react/shallow";
// Import settings store to get max width
import { useSettingsStore } from "@/store/settings.store";

const ChatCanvasHiddenInteractions = ["conversation.title_generation"];

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
  // Get chatMaxWidth from settings store
  const chatMaxWidth = useSettingsStore((state) => state.chatMaxWidth);

  const { isLoading: isProviderLoading } = useProviderStore(
    useShallow((state) => ({
      providers: state.dbProviderConfigs,
      apiKeys: state.dbApiKeys,
      isLoading: state.isLoading,
      enableApiKeyManagement: state.enableApiKeyManagement,
    })),
  );

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

  const showSetupState = useMemo(() => {
    if (isProviderLoading || isConversationLoading || isProjectLoading) {
      return false;
    }
    return conversationCount === 0 && projectCount === 0;
  }, [
    conversationCount,
    projectCount,
    isProviderLoading,
    isConversationLoading,
    isProjectLoading,
  ]);

  const interactionGroups = useMemo(() => {
    const groups: Interaction[][] = [];
    const processedIds = new Set<string>();
    const sortedInteractions = [...interactions].sort(
      (a, b) => a.index - b.index,
    );
    sortedInteractions.forEach((interaction) => {
      if (processedIds.has(interaction.id)) return;
      // Filter out hidden types before grouping or processing
      if (!ChatCanvasHiddenInteractions.includes(interaction.type)) {
        const group = [interaction];
        processedIds.add(interaction.id);
        groups.push(group);
      }
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
        // Use requestAnimationFrame to ensure scroll happens after render updates
        requestAnimationFrame(() => {
          scrollToBottom(isStreamingJustStarted ? "smooth" : "auto");
        });
      }
    }
    // Depend on interactionGroups length to scroll when new messages appear
  }, [interactionGroups.length, status, streamingInteractionIds]);

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
  }, []); // Run only once

  useEffect(() => {
    // Find the viewport element once the ScrollArea is mounted
    if (scrollAreaRef.current) {
      viewportRef.current = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
    }
  }, []); // Run only once

  const renderContent = () => {
    if (isProviderLoading || isConversationLoading || isProjectLoading) {
      return (
        <div className="space-y-4 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    if (showSetupState) {
      return <EmptyStateSetup />;
    }

    if (!conversationId) {
      return <EmptyStateReady />;
    }

    // Check interactionGroups length for empty state after filtering
    if (interactionGroups.length === 0 && status !== "streaming") {
      return <EmptyStateReady />;
    }

    // --- USING THE CORRECTED RENDER LOGIC ---
    return (
      <div className="space-y-4 p-4">
        {interactionGroups.map((group) => {
          const interaction = group[0];
          const isStreaming = streamingInteractionIds.includes(interaction.id);
          // The check for hidden interactions is already done in interactionGroups memo
          if (isStreaming) {
            return (
              <StreamingInteractionCard
                key={`${interaction.id}-streaming`}
                interactionId={interaction.id} // Pass ID
                onStop={onStopInteraction} // Pass correct prop name
              />
            );
          } else {
            return (
              <InteractionCard
                key={interaction.id}
                interaction={interaction}
                onEdit={onEditInteraction} // Pass correct prop name
                onRegenerate={onRegenerateInteraction} // Pass correct prop name
                onDelete={undefined} // Pass undefined as per working code
              />
            );
          }
        })}
        {/* Render placeholder for new streaming interactions */}
        {status === "streaming" &&
          streamingInteractionIds
            .filter((id) => !interactions.some((i) => i.id === id))
            .map((id) => (
              <StreamingInteractionCard
                key={`${id}-streaming-new`}
                interactionId={id} // Pass ID
                onStop={onStopInteraction} // Pass correct prop name
              />
            ))}
      </div>
    );
    // --- END CORRECTED RENDER LOGIC ---
  };

  // Determine the max-width class, defaulting if null
  const maxWidthClass = chatMaxWidth || "max-w-7xl";

  return (
    <div className={cn("flex-grow relative", className)}>
      <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
        {/* Apply max-width and centering to the content container */}
        <div className={cn("chat-canvas-container mx-auto", maxWidthClass)}>
          {renderContent()}
        </div>
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
