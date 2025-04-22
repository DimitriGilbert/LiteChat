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

interface MessageBodyProps {
  message: Message;
  isFolded: boolean;
  // level: number; // Removed unused prop
  onRegenerate?: (messageId: string) => void;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  modMessageActions: CustomMessageAction[];
}

export const MessageBody: React.FC<MessageBodyProps> = React.memo(
  ({
    message,
    isFolded,
    // level, // Removed from destructuring
    onRegenerate,
    getContextSnapshotForMod,
    modMessageActions,
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

    return (
      <div className="flex-grow min-w-0 pr-12">
        <MessageRoleLabel role={message.role} />

        {!isFolded ? (
          <>
            <MessageContentRenderer message={message} />
            <MessageMetadataDisplay message={message} />
            <MessageErrorDisplay error={message.error} />

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
                      level={0} // Children inside grid start at level 0 visually
                      onRegenerate={onRegenerate}
                      getContextSnapshotForMod={getContextSnapshotForMod}
                      modMessageActions={modMessageActions}
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
