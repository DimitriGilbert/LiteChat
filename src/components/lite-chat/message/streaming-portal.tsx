// src/components/lite-chat/message/streaming-portal.tsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
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

  const { activeStreamId, activeStreamContent } = useCoreChatStore(
    useShallow((state) => ({
      activeStreamId: state.activeStreamId,
      activeStreamContent: state.activeStreamContent,
    })),
  );

  const enableMarkdown = useSettingsStore(
    (state) => state.enableStreamingMarkdown,
  );

  useEffect(() => {
    const node = document.getElementById(portalTargetId);
    setPortalNode(node);

    if (!node) {
      console.warn(
        `Streaming portal target element with ID "${portalTargetId}" not found.`,
      );
    }
  }, [portalTargetId]);

  if (portalNode && activeStreamId === messageId) {
    return createPortal(
      // Re-apply the necessary styling classes here for the streaming content
      <div
        className={cn(
          // Base text styles
          "text-gray-200 text-sm whitespace-pre-wrap break-words",
          // Apply prose styles conditionally for markdown
          enableMarkdown && [
            "prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1",
            "prose-headings:mt-4 prose-headings:mb-2",
            "prose-code:before:content-none prose-code:after:content-none",
            "prose-pre:bg-transparent prose-pre:p-0 prose-pre:my-0",
          ],
          "py-2",
        )}
      >
        {enableMarkdown ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {activeStreamContent}
          </ReactMarkdown>
        ) : (
          <pre className="font-sans text-sm">
            <code>{activeStreamContent}</code>
          </pre>
        )}
        <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-white align-baseline"></span>
      </div>,
      portalNode,
    );
  }
  return null;
};
