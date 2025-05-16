// src/components/LiteChat/canvas/ChatCanvas.tsx
// FULL FILE
import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
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
import { useSettingsStore } from "@/store/settings.store";
import { useControlRegistryStore } from "@/store/control.store";
import type {
  CanvasControl,
  CanvasControlRenderContext,
} from "@/types/litechat/canvas/control";

const ChatCanvasHiddenInteractions = ["conversation.title_generation"];

export interface ChatCanvasProps {
  conversationId: string | null;
  interactions: Interaction[];
  status: "idle" | "loading" | "streaming" | "error";
  className?: string;
}

const ChatCanvasComponent: React.FC<ChatCanvasProps> = ({
  conversationId,
  interactions,
  status,
  className,
}) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const autoScrollIntervalTimerRef = useRef<NodeJS.Timeout | null>(null);

  const streamingInteractionIds = useInteractionStore(
    (state) => state.streamingInteractionIds
  );

  const { chatMaxWidth, autoScrollInterval, enableAutoScrollOnStream } =
    useSettingsStore(
      useShallow((state) => ({
        chatMaxWidth: state.chatMaxWidth,
        autoScrollInterval: state.autoScrollInterval,
        enableAutoScrollOnStream: state.enableAutoScrollOnStream,
      }))
    );

  const selectProviderState = useMemo(
    () => (state: ReturnType<typeof useProviderStore.getState>) => ({
      isLoading: state.isLoading,
    }),
    []
  );

  const selectConversationState = useMemo(
    () => (state: ReturnType<typeof useConversationStore.getState>) => ({
      conversationCount: state.conversations.length,
      isConversationLoading: state.isLoading,
    }),
    []
  );

  const { isLoading: isProviderLoading } = useProviderStore(
    useShallow(selectProviderState)
  );
  const { conversationCount, isConversationLoading } = useConversationStore(
    useShallow(selectConversationState)
  );

  const { projectCount, isProjectLoading } = useProjectStore(
    useShallow((state) => ({
      projectCount: state.projects.length,
      isProjectLoading: state.isLoading,
    }))
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
      (a, b) => a.index - b.index
    );
    sortedInteractions.forEach((interaction) => {
      if (processedIds.has(interaction.id)) return;
      if (!ChatCanvasHiddenInteractions.includes(interaction.type)) {
        const group = [interaction];
        processedIds.add(interaction.id);
        groups.push(group);
      }
    });
    return groups;
  }, [interactions]);

  const canvasControls = useControlRegistryStore(
    useShallow((state) => Object.values(state.canvasControls))
  );

  const renderSlotForCanvas = useCallback(
    (
      targetType: CanvasControl["type"],
      targetSlotName: CanvasControl["targetSlot"],
      contextInteraction?: Interaction
    ): React.ReactNode[] => {
      // console.log(
      //   `[ChatCanvas] renderSlotForCanvas attempting to render: type='${targetType}', slot='${targetSlotName}'`
      // );
      // if (!canvasControls || canvasControls.length === 0) {
      //   console.warn("[ChatCanvas] No canvas controls are registered in the store!");
      // } else {
      //   // Log details of all available canvas controls for debugging
      //   const controlDetails = canvasControls.map(c => ({ id: c.id, type: c.type, targetSlot: c.targetSlot, hasRenderer: !!c.renderer }));
      //   console.log("[ChatCanvas] Available canvasControls:", JSON.stringify(controlDetails, null, 2));
      // }

      const filteredControls = canvasControls.filter((c) => {
        const typeMatch = c.type === targetType;
        const slotMatch = c.targetSlot === targetSlotName;
        const rendererExists = !!c.renderer;
        // if (c.id.includes("copy") || c.id.includes("regenerate") || c.id.includes("rating")) {
        //     console.log(`[ChatCanvas] Filtering control '${c.id}': typeMatch=${typeMatch} (expected ${targetType}), slotMatch=${slotMatch} (expected ${targetSlotName}), rendererExists=${rendererExists}`);
        // }
        return typeMatch && slotMatch && rendererExists;
      });

      // if (filteredControls.length === 0) {
      //   console.warn(
      //     `[ChatCanvas] No controls found after filtering for: type='${targetType}', slot='${targetSlotName}'`
      //   );
      // }

      return filteredControls
        .map((control) => {
          if (control.renderer) {
            const context: CanvasControlRenderContext = {
              interaction: contextInteraction,
              interactionId: contextInteraction?.id,
              responseContent:
                typeof contextInteraction?.response === "string"
                  ? contextInteraction.response
                  : undefined,
              canvasContextType: targetType, 
            };
            return (
              <React.Fragment key={control.id}>
                {control.renderer(context)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean);
    },
    [canvasControls]
  );

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

      if (isAtBottom || status !== "streaming") {
        requestAnimationFrame(() => {
          scrollToBottom(status === "streaming" ? "smooth" : "auto");
        });
      }
    }
  }, [interactionGroups.length, status]);

  useEffect(() => {
    if (status === "streaming" && enableAutoScrollOnStream) {
      if (autoScrollIntervalTimerRef.current) {
        clearInterval(autoScrollIntervalTimerRef.current);
      }
      autoScrollIntervalTimerRef.current = setInterval(() => {
        scrollToBottom("smooth");
      }, autoScrollInterval);
    } else {
      if (autoScrollIntervalTimerRef.current) {
        clearInterval(autoScrollIntervalTimerRef.current);
        autoScrollIntervalTimerRef.current = null;
      }
    }
    return () => {
      if (autoScrollIntervalTimerRef.current) {
        clearInterval(autoScrollIntervalTimerRef.current);
      }
    };
  }, [status, autoScrollInterval, enableAutoScrollOnStream]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleScroll = () => {
      if (!viewportRef.current) return; // Add null check for viewportRef.current
      const { scrollHeight, clientHeight, scrollTop } = viewportRef.current;
      const shouldShow =
        scrollTop < scrollHeight - clientHeight - clientHeight * 0.5;
      setShowJumpToBottom(shouldShow);
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => {
      if (viewportRef.current) {
        // Add null check before removing listener
        viewportRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, []); // Removed viewportRef.current from dependencies to avoid re-running on every render

  useEffect(() => {
    if (scrollAreaRef.current) {
      viewportRef.current = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
    }
  }, []);

  const renderedInteractionCards = useMemo(() => {
    return interactionGroups.map((group) => {
      const interaction = group[0];
      const isStreamingInteraction = streamingInteractionIds.includes(
        interaction.id
      );

      if (isStreamingInteraction) {
        return (
          <StreamingInteractionCard
            key={`${interaction.id}-streaming`}
            interactionId={interaction.id}
            renderSlot={(slotName) =>
              renderSlotForCanvas(
                "interaction",
                slotName as CanvasControl["targetSlot"],
                interaction
              )
            }
          />
        );
      } else {
        return (
          <InteractionCard
            key={interaction.id}
            interaction={interaction}
            renderSlot={(slotName) =>
              renderSlotForCanvas(
                "interaction",
                slotName as CanvasControl["targetSlot"],
                interaction
              )
            }
          />
        );
      }
    });
  }, [interactionGroups, streamingInteractionIds, renderSlotForCanvas]);

  const renderContent = () => {
    if (isProviderLoading || isConversationLoading || isProjectLoading) {
      return (
        <div className="space-y-4 p-2 md:p-4">
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

    if (
      interactionGroups.length === 0 &&
      status !== "streaming" &&
      streamingInteractionIds.length === 0
    ) {
      return <EmptyStateReady />;
    }

    return (
      <div className="space-y-4 p-2 md:p-4 break-words">
        {renderedInteractionCards}
        {status === "streaming" &&
          streamingInteractionIds
            .filter((id) => !interactions.some((i) => i.id === id))
            .map((id) => (
              <StreamingInteractionCard
                key={`${id}-streaming-new`}
                interactionId={id}
                renderSlot={(slotName) =>
                  renderSlotForCanvas(
                    "interaction",
                    slotName as CanvasControl["targetSlot"]
                  )
                }
              />
            ))}
      </div>
    );
  };

  const maxWidthClass = chatMaxWidth || "max-w-7xl";

  return (
    <div className={cn("flex-grow relative", className)}>
      <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
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

export const ChatCanvas = React.memo(ChatCanvasComponent);
