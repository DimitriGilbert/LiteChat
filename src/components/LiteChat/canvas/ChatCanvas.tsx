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
import { StreamingInteractionCard } from "./StreamingInteractionCard";
import { ResponseTabsContainer } from "./ResponseTabsContainer";
import { UserPromptDisplay } from "./UserPromptDisplay";
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
import type { PromptTurnObject } from "@/types/litechat/prompt";

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
    // Filter for active interactions (no parentId) and sort them by their index.
    const activeInteractions = interactions
      .filter((interaction) => interaction.parentId === null && 
                             !ChatCanvasHiddenInteractions.includes(interaction.type))
      .sort((a, b) => a.index - b.index);

    const groups: Interaction[][] = activeInteractions.map((activeInteraction) => {
      // Find all historical versions for this active interaction.
      const historicalVersions = interactions
        .filter((histInteraction) => histInteraction.parentId === activeInteraction.id &&
                                   !ChatCanvasHiddenInteractions.includes(histInteraction.type) // Also filter hidden types here
        )
        .sort((a, b) => a.index - b.index); // Children are sorted by their own index (0, 1, 2...)
      
      return [activeInteraction, ...historicalVersions];
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
      contextInteraction?: Interaction,
      overrideContext?: Partial<CanvasControlRenderContext>
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
            const baseContext: CanvasControlRenderContext = {
              interaction: contextInteraction,
              interactionId: contextInteraction?.id,
              responseContent:
                typeof contextInteraction?.response === "string"
                  ? contextInteraction.response
                  : undefined,
              canvasContextType: targetType,
            };
            const finalContext = { ...baseContext, ...overrideContext };
            
            return (
              <React.Fragment key={control.id}>
                {control.renderer(finalContext)}
              </React.Fragment>
            );
          }
          return null;
        })
        .filter(Boolean) as React.ReactNode[];
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
    // console.log("[ChatCanvas] Full interactions array received by renderedInteractionCards:", JSON.parse(JSON.stringify(interactions))); // Log full interactions array
    const elements: React.ReactNode[] = [];

    const allSortedInteractions = [...interactions].sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index; // Main conversation flow index
      if (a.parentId === null && b.parentId !== null) return -1; // Active (null parentId) comes before children
      if (a.parentId !== null && b.parentId === null) return 1;  // Children after active
      if (a.parentId !== null && b.parentId !== null && a.parentId === b.parentId) {
        return a.index - b.index; // Sort children by their own index under the same parent
      }
      // Fallback sort by time if structure is unusual, or for items at same main index but different parents (should not happen for display groups)
      return (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0);
    });

    // Identify active interactions on the main conversation spine
    const activeInteractionsOnSpine = allSortedInteractions.filter(
      i => i.parentId === null && !ChatCanvasHiddenInteractions.includes(i.type)
    );
    // console.log("[ChatCanvas] Active interactions on spine:", JSON.parse(JSON.stringify(activeInteractionsOnSpine))); // Log active spine interactions

    activeInteractionsOnSpine.forEach(activeInteraction => {
      // console.log("[ChatCanvas] Processing activeInteraction:", JSON.parse(JSON.stringify(activeInteraction))); // Log current active interaction being processed
      let userPromptToDisplay: PromptTurnObject | null = null;
      
      // Determine the user prompt associated with this active interaction (turn)
      if (activeInteraction.type === "message.user_assistant" && activeInteraction.prompt) {
        userPromptToDisplay = activeInteraction.prompt;
      } else if (activeInteraction.type === "message.assistant_regen" && activeInteraction.metadata?.regeneratedFromId) {
        // Find the original user_assistant interaction that this regen chain started from.
        // This original interaction should be a child of the current activeInteraction or one of its ancestors in the regen chain.
        // let originalInteractionForPrompt: Interaction | undefined = interactions.find(
        //   i => i.id === activeInteraction.metadata?.regeneratedFromId
        // );
        // Walk up the chain if `regeneratedFromId` points to another regen.
        // The true original `message.user_assistant` will be the one whose `regeneratedFromId` is the prompt provider.
        // This logic might be complex if the direct `regeneratedFromId` isn't the one with the prompt.
        // A simpler way: the interaction that was regenerated *into* this activeInteraction should hold the original prompt
        // or be part of the chain that leads to it.

        // The `ConversationService.regenerateInteraction` ensures that the `activeInteraction` (a regen)
        // has its `regeneratedFromId` pointing to the interaction it replaced.
        // That replaced interaction (now a child) should be type `message.user_assistant` or another `message.assistant_regen`.
        // We need to find the ultimate `message.user_assistant` at the root of this particular regeneration branch.
        
        let promptProviderInteraction: Interaction | undefined = undefined;
        let currentForPromptLookup: Interaction | undefined = activeInteraction;
        const visitedInLookup = new Set<string>(); // Prevent infinite loops

        while(currentForPromptLookup && !visitedInLookup.has(currentForPromptLookup.id)) {
            visitedInLookup.add(currentForPromptLookup.id);
            if (currentForPromptLookup.type === "message.user_assistant" && currentForPromptLookup.prompt) {
                promptProviderInteraction = currentForPromptLookup;
                break;
            }
            if (currentForPromptLookup.metadata?.regeneratedFromId) {
                currentForPromptLookup = interactions.find(i => i.id === currentForPromptLookup!.metadata!.regeneratedFromId);
            } else {
                // If it's a regen but has no regeneratedFromId, or we hit a dead end.
                break;
            }
        }

        if (promptProviderInteraction) {
            userPromptToDisplay = promptProviderInteraction.prompt;
        } else {
             // Fallback: If this activeInteraction itself has a prompt (e.g. if a user_assistant was directly made parentId:null)
            if (activeInteraction.prompt) { 
                userPromptToDisplay = activeInteraction.prompt;
            } else {
                console.warn(`[ChatCanvas] Could not reliably find user prompt for active interaction ${activeInteraction.id} of type ${activeInteraction.type}. Displaying turn without prompt.`);
            }
        }
      }

      // Only render the turn if we have a user prompt to show
      if (userPromptToDisplay) {
        elements.push(
          <UserPromptDisplay
            key={`prompt-${activeInteraction.id}`} // Keyed with activeInteraction's ID
            turnData={userPromptToDisplay}
            timestamp={activeInteraction.startedAt} // Timestamp from active interaction (latest in turn)
            isAssistantComplete={activeInteraction.status === "COMPLETED" || activeInteraction.status === "ERROR"}
          />
        );
      } else if (activeInteraction.type !== "message.user_assistant" && activeInteraction.type !== "message.assistant_regen") {
        // If it's some other type of active interaction on the spine that doesn't have a typical prompt/response structure, 
        // it might need its own renderer or be skipped. For now, we skip if no prompt found for assistant types.
        // This case should be rare for visible chat messages.
        console.log("[ChatCanvas] Skipping active interaction on spine due to no user prompt and non-standard type:", activeInteraction.id, activeInteraction.type);
        return; // Skip this iteration of forEach
      }

      // Historical versions are direct children of the current activeInteraction on the spine
      const historicalVersions = interactions 
        .filter(hist => hist.parentId === activeInteraction.id && 
                       !ChatCanvasHiddenInteractions.includes(hist.type))
        .sort((a, b) => a.index - b.index); 
      // console.log(`[ChatCanvas] Historical versions found for activeInteraction ${activeInteraction.id}:`, JSON.parse(JSON.stringify(historicalVersions))); // Log historical versions found

      const interactionGroupForTabs = [activeInteraction, ...historicalVersions];
      
      // Only render ResponseTabsContainer if there's an assistant part to show (the activeInteraction itself)
      // or if there are historical versions implying an assistant part existed.
      if (interactionGroupForTabs.length > 0) { // The activeInteraction is always present if we reach here for assistant types
         elements.push(
          <ResponseTabsContainer
            key={`tabs-${activeInteraction.id}`} // CRUCIAL: Keyed by the ID of the *active* interaction for this turn
            interactionGroup={interactionGroupForTabs}
            renderSlot={(slotName, contextInteraction, overrideContext) =>
              renderSlotForCanvas(
                "interaction", 
                slotName,
                contextInteraction,
                overrideContext
              )
            }
            activeStreamingInteractionId={streamingInteractionIds.find(id => interactionGroupForTabs.some(v => v.id === id))}
          />
        );
      }
    });

    return elements;
  }, [interactions, renderSlotForCanvas, streamingInteractionIds]);

  const newStreamingInteractionCards = useMemo(() => {
    return streamingInteractionIds
      .filter((id) => !interactions.some((i) => i.id === id))
      .map((id) => (
        <StreamingInteractionCard
          key={`${id}-streaming-new`}
          interactionId={id}
          renderSlot={(slotName, intFromChild, overrideCtx) =>
            renderSlotForCanvas(
              "interaction",
              slotName as CanvasControl["targetSlot"],
              intFromChild,
              overrideCtx
            )
          }
        />
      ));
  }, [streamingInteractionIds, interactions, renderSlotForCanvas]);

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
        {newStreamingInteractionCards}
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
