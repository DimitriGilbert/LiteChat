// src/components/lite-chat/message-role-label.tsx
import React from "react";
import type { Message } from "@/lib/types";

interface MessageRoleLabelProps {
  role: Message["role"];
}

export const MessageRoleLabel: React.FC<MessageRoleLabelProps> = React.memo(
  ({ role }) => {
    // Don't show label for system messages unless needed
    if (role === "system") {
      return null;
    }
    const label = role === "user" ? "You" : "Assistant";
    return (
      <div className="text-xs font-medium text-gray-400 mb-1 select-none">
        {label}
      </div>
    );
  },
);
MessageRoleLabel.displayName = "MessageRoleLabel";
