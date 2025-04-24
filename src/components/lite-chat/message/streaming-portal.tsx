// src/components/lite-chat/message/streaming-portal.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { sharedMdParser } from "@/lib/markdown-parser";

import { useCoreChatStore } from "@/store/core-chat.store";
import { useSettingsStore } from "@/store/settings.store"; // Import settings store
import { useShallow } from "zustand/react/shallow";

interface StreamingPortalProps {
  messageId: string;
  enableStreamingMarkdown: boolean; // Receive prop
}

export const StreamingPortal: React.FC<StreamingPortalProps> = ({
  messageId,
  enableStreamingMarkdown, // Use prop
}) => {
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const accumulatedContentRef = useRef<string>("");

  // Get streaming state
  const { activeStreamId, activeStreamContent } = useCoreChatStore(
    useShallow((state) => ({
      activeStreamId: state.activeStreamId,
      activeStreamContent: state.activeStreamContent,
    })),
  );

  // Get refresh rate from settings store
  const streamingRefreshRateMs = useSettingsStore(
    (state) => state.streamingRefreshRateMs,
  );

  useEffect(() => {
    if (activeStreamId !== messageId) {
      if (displayedContent !== "") {
        setDisplayedContent("");
        accumulatedContentRef.current = "";
      }
      return;
    }

    if (!activeStreamContent) {
      if (displayedContent !== "") {
        setDisplayedContent("");
        accumulatedContentRef.current = "";
      }
      return;
    }

    const renderStep = () => {
      const now = performance.now();
      // Use streamingRefreshRateMs from settings store for throttling
      if (
        now - lastRenderTimeRef.current >= streamingRefreshRateMs ||
        accumulatedContentRef.current === activeStreamContent
      ) {
        if (displayedContent !== accumulatedContentRef.current) {
          setDisplayedContent(accumulatedContentRef.current);
        }
        lastRenderTimeRef.current = now;
        animationFrameRef.current = null;
      } else {
        if (!animationFrameRef.current) {
          // Calculate remaining time for more accurate scheduling
          const remainingTime = Math.max(
            0,
            streamingRefreshRateMs - (now - lastRenderTimeRef.current),
          );
          // Use setTimeout for scheduling based on remaining time
          // Note: requestAnimationFrame is usually smoother, but setTimeout
          // allows respecting the specific millisecond delay from settings.
          // If perfect smoothness is prioritized over exact ms delay,
          // revert to requestAnimationFrame.
          animationFrameRef.current = window.setTimeout(() => {
            animationFrameRef.current = null; // Clear timeout ID before next potential step
            renderStep(); // Re-run the check
          }, remainingTime);
        }
      }
    };

    accumulatedContentRef.current = activeStreamContent;

    // Use requestAnimationFrame to initially schedule the check
    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderStep);
    }

    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        // Use clearTimeout since we might have scheduled with setTimeout
        clearTimeout(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    // Add streamingRefreshRateMs to dependencies
  }, [
    activeStreamContent,
    activeStreamId,
    messageId,
    displayedContent,
    streamingRefreshRateMs,
  ]);

  // Conditionally parse markdown based on the prop
  const renderedHTML = useMemo(() => {
    if (enableStreamingMarkdown) {
      return sharedMdParser.render(displayedContent);
    } else {
      // Render plain text - basic escaping might be needed depending on content
      // Using a <pre> tag preserves whitespace and prevents accidental HTML injection
      return `<pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; padding: 0; background: transparent; border: none;">${displayedContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    }
  }, [displayedContent, enableStreamingMarkdown]);

  return <span dangerouslySetInnerHTML={{ __html: renderedHTML }} />;
};
