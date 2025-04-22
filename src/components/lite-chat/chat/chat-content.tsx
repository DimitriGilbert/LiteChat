// src/components/lite-chat/chat/chat-content.tsx
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
import {
  AlertCircle,
  MessageSquarePlusIcon,
  ArrowDownCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { throttle } from "@/lib/throttle";
import type { Message, CustomMessageAction } from "@/lib/types";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";

interface ChatContentProps {
  className?: string;
  messages: Message[];
  isLoadingMessages: boolean;
  isStreaming: boolean;
  regenerateMessage: (messageId: string) => void;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  modMessageActions: CustomMessageAction[];
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
          {!isLoadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center pt-36 px-4">
              <div className="rounded-full bg-muted p-5 mb-5">
                <MessageSquarePlusIcon className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-medium mb-3 text-foreground">
                Welcome to LiteChat ⚡️
              </h3>
              <p className="text-sm text-muted-foreground max-w-xl mb-4">
                Your OpenSource, local, lightweight AI chat experience that
                lives right in your browser. No servers(ish), no tracking, just
                conversations.
              </p>
              <div className="bg-card/80 p-5 rounded-lg border border-border text-left max-w-[1600px] mb-6">
                <h4 className="font-medium text-card-foreground mb-2 flex items-center">
                  <span className="text-yellow-400 mr-2">💡</span> A little
                  backstory...
                </h4>
                <p className="text-sm text-card-foreground mb-3 italic">
                  "I created LiteChat because I wanted a better experience for
                  my local AI chats that I couldn't get with{" "}
                  <a
                    href="https://t3.chat"
                    className="text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    T3.chat
                  </a>{" "}
                  (and everything else seemed clunky...) . Then I added things I
                  thought were missing, like a virtual file system and projects
                  to organize chats. And I have more features planned! (Soon,
                  tm) :wink-wink:"
                </p>
                <p className="text-sm text-card-foreground mb-3 italic">
                  If you need a professional chat app that will be kept up to
                  date, you should really consider{" "}
                  <a
                    href="https://t3.chat"
                    className="text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    T3.chat
                  </a>
                </p>
                <p className="text-sm text-card-foreground mb-3 italic">
                  {" "}
                  LiteChat is a cool experiment but I wouldn't recommend you to
                  use it for serious purposes if you are not (at least in part)
                  a dev (#ChatAppsAreHard).
                </p>
                <p className="text-xs text-muted-foreground">
                  That said, LiteChat gives you complete privacy and control –
                  everything stays in your browser, well, at least no one
                  between you and your favorite AI provider.
                </p>
              </div>
              <div className="bg-card/80 p-5 rounded-lg border border-border text-left max-w-[1600px] mb-6">
                <h4 className="font-medium text-card-foreground mb-3 flex items-center">
                  <span className="text-blue-400 mr-2">🔑</span> Bring Your Own
                  API Key
                </h4>
                <p className="text-sm text-card-foreground mb-3">
                  LiteChat puts you in control of your AI experience. Add your
                  own API keys and chat with your favorite models.
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  LiteChat was lovingly vibe coded with additional features to
                  make your AI conversations feel more... Naaaahhh XD, I wanted
                  my own wheel !
                </p>
                <p className="text-xs text-muted-foreground mb-3 text-center">
                  Damn AI BullSlope XD !
                </p>
                <div className="bg-muted/50 p-3 rounded-md mb-3">
                  <p className="text-xs font-medium text-card-foreground mb-2">
                    To get started, add your API key in settings:
                  </p>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <a
                      href="https://openrouter.ai/keys"
                      className="text-blue-400 hover:underline flex items-center"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="mr-1">→</span> OpenRouter API Keys (Many
                      models in one place)
                    </a>
                    <a
                      href="https://platform.openai.com/account/api-keys"
                      className="text-blue-400 hover:underline flex items-center"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="mr-1">→</span> OpenAI API Keys (GPT
                      models)
                    </a>
                    <a
                      href="https://console.anthropic.com/keys"
                      className="text-blue-400 hover:underline flex items-center"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="mr-1">→</span> Anthropic API Keys (Claude
                      models)
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 italic pt-4">
                    Don't worry, your keys are stored in your browser and never
                    sent to any server except the AI provider you choose.
                  </p>
                </div>
                <p className="text-sm text-card-foreground mb-3 italic">
                  Then you need to configure your provider(s) (I remember
                  someone saying something about clunky...)
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Or maybe run one locally (
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Ollama
                  </a>{" "}
                  or{" "}
                  <a
                    href="https://lmstudio.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    LMStudio
                  </a>
                  )
                </p>
                <p className="text-sm text-card-foreground mb-3 italic">
                  Aaaand then, ..., you are good to go, just chat your brains
                  out !
                </p>
              </div>
              <div className="bg-card/80 p-5 rounded-lg border border-border text-left max-w-[1600px] mb-6">
                <h4 className="font-medium text-card-foreground mb-2 flex items-center">
                  <span className="text-green-400 mr-2">✨</span> What makes
                  LiteChat special?
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
                    <p className="font-medium text-card-foreground mb-1">
                      Virtual File System
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Upload and manage files for your AI to reference
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Now with (limited) support for Git !! Clone, pull, all
                      that good stuff :D
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
                    <p className="font-medium text-card-foreground mb-1">
                      Projects & Folders
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Organize your chats by topic or purpose
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Synchronize you conversation using Git (no tried yet, but
                      my issues are open :D)
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
                    <p className="font-medium text-card-foreground mb-1">
                      Chat parameters control
                    </p>
                    <p className="text-xs text-muted-foreground">
                      System prompt, Temperature, Top Somethings, Penalty(ies) !
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
                    <p className="font-medium text-card-foreground mb-1">
                      Chat parameters control
                    </p>
                    <p className="text-xs text-muted-foreground">
                      System prompt, Temperature, Top Somethings, Penalty(ies) !
                    </p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-md transition-all hover:scale-105">
                    <p className="font-medium text-card-foreground mb-1">
                      Mods !
                    </p>
                    <p className="text-xs text-muted-foreground">
                      I didn't try modding (yet), but I'm pretty sure you could
                      do cool things :D.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
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
