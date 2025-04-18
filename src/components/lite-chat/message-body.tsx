// src/components/lite-chat/message-body.tsx
import React from "react";
import type { Message } from "@/lib/types";
import { MessageRoleLabel } from "./message-role-label";
import { MessageContentRenderer } from "./message-content-renderer";
import { VfsContextDisplay } from "./vfs-context-display";
import { MessageMetadataDisplay } from "./message-metadata-display";
import { MessageErrorDisplay } from "./message-error-display";

interface MessageBodyProps {
  message: Message;
  isFolded: boolean;
}

export const MessageBody: React.FC<MessageBodyProps> = React.memo(
  ({ message, isFolded }) => {
    // Hide body entirely for folded system messages
    if (message.role === "system" && isFolded) {
      return null;
    }

    return (
      <div className="flex-grow min-w-0 pr-12">
        <MessageRoleLabel role={message.role} />

        {!isFolded ? (
          <>
            <MessageContentRenderer message={message} />
            <VfsContextDisplay paths={message.vfsContextPaths} />
            <MessageMetadataDisplay message={message} />
            <MessageErrorDisplay error={message.error} />

            {/* Placeholder for future sub-bubbles/workflows */}
            {/* {message.subMessages && message.subMessages.map(subMsg => <SubMessageBubble key={subMsg.id} message={subMsg} />)} */}
          </>
        ) : (
          // Show placeholder only if not a system message
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
