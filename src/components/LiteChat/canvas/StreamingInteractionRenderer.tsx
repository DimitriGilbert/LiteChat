// src/components/LiteChat/canvas/StreamingInteractionRenderer.tsx
import React, { useState, useEffect, useRef, useCallback, memo } from "react"; // Added memo
import { useInteractionStore } from "@/store/interaction.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { StopButton } from "@/components/LiteChat/common/StopButton";
// Import the new parser hook and types
import {
  useMarkdownParser,
  type ParsedContent,
  type CodeBlockData,
} from "@/lib/litechat/useMarkdownParser";
// Import the new CodeBlockRenderer
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";

// Simple throttle function (keep as is)
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
    const { enableStreamingMarkdown, streamingRenderFPS } = useSettingsStore(
      useShallow((state) => ({
        enableStreamingMarkdown: state.enableStreamingMarkdown,
        streamingRenderFPS: state.streamingRenderFPS,
      })),
    );

    const [displayedContent, setDisplayedContent] = useState<string>("");
    const latestContentRef = useRef<string>("");
    const throttledUpdateRef = useRef<(() => void) | undefined>(undefined);

    useEffect(() => {
      latestContentRef.current = interaction?.response || "";
      throttledUpdateRef.current?.();
    }, [interaction?.response]);

    useEffect(() => {
      const updateDisplayedContent = () => {
        setDisplayedContent(latestContentRef.current);
      };

      const throttleMs =
        streamingRenderFPS > 0 ? 1000 / streamingRenderFPS : 100;

      throttledUpdateRef.current = throttle(updateDisplayedContent, throttleMs);

      updateDisplayedContent();
    }, [streamingRenderFPS]);

    // Parse the *displayed* content
    const parsedContent: ParsedContent = useMarkdownParser(
      enableStreamingMarkdown ? displayedContent : null,
    );

    if (!interaction || interaction.status !== "STREAMING") {
      // This check might be less reliable now with throttled display updates
      // Consider removing or adjusting if final state isn't always shown correctly
      // if (interaction && displayedContent !== interaction.response) {
      //     setDisplayedContent(interaction.response || "");
      // }
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
        {/* Render mixed content */}
        {enableStreamingMarkdown ? (
          <div className="text-sm markdown-content">
            {parsedContent.map((part, index) => {
              console.log(
                `[StreamingInteraction] Rendering part ${index}:`,
                part,
              ); // Log each part
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
