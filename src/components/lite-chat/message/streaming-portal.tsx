// src/components/lite-chat/streaming-portal.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Remarkable } from "remarkable";
import hljs from "highlight.js";

import { useCoreChatStore } from "@/store/core-chat.store";
import { useShallow } from "zustand/react/shallow";

interface StreamingPortalProps {
  messageId: string;
  portalTargetId: string;
}

// Explicitly type the mdStream instance
const mdStream: Remarkable = new Remarkable({
  html: true,
  breaks: true,
  typographer: true,
  // Add explicit return type ': string' to the highlight function
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true })
          .value;
      } catch (__) {
        /* ignore */
      }
    }
    try {
      return hljs.highlightAuto(str).value;
    } catch (__) {
      /* ignore */
    }
    // Use the static Remarkable.utils
    return Remarkable.utils.escapeHtml(str);
  },
});

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

  useEffect(() => {
    const node = document.getElementById(portalTargetId);
    if (node) setPortalNode(node);
    return () => {
      if (node) {
        node.innerHTML = "";
      }
      setPortalNode(null);
    };
  }, [portalTargetId]);

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
      if (
        now - lastRenderTimeRef.current > 33 ||
        accumulatedContentRef.current === activeStreamContent
      ) {
        if (displayedContent !== accumulatedContentRef.current) {
          setDisplayedContent(accumulatedContentRef.current);
        }
        lastRenderTimeRef.current = now;
        animationFrameRef.current = null;
      } else {
        if (!animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(renderStep);
        }
      }
    };

    accumulatedContentRef.current = activeStreamContent;

    if (!animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderStep);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [activeStreamContent, activeStreamId, messageId, displayedContent]);

  const renderedHTML = useMemo(
    () => mdStream.render(displayedContent),
    [displayedContent],
  );

  if (!portalNode) return null;

  return createPortal(
    <div
      className="markdown-content hljs"
      dangerouslySetInnerHTML={{ __html: renderedHTML }}
    />,
    portalNode,
  );
};
