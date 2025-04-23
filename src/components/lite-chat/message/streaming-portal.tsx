// src/components/lite-chat/message/streaming-portal.tsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "./message-content-utils";

interface StreamingPortalProps {
  messageId: string;
  content: string;
  enableMarkdown: boolean;
  portalTargetId: string;
}

export const StreamingPortal: React.FC<StreamingPortalProps> = ({
  messageId,
  content,
  enableMarkdown,
  portalTargetId,
}) => {
  const [portalNode, setPortalNode] = useState<Element | null>(null);

  // Find portal node on mount or when ID changes
  useEffect(() => {
    const node = document.getElementById(portalTargetId);
    setPortalNode(node);

    if (!node) {
      console.warn(
        `Streaming portal target element with ID "${portalTargetId}" not found.`,
      );
    }
    // No cleanup needed here, the portal component will unmount when streaming stops.
  }, [portalTargetId, messageId]);

  // Render content into the portal if the node exists
  if (portalNode) {
    return createPortal(
      // Render only the content and pulse indicator, no bubble structure
      <>
        {enableMarkdown ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents} // Use components from utils
          >
            {content}
          </ReactMarkdown>
        ) : (
          <pre className="font-sans text-sm">
            <code>{content}</code>
          </pre>
        )}
        <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
      </>,
      portalNode,
    );
  }

  // If portal node not found/ready, render nothing
  return null;
};
