// src/components/LiteChat/canvas/StreamingInteractionRenderer.tsx
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useInteractionStore } from "@/store/interaction.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { StopButton } from "@/components/LiteChat/common/StopButton";
import {
  useMarkdownParser,
  type ParsedContent,
  type CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";

// Simple throttle function (remains the same)
function throttle(func: () => void, limit: number) {
  let inThrottle: boolean;
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;
  return function (this: any) {
    const context = this;
    if (!inThrottle) {
      func.apply(context);
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= limit) {
            func.apply(context);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - lastRan),
      );
    }
  };
}

// Helper to quickly check for unclosed code fences (basic check)
const containsCodeBlock = (text: string): boolean => {
  return /```/.test(text); // Simple check for fence presence
};

// Memoize the inner component
const SingleStreamingInteraction = memo(
  ({
    interactionId,
    onStop,
  }: {
    interactionId: string;
    onStop: (id: string) => void;
  }) => {
    const interaction = useInteractionStore(
      useShallow((state) =>
        state.interactions.find((i) => i.id === interactionId),
      ),
    );
    // Fetch both FPS settings
    const {
      enableStreamingMarkdown,
      streamingRenderFPS,
      streamingCodeRenderFPS,
    } = useSettingsStore(
      useShallow((state) => ({
        enableStreamingMarkdown: state.enableStreamingMarkdown,
        streamingRenderFPS: state.streamingRenderFPS,
        streamingCodeRenderFPS: state.streamingCodeRenderFPS, // Get code FPS
      })),
    );

    const [displayedContent, setDisplayedContent] = useState<string>("");
    const latestContentRef = useRef<string>("");
    const throttledUpdateRef = useRef<(() => void) | undefined>(undefined);
    // Store the currently active throttle interval
    const currentThrottleMsRef = useRef<number>(100);

    // Update latest content and trigger throttled update
    useEffect(() => {
      latestContentRef.current = interaction?.response || "";
      // Determine which FPS to use based on latest content
      const hasCode = containsCodeBlock(latestContentRef.current);
      const targetFPS = hasCode ? streamingCodeRenderFPS : streamingRenderFPS;
      const newThrottleMs = targetFPS > 0 ? 1000 / targetFPS : 100;

      // If the throttle interval needs to change, recreate the throttle function
      if (newThrottleMs !== currentThrottleMsRef.current) {
        // console.log(`[Streaming] Changing throttle to ${newThrottleMs}ms (Code: ${hasCode})`);
        currentThrottleMsRef.current = newThrottleMs;
        throttledUpdateRef.current = throttle(() => {
          setDisplayedContent(latestContentRef.current);
        }, newThrottleMs);
      }

      // Always attempt to trigger the update
      throttledUpdateRef.current?.();
    }, [
      interaction?.response,
      streamingRenderFPS,
      streamingCodeRenderFPS, // Add dependency
    ]);

    // Initial setup for the throttle function
    useEffect(() => {
      const initialHasCode = containsCodeBlock(latestContentRef.current);
      const initialFPS = initialHasCode
        ? streamingCodeRenderFPS
        : streamingRenderFPS;
      const initialThrottleMs = initialFPS > 0 ? 1000 / initialFPS : 100;
      currentThrottleMsRef.current = initialThrottleMs;

      throttledUpdateRef.current = throttle(() => {
        setDisplayedContent(latestContentRef.current);
      }, initialThrottleMs);

      // Initial display update
      setDisplayedContent(latestContentRef.current);

      // Cleanup function (optional, depends on throttle implementation)
      return () => {
        // Cleanup logic if needed by the throttle function
      };
      // Rerun setup if FPS settings change
    }, [streamingRenderFPS, streamingCodeRenderFPS]);

    // Parse the *displayed* (throttled) content
    const parsedContent: ParsedContent = useMarkdownParser(
      enableStreamingMarkdown ? displayedContent : null,
    );

    // Ensure final content is displayed when streaming stops
    useEffect(() => {
      if (interaction && interaction.status !== "STREAMING") {
        // If the displayed content isn't the final one, update it directly
        if (displayedContent !== (interaction.response || "")) {
          setDisplayedContent(interaction.response || "");
        }
      }
    }, [interaction, displayedContent]); // Add displayedContent dependency

    if (!interaction || interaction.status !== "STREAMING") {
      // Render nothing if the interaction is gone or finished streaming
      // The final state will be handled by InteractionCard
      return null;
    }

    return (
      <div
        key={interaction.id}
        className={cn(
          "p-3 my-2 border rounded-md shadow-sm bg-card border-dashed relative group",
        )}
      >
        <div className="text-xs text-muted-foreground mb-1 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            Idx:{interaction.index} | {interaction.type} | Streaming
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            {interaction.metadata?.modelId && (
              <span className="ml-1 text-blue-400">
                ({interaction.metadata.modelId})
              </span>
            )}
          </span>
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <StopButton interactionId={interactionId} onStop={onStop} />
          </div>
        </div>
        {/* Render mixed content based on throttled state */}
        {enableStreamingMarkdown ? (
          <div className="text-sm markdown-content">
            {parsedContent.map((part, index) => {
              if (typeof part === "string") {
                return (
                  <div key={index} dangerouslySetInnerHTML={{ __html: part }} />
                );
              } else if (part.type === "code") {
                return (
                  <CodeBlockRenderer
                    key={index}
                    lang={part.lang}
                    code={part.code}
                  />
                );
              }
              return null;
            })}
          </div>
        ) : (
          <pre className="text-sm whitespace-pre-wrap">{displayedContent}</pre>
        )}
      </div>
    );
  },
);
SingleStreamingInteraction.displayName = "SingleStreamingInteraction"; // Add display name for memoized component

interface StreamingInteractionRendererProps {
  interactionIds: string[];
  onStop: (id: string) => void;
}

export const StreamingInteractionRenderer: React.FC<
  StreamingInteractionRendererProps
> = ({ interactionIds, onStop }) => {
  if (!interactionIds || interactionIds.length === 0) {
    return null;
  }

  return (
    <>
      {interactionIds.map((id) => (
        <SingleStreamingInteraction
          key={id}
          interactionId={id}
          onStop={onStop}
        />
      ))}
    </>
  );
};
