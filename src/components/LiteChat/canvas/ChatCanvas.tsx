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
import { ArrowDownIcon, PlayIcon, PauseIcon } from "lucide-react";
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
import { useTranslation } from "react-i18next";

const ChatCanvasHiddenInteractions = ["conversation.title_generation", "conversation.compact"];

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
  const lastUserScrollTimeRef = useRef<number>(0);
  const isAutoScrollingRef = useRef<boolean>(false);
  const lastConversationIdRef = useRef<string | null>(null);
  const hasScrolledForConversationRef = useRef<boolean>(false);

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

  const setEnableAutoScrollOnStream = useSettingsStore((state) => state.setEnableAutoScrollOnStream);

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
      const filteredControls = canvasControls.filter((c) => {
        const typeMatch = c.type === targetType;
        const slotMatch = c.targetSlot === targetSlotName;
        const rendererExists = !!c.renderer;
        return typeMatch && slotMatch && rendererExists;
      });

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
              scrollViewport: viewportRef.current,
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

  // SIMPLIFIED SCROLL FUNCTION - ONLY USED IN 4 SPECIFIC CASES
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!viewportRef.current) return;
    
    isAutoScrollingRef.current = true;
    
    viewportRef.current.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: behavior,
    });
    
    setTimeout(() => { 
      isAutoScrollingRef.current = false;
    }, 100);
  }, []);

  // 1. SCROLL ON CONVERSATION LOAD - When conversation changes, reset scroll flag
  useEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      lastConversationIdRef.current = conversationId;
      hasScrolledForConversationRef.current = false; // Reset for new conversation
    }
  }, [conversationId]);

  // 2. SCROLL WHEN MESSAGES MOUNT - Simple MutationObserver approach
  useEffect(() => {
    if (!viewportRef.current || !conversationId || hasScrolledForConversationRef.current) return;
    
    const observer = new MutationObserver((mutations) => {
      // Check if any interaction cards were added
      const hasInteractionCards = mutations.some(mutation => 
        Array.from(mutation.addedNodes).some(node => 
          node instanceof Element && 
          (node.querySelector('[data-interaction-id]') || node.hasAttribute('data-interaction-id'))
        )
      );
      
      if (hasInteractionCards && !hasScrolledForConversationRef.current) {
        const timeSinceUserScroll = Date.now() - lastUserScrollTimeRef.current;
        const userRecentlyScrolled = timeSinceUserScroll < 2000;
        
        if (!userRecentlyScrolled) {
          requestAnimationFrame(() => {
            scrollToBottom("auto");
            hasScrolledForConversationRef.current = true;
          });
        }
      }
    });

    observer.observe(viewportRef.current, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [conversationId, scrollToBottom]);

  // 3. AUTO FOLLOW DURING STREAMING - Every N ms when streaming
  useEffect(() => {
    if (status === "streaming" && enableAutoScrollOnStream) {
      if (autoScrollIntervalTimerRef.current) {
        clearInterval(autoScrollIntervalTimerRef.current);
      }
      autoScrollIntervalTimerRef.current = setInterval(() => {
        const timeSinceUserScroll = Date.now() - lastUserScrollTimeRef.current;
        const userRecentlyScrolled = timeSinceUserScroll < 2000;
        
        const isToCScrolling = viewportRef.current && (viewportRef.current as any)._isToCScrolling;
                
        if (!userRecentlyScrolled && !isToCScrolling) {
          scrollToBottom("smooth");
        }
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
  }, [status, autoScrollInterval, enableAutoScrollOnStream, scrollToBottom]);

  // SCROLL TRACKING - Detect user scroll vs auto scroll
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    
    const handleScroll = () => {
      if (!viewportRef.current) return;
      
      // Track user scrolling (not auto-scroll, not ToC scroll, and not codeblock button interactions)
      const isToCScrolling = (viewportRef.current as any)._isToCScrolling;
      const isCodeblockButtonInteraction = (viewportRef.current as any)._isCodeblockButtonInteraction;
      if (!isAutoScrollingRef.current && !isToCScrolling && !isCodeblockButtonInteraction) {
        lastUserScrollTimeRef.current = Date.now();
      } 
      
      const { scrollHeight, clientHeight, scrollTop } = viewportRef.current;
      const shouldShow =
        scrollTop < scrollHeight - clientHeight - clientHeight * 0.5;
      setShowJumpToBottom(shouldShow);
    };
    
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => {
      if (viewportRef.current) {
        viewportRef.current.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  // VIEWPORT SETUP
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLDivElement | null;
      if (viewport) {
        viewportRef.current = viewport;
      }
    }
  }, []);

  const renderedInteractionCards = useMemo(() => {
    const elements: React.ReactNode[] = [];

    const allSortedInteractions = [...interactions].sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      if (a.parentId === null && b.parentId !== null) return -1;
      if (a.parentId !== null && b.parentId === null) return 1;
      if (a.parentId !== null && b.parentId !== null && a.parentId === b.parentId) {
        return a.index - b.index;
      }
      return (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0);
    });

    const activeInteractionsOnSpine = allSortedInteractions.filter(
      i => i.parentId === null && !ChatCanvasHiddenInteractions.includes(i.type)
    );

    activeInteractionsOnSpine.forEach(activeInteraction => {
      let userPromptToDisplay: PromptTurnObject | null = null;
      
      if (activeInteraction.type === "message.user_assistant" && activeInteraction.prompt) {
        userPromptToDisplay = activeInteraction.prompt;
      } else if (activeInteraction.type === "message.workflow_step" && activeInteraction.prompt) {
        userPromptToDisplay = activeInteraction.prompt;
      } else if (activeInteraction.type === "message.assistant_regen" && activeInteraction.metadata?.regeneratedFromId) {
        let promptProviderInteraction: Interaction | undefined = undefined;
        let currentForPromptLookup: Interaction | undefined = activeInteraction;
        const visitedInLookup = new Set<string>();

        while(currentForPromptLookup && !visitedInLookup.has(currentForPromptLookup.id)) {
            visitedInLookup.add(currentForPromptLookup.id);
            if (currentForPromptLookup.type === "message.user_assistant" && currentForPromptLookup.prompt) {
                promptProviderInteraction = currentForPromptLookup;
                break;
            }
            if (currentForPromptLookup.metadata?.regeneratedFromId) {
                currentForPromptLookup = interactions.find(i => i.id === currentForPromptLookup!.metadata!.regeneratedFromId);
            } else {
                break;
            }
        }

        if (promptProviderInteraction) {
            userPromptToDisplay = promptProviderInteraction.prompt;
        } else {
            if (activeInteraction.prompt) { 
                userPromptToDisplay = activeInteraction.prompt;
            } else {
                console.warn(`[ChatCanvas] Could not reliably find user prompt for active interaction ${activeInteraction.id} of type ${activeInteraction.type}. Displaying turn without prompt.`);
            }
        }
      }

      if (userPromptToDisplay) {
        elements.push(
          <UserPromptDisplay
            key={`prompt-${activeInteraction.id}`}
            turnData={userPromptToDisplay}
            timestamp={activeInteraction.startedAt}
            isAssistantComplete={activeInteraction.status === "COMPLETED" || activeInteraction.status === "ERROR"}
            interactionId={activeInteraction.id}
          />
        );
      } else if (activeInteraction.type !== "message.user_assistant" && activeInteraction.type !== "message.assistant_regen" && activeInteraction.type !== "message.workflow_step") {
        console.log("[ChatCanvas] Skipping active interaction on spine due to no user prompt and non-standard type:", activeInteraction.id, activeInteraction.type);
        return;
      }

      const historicalVersions = interactions 
        .filter(hist => hist.parentId === activeInteraction.id && 
                       !ChatCanvasHiddenInteractions.includes(hist.type))
        .sort((a, b) => a.index - b.index); 

      const interactionGroupForTabs = [activeInteraction, ...historicalVersions];
      
      if (interactionGroupForTabs.length > 0) {
         elements.push(
          <ResponseTabsContainer
            key={`tabs-${activeInteraction.id}`}
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

  const { t } = useTranslation('canvas');
  const maxWidthClass = chatMaxWidth || "max-w-7xl";

  return (
    <div className={cn("flex-grow relative", className)}>
      {showSetupState ? (
        <ScrollArea className="h-full w-full">
          <div className={cn("mx-auto w-full", maxWidthClass)}>
            <EmptyStateSetup />
          </div>
        </ScrollArea>
      ) : (
        <>
          <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
            <div className={cn("mx-auto w-full", maxWidthClass)}>
              {renderContent()}
            </div>
          </ScrollArea>
          {/* 3. SCROLL TO BOTTOM BUTTON - When clicked */}
          {showJumpToBottom && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute bottom-4 right-4 z-[var(--z-sticky)] h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur-sm hover:bg-muted"
                    onClick={() => scrollToBottom()}
                    aria-label="Scroll to bottom"
                  >
                    <ArrowDownIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">{t('jumpToBottom', 'Jump to bottom')}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Follow Stream Toggle Button - only show when streaming */}
          {status === "streaming" && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute bottom-4 right-14 z-[var(--z-sticky)] h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur-sm hover:bg-muted"
                    onClick={() => setEnableAutoScrollOnStream(!enableAutoScrollOnStream)}
                    aria-label={enableAutoScrollOnStream ? "Disable follow stream" : "Enable follow stream"}
                  >
                    {enableAutoScrollOnStream ? (
                      <PauseIcon className="h-4 w-4" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {enableAutoScrollOnStream 
                    ? t('pauseAutoScroll', 'Stop Following Stream') 
                    : t('resumeAutoScroll', 'Follow Stream')}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}
    </div>
  );
};

export const ChatCanvas = React.memo(ChatCanvasComponent);
