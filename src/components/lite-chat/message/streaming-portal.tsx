// src/components/lite-chat/message/streaming-portal.tsx
import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./message-content-utils";
import { useCoreChatStore } from "@/store/core-chat.store";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "@/store/settings.store";

interface StreamingPortalProps {
  messageId: string;
  portalTargetId: string;
}

export const StreamingPortal: React.FC<StreamingPortalProps> = ({
  messageId,
  portalTargetId,
}) => {
  const [portalNode, setPortalNode] = useState<Element | null>(null);
  const [displayedContent, setDisplayedContent] = useState<string>("");
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const accumulatedContentRef = useRef<string>("");

  const { activeStreamId, activeStreamContent } = useCoreChatStore(
    useShallow((state) => ({
      activeStreamId: state.activeStreamId,
      activeStreamContent: state.activeStreamContent,
    })),
  );

  const { enableMarkdown, streamingRefreshRateMs } = useSettingsStore(
    useShallow((state) => ({
      enableMarkdown: state.enableStreamingMarkdown,
      streamingRefreshRateMs: state.streamingRefreshRateMs,
    })),
  );

  useEffect(() => {
    const node = document.getElementById(portalTargetId);
    setPortalNode(node);

    if (!node) {
      console.warn(
        `Streaming portal target element with ID "${portalTargetId}" not found.`,
      );
    }
    if (activeStreamId === messageId) {
      setDisplayedContent("");
      accumulatedContentRef.current = "";
      lastRenderTimeRef.current = 0;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [portalTargetId, messageId, activeStreamId]);

  useEffect(() => {
    if (activeStreamId !== messageId || !portalNode) {
      return;
    }

    accumulatedContentRef.current = activeStreamContent;

    const updateDisplay = () => {
      const now = Date.now();
      if (now - lastRenderTimeRef.current >= streamingRefreshRateMs) {
        setDisplayedContent(accumulatedContentRef.current);
        lastRenderTimeRef.current = now;
      }
      animationFrameRef.current = requestAnimationFrame(updateDisplay);
    };

    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateDisplay);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (activeStreamId !== messageId) {
        setDisplayedContent(accumulatedContentRef.current);
      }
    };
  }, [
    activeStreamContent,
    streamingRefreshRateMs,
    activeStreamId,
    messageId,
    portalNode,
  ]);

  useEffect(() => {
    if (activeStreamId !== messageId && portalNode) {
      setDisplayedContent(accumulatedContentRef.current);
    }
  }, [activeStreamId, messageId, portalNode]);

  if (portalNode && activeStreamId === messageId) {
    return createPortal(
      <>
        {enableMarkdown ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {displayedContent}
          </ReactMarkdown>
        ) : (
          <pre className="font-sans text-sm">
            <code>{displayedContent}</code>
          </pre>
        )}
        <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
      </>,
      portalNode,
    );
  }
  return null;
};
