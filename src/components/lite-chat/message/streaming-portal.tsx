// src/components/lite-chat/message/streaming-portal.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { sharedMdParser } from "@/lib/markdown-parser";

import { useCoreChatStore } from "@/store/core-chat.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";

interface StreamingPortalProps {
  messageId: string;
  enableStreamingMarkdown: boolean;
}

export const StreamingPortal: React.FC<StreamingPortalProps> = ({
  messageId,
  enableStreamingMarkdown,
}) => {
  // State for the content actually rendered to the DOM
  const [displayedContent, setDisplayedContent] = useState<string>("");
  // Ref to store the latest full content received from the store
  const latestContentRef = useRef<string>("");
  // Ref to track the timestamp of the last DOM update
  const lastRenderTimeRef = useRef<number>(0);
  // Ref for the animation frame ID
  const animationFrameRef = useRef<number | null>(null);
  // Ref to track if an update is pending due to throttling
  const updatePendingRef = useRef<boolean>(false);

  // Get necessary state from stores
  const { activeStreamId, activeStreamContent } = useCoreChatStore(
    useShallow((state) => ({
      activeStreamId: state.activeStreamId,
      activeStreamContent: state.activeStreamContent,
      isStreaming: state.isStreaming, // Need global streaming flag
    })),
  );
  const streamingRefreshRateMs = useSettingsStore(
    (state) => state.streamingRefreshRateMs,
  );

  // Effect 1: Update the latestContentRef whenever activeStreamContent changes for THIS message
  // This runs frequently but doesn't trigger DOM updates directly.
  useEffect(() => {
    if (activeStreamId === messageId) {
      // Only update ref if the content actually changed
      if (latestContentRef.current !== activeStreamContent) {
        latestContentRef.current = activeStreamContent;
        // Signal that new content has arrived and an update might be needed
        updatePendingRef.current = true;
      }
    } else {
      // If this message is no longer the active stream, reset refs and state
      latestContentRef.current = "";
      updatePendingRef.current = false;
      // Reset displayed content only if it's not already empty
      if (displayedContent !== "") {
        setDisplayedContent("");
      }
    }
    // Dependency: activeStreamContent specific to this messageId
  }, [activeStreamContent, activeStreamId, messageId, displayedContent]);

  // Effect 2: Manage the rendering loop based on time and pending updates
  // This effect controls the actual DOM updates via setDisplayedContent.
  useEffect(() => {
    // Function defining the loop logic
    const renderLoop = (now: number) => {
      // Ensure we are still the active stream before proceeding
      if (useCoreChatStore.getState().activeStreamId !== messageId) {
        animationFrameRef.current = null; // Stop the loop if stream changed
        // Perform one final check/update if needed when stream stops for this message
        if (
          updatePendingRef.current &&
          displayedContent !== latestContentRef.current
        ) {
          setDisplayedContent(latestContentRef.current);
          updatePendingRef.current = false; // Clear pending flag after final update
        }
        return;
      }

      const streamHasEnded = !useCoreChatStore.getState().isStreaming;

      // Check if an update is needed:
      // 1. An update is pending (new content arrived).
      // 2. EITHER enough time has passed OR the stream has just ended (force final render).
      if (
        updatePendingRef.current &&
        (now - lastRenderTimeRef.current >= streamingRefreshRateMs ||
          streamHasEnded)
      ) {
        // Update the displayed content only if it differs from the latest
        if (displayedContent !== latestContentRef.current) {
          setDisplayedContent(latestContentRef.current);
        }
        lastRenderTimeRef.current = now; // Update last render time
        updatePendingRef.current = false; // Reset pending flag as we just updated
      }

      // Continue the loop if this message is still the active stream
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    // Start the loop only if this message becomes the active stream
    // and the loop isn't already running.
    if (activeStreamId === messageId && !animationFrameRef.current) {
      console.log(`[StreamingPortal ${messageId}] Starting render loop.`);
      lastRenderTimeRef.current = performance.now(); // Initialize timer
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    }

    // Cleanup function: Cancel the animation frame when the component
    // unmounts or when the activeStreamId changes away from this messageId.
    return () => {
      if (animationFrameRef.current) {
        console.log(`[StreamingPortal ${messageId}] Cancelling render loop.`);
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    // Dependencies: Only messageId and streamingRefreshRateMs.
    // We get the active stream state *inside* the loop using getState()
    // to avoid restarting the loop unnecessarily on every chunk.
    // displayedContent is needed to compare for the final update.
  }, [messageId, streamingRefreshRateMs, displayedContent, activeStreamId]); // Removed activeStreamId, isStreaming

  // Memoize the HTML rendering based on the displayed content
  const renderedHTML = useMemo(() => {
    if (enableStreamingMarkdown) {
      return sharedMdParser.render(displayedContent);
    } else {
      // Render plain text within a pre tag to preserve whitespace
      return `<pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; padding: 0; background: transparent; border: none;">${displayedContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
    }
  }, [displayedContent, enableStreamingMarkdown]);

  // Render the throttled content
  return <span dangerouslySetInnerHTML={{ __html: renderedHTML }} />;
};
