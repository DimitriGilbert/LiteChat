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
import { StreamingPortal } from "./streaming-portal"; // Import the new component

interface MessageBodyProps {
  message: Message;
  isFolded: boolean;
  onRegenerate?: (messageId: string) => void;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  modMessageActions: CustomMessageAction[];
  enableStreamingMarkdown: boolean;
  portalTargetId: string; // Required ID for the portal target div
}

export const MessageBody: React.FC<MessageBodyProps> = React.memo(
  ({
    message,
    isFolded,
    onRegenerate,
    getContextSnapshotForMod,
    modMessageActions,
    enableStreamingMarkdown,
    portalTargetId, // Destructure
  }) => {
    const [isChildrenCollapsed, setIsChildrenCollapsed] = useState(true);

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

    // Determine if content should be rendered via portal
    const isAssistantStreamingToPortal =
      message.role === "assistant" && message.isStreaming;

    return (
      <div className="flex-grow min-w-0 pr-12">
        {/* Always render role label if not folded */}
        {!isFolded && <MessageRoleLabel role={message.role} />}

        {!isFolded ? (
          <>
            {/* Container for main content (final or portal target) */}
            {/* This div will contain either the final content or the streaming portal content */}
            <div id={portalTargetId} className="message-content-area">
              {/* Render final content directly if NOT streaming */}
              {!isAssistantStreamingToPortal && (
                <MessageContentRenderer
                  message={message}
                  enableStreamingMarkdown={enableStreamingMarkdown}
                />
              )}
              {/* Render the StreamingPortal component if assistant is streaming */}
              {isAssistantStreamingToPortal && (
                <StreamingPortal
                  messageId={message.id}
                  content={message.streamedContent ?? ""}
                  enableMarkdown={enableStreamingMarkdown}
                  portalTargetId={portalTargetId} // Target the div rendered above
                />
              )}
            </div>

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
                      // Children don't use the portal target
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // Folded content logic remains the same
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
