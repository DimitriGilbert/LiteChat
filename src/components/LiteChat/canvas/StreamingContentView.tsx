// src/components/LiteChat/canvas/StreamingContentView.tsx
import React, { useState, useEffect, useRef, memo } from "react";
import { useInteractionStore } from "@/store/interaction.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import {
  useMarkdownParser,
  type ParsedContent,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";

// Throttle and containsCodeBlock functions (copied again)
function throttle(func: () => void, limit: number) {
  let inThrottle: boolean;
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;
  return function () {
    // Removed unused 'context' variable
    if (!inThrottle) {
      func(); // Call func directly
      lastRan = Date.now();
      inThrottle = true;
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= limit) {
            func(); // Call func directly
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - lastRan),
      );
    }
  };
}
const containsCodeBlock = (text: string): boolean => {
  return /```/.test(text);
};

interface StreamingContentViewProps {
  interactionId: string;
}

export const StreamingContentView: React.FC<StreamingContentViewProps> = memo(
  ({ interactionId }) => {
    // Subscribe ONLY to the buffer content for this specific interaction
    const bufferedContent = useInteractionStore(
      (state) => state.activeStreamBuffers[interactionId],
    );

    // Fetch settings needed for rendering logic
    const {
      enableStreamingMarkdown,
      streamingRenderFPS,
      streamingCodeRenderFPS,
    } = useSettingsStore(
      useShallow((state) => ({
        enableStreamingMarkdown: state.enableStreamingMarkdown,
        streamingRenderFPS: state.streamingRenderFPS,
        streamingCodeRenderFPS: state.streamingCodeRenderFPS,
      })),
    );

    // State and refs for throttling display updates
    const [displayedContent, setDisplayedContent] = useState<string>("");
    const latestContentRef = useRef<string>("");
    const throttledUpdateRef = useRef<(() => void) | undefined>(undefined);
    const currentThrottleMsRef = useRef<number>(100);
    const updatePendingRef = useRef<boolean>(false);

    // Effect to update latest content ref when buffer changes
    useEffect(() => {
      latestContentRef.current = bufferedContent ?? "";
      updatePendingRef.current = true;
    }, [bufferedContent]);

    // Effect to manage throttling rate and trigger updates
    useEffect(() => {
      const hasCode = containsCodeBlock(latestContentRef.current);
      const targetFPS = hasCode ? streamingCodeRenderFPS : streamingRenderFPS;
      const newThrottleMs = targetFPS > 0 ? 1000 / targetFPS : 100;

      if (newThrottleMs !== currentThrottleMsRef.current) {
        currentThrottleMsRef.current = newThrottleMs;
        throttledUpdateRef.current = throttle(() => {
          if (displayedContent !== latestContentRef.current) {
            setDisplayedContent(latestContentRef.current);
          }
          updatePendingRef.current = false;
        }, newThrottleMs);
      }
      // Always trigger the throttled update if pending
      if (updatePendingRef.current) {
        throttledUpdateRef.current?.();
      }
    }, [
      bufferedContent, // Re-evaluate throttle rate if content changes
      streamingRenderFPS,
      streamingCodeRenderFPS,
      displayedContent,
    ]);

    // Effect to set up initial throttling and display initial content
    useEffect(() => {
      const initialContent =
        useInteractionStore.getState().activeStreamBuffers[interactionId] ?? "";
      latestContentRef.current = initialContent;
      const initialHasCode = containsCodeBlock(initialContent);
      const initialFPS = initialHasCode
        ? streamingCodeRenderFPS
        : streamingRenderFPS;
      const initialThrottleMs = initialFPS > 0 ? 1000 / initialFPS : 100;
      currentThrottleMsRef.current = initialThrottleMs;

      throttledUpdateRef.current = throttle(() => {
        if (displayedContent !== latestContentRef.current) {
          setDisplayedContent(latestContentRef.current);
        }
        updatePendingRef.current = false;
      }, initialThrottleMs);

      setDisplayedContent(initialContent);
      updatePendingRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interactionId, streamingRenderFPS, streamingCodeRenderFPS]); // Run only once on mount for this interactionId

    // Parse the displayed content using the markdown hook
    const parsedContent: ParsedContent = useMarkdownParser(
      enableStreamingMarkdown ? displayedContent : null,
    );

    // Render the parsed content
    return enableStreamingMarkdown ? (
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
    );
  },
);
StreamingContentView.displayName = "StreamingContentView";
