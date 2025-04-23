
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MemoizedMessageBubble } from "@/components/lite-chat/message/message-bubble";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowDownCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { throttle } from "@/lib/throttle";
import type { Message, CustomMessageAction } from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";
import { EmptyContent } from "./empty-content";

interface ChatContentProps {
  className?: string;
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  regenerateMessage: (messageId: string) => void;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  modMessageActions: CustomMessageAction[];
  enableStreamingMarkdown: boolean;
  // REMOVED: streamingPortalId?: string;
}

const SCROLL_THRESHOLD = 50;

const ChatContentComponent: React.FC<ChatContentProps> = ({
  className,
  messages,
  isLoadingMessages,
  isStreaming,
  regenerateMessage,
  getContextSnapshotForMod,
  modMessageActions,
  enableStreamingMarkdown,
  // REMOVED: streamingPortalId,
}) => {
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const prevScrollHeightRef = useRef<number | null>(null);
  const userHasScrolledUpRef = useRef(false);
  const isAutoScrollingRef = useRef(false);

  const getViewport = useCallback((): HTMLDivElement | null => {
    if (viewportRef.current) return viewportRef.current;
    const root = scrollAreaRootRef.current;
    if (!root) return null;
    const vp = root.querySelector<HTMLDivElement>(
      "[data-radix-scroll-area-viewport]",
    );
    viewportRef.current = vp;
    return vp;
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth", force: boolean = false) => {
      const viewport = getViewport();
      if (viewport) {
        if (force || !userHasScrolledUpRef.current) {
          isAutoScrollingRef.current = true;
          viewport.scrollTo({ top: viewport.scrollHeight, behavior });
          setShowScrollButton((prev) => (prev === false ? prev : false));
          userHasScrolledUpRef.current = false;
          setTimeout(
            () => {
              isAutoScrollingRef.current = false;
            },
            behavior === "smooth" ? 300 : 50,
          );
        }
      }
    },
    [getViewport],
  );

  const checkScrollPosition = useCallback(() => {
    if (isAutoScrollingRef.current) {
      return;
    }
    const viewport = getViewport();
    if (viewport) {
      const { scrollHeight, scrollTop, clientHeight } = viewport;
      const atBottom =
        scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
      const shouldShowButton = !atBottom;
      setShowScrollButton((prev) =>
        prev === shouldShowButton ? prev : shouldShowButton,
      );
      if (atBottom && userHasScrolledUpRef.current) {
        userHasScrolledUpRef.current = false;
      } else if (!atBottom && !userHasScrolledUpRef.current) {
        userHasScrolledUpRef.current = true;
      }
    }
  }, [getViewport]);

  const { throttled: throttledCheckScrollPosition, cancel: cancelThrottle } =
    throttle(checkScrollPosition, 150);

  useEffect(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.addEventListener("scroll", throttledCheckScrollPosition);
      checkScrollPosition(); // Initial check
      return () => {
        viewport.removeEventListener("scroll", throttledCheckScrollPosition);
        cancelThrottle(); // Cancel any pending throttled calls on cleanup
      };
    }
  }, [
    getViewport,
    throttledCheckScrollPosition,
    checkScrollPosition,
    cancelThrottle,
  ]);

  const messagesLength = messages.length;
  useLayoutEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const currentScrollHeight = viewport.scrollHeight;
    const previousScrollHeight = prevScrollHeightRef.current;

    if (
      !userHasScrolledUpRef.current &&
      (messagesLength > 0 || isLoadingMessages) &&
      previousScrollHeight !== null &&
      currentScrollHeight > previousScrollHeight
    ) {
      requestAnimationFrame(() => {
        scrollToBottom("smooth");
      });
    }
    prevScrollHeightRef.current = currentScrollHeight;
  }, [
    messagesLength,
    isStreaming,
    isLoadingMessages,
    getViewport,
    scrollToBottom,
  ]);

  const handleRegenerate = (messageId: string) => {
    regenerateMessage(messageId);
  };

  return (
    <div className={cn("relative flex flex-col", className)}>
      <ScrollArea
        className={cn("flex-grow bg-background", className)}
        ref={scrollAreaRootRef}
      >
        <div className="py-6 px-4 md:px-6 space-y-6 min-h-full">
          {isLoadingMessages && (
            <div className="space-y-4 mt-4">
              <Skeleton className="h-16 w-3/4 bg-muted" />
              <Skeleton className="h-20 w-1/2 ml-auto bg-muted" />
              <Skeleton className="h-16 w-2/3 bg-muted" />
            </div>
          )}
          {!isLoadingMessages && messages.length === 0 && <EmptyContent />}
          {!isLoadingMessages &&
            messages.map((message) => (
              <div key={message.id} className="animate-fadeIn">
                <MemoizedMessageBubble
                  message={message}
                  onRegenerate={
                    message.role === "assistant" && !message.isStreaming
                      ? handleRegenerate
                      : undefined
                  }
                  getContextSnapshotForMod={getContextSnapshotForMod}
                  modMessageActions={modMessageActions}
                  enableStreamingMarkdown={enableStreamingMarkdown}
                  // REMOVED: streamingPortalId={streamingPortalId}
                />
                {message.error && (
                  <div className="flex items-center gap-2 text-xs text-destructive ml-12 -mt-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{message.error}</span>
                  </div>
                )}
              </div>
            ))}
          <div ref={messagesEndRef} className="h-1" />
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      {showScrollButton && (
        <div className="absolute bottom-4 right-4 z-10 animate-fadeIn">
          <Button
            variant="outline"
            size="icon"
            className="rounded-full h-10 w-10 bg-background/80 hover:bg-muted border-border text-foreground backdrop-blur-sm"
            onClick={() => scrollToBottom("smooth", true)}
            title="Scroll to bottom"
          >
            <ArrowDownCircle className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export const ChatContent = React.memo(ChatContentComponent);
