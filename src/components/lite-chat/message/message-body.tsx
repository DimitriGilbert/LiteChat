// src/components/lite-chat/message/message-body.tsx
import React, { useState } from "react";
import type { Message, CustomMessageAction } from "@/lib/types";
import { MessageRoleLabel } from "./message-role-label";
import { MessageContentRenderer } from "./message-content-renderer";
import { MessageMetadataDisplay } from "./message-metadata-display";
import { MessageErrorDisplay } from "./message-error-display";
import { MemoizedMessageBubble } from "./message-bubble";
import { ChildrenToggleButton } from "./children-toggle-button";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";
import { cn } from "@/lib/utils";
import { StreamingPortal } from "./streaming-portal";
import { useCoreChatStore } from "@/store/core-chat.store"; // Import store

interface MessageBodyProps {
  message: Message;
  isFolded: boolean;
  onRegenerate?: (messageId: string) => void;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  modMessageActions: CustomMessageAction[];
  enableStreamingMarkdown: boolean; // Keep for final render
  portalTargetId: string;
}

export const MessageBody: React.FC<MessageBodyProps> = React.memo(
  ({
    message,
    isFolded,
    onRegenerate,
    getContextSnapshotForMod,
    modMessageActions,
    enableStreamingMarkdown,
    portalTargetId,
  }) => {
    const [isChildrenCollapsed, setIsChildrenCollapsed] = useState(true);
    // Get activeStreamId to determine if this message is the one streaming
    const activeStreamId = useCoreChatStore((state) => state.activeStreamId);

    const toggleChildrenCollapse = () => {
      setIsChildrenCollapsed((prev) => !prev);
    };

    if (message.role === "system" && isFolded) {
      return null;
    }

    const hasChildren = message.children && message.children.length > 0;

    const gridColsClass = (() => {
      const count = message.children?.length ?? 0;
      if (count <= 1) return "grid-cols-1";
      if (count === 2) return "grid-cols-1 md:grid-cols-2";
      if (count === 3) return "grid-cols-1 md:grid-cols-3";
      return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    })();

    // Determine if this specific message is the one actively streaming
    const isThisMessageStreaming = activeStreamId === message.id;

    return (
      <div className="flex-grow min-w-0 pr-12">
        {!isFolded && <MessageRoleLabel role={message.role} />}

        {!isFolded ? (
          <>
            {/* Container for main content (final or portal target) */}
            <div id={portalTargetId} className="message-content-area">
              {/* Render final content if NOT the actively streaming message */}
              {!isThisMessageStreaming && (
                <MessageContentRenderer
                  message={message}
                  enableStreamingMarkdown={enableStreamingMarkdown}
                />
              )}
              {/* Portal is rendered conditionally below, it targets this div */}
            </div>

            {/* Render the StreamingPortal ONLY if this message IS streaming */}
            {isThisMessageStreaming && (
              <StreamingPortal
                messageId={message.id}
                portalTargetId={portalTargetId}
                // Content and markdown setting are now read from store inside Portal
              />
            )}

            {/* Metadata and Error always render inline */}
            <MessageMetadataDisplay message={message} />
            <MessageErrorDisplay error={message.error} />

            {/* Children rendering logic remains the same */}
            {hasChildren && (
              <div className="mt-2">
                <ChildrenToggleButton
                  isCollapsed={isChildrenCollapsed}
                  onToggle={toggleChildrenCollapse}
                  childCount={message.children!.length}
                />
              </div>
            )}

            {hasChildren && !isChildrenCollapsed && (
              <div
                className={cn(
                  "mt-3 pt-3 border-t border-border/50",
                  "grid gap-3",
                  gridColsClass,
                )}
              >
                {message.children!.map((childMsg) => (
                  <div key={childMsg.id} className="min-w-0">
                    <MemoizedMessageBubble
                      message={childMsg}
                      level={0}
                      onRegenerate={onRegenerate}
                      getContextSnapshotForMod={getContextSnapshotForMod}
                      modMessageActions={modMessageActions}
                      enableStreamingMarkdown={enableStreamingMarkdown}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          message.role !== "system" && (
            <div className="text-sm text-gray-500 italic mt-1 select-none">
              Message content hidden...
            </div>
          )
        )}
      </div>
    );
  },
);
MessageBody.displayName = "MessageBody";
