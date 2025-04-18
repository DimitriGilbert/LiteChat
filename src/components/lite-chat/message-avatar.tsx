// src/components/lite-chat/message-avatar.tsx
import React from "react";
import { cn } from "@/lib/utils";
import { BotIcon, UserIcon } from "lucide-react";
import type { Message } from "@/lib/types"; // Assuming Message type defines role

interface MessageAvatarProps {
  role: Message["role"]; // Use role from Message type
}

export const MessageAvatar: React.FC<MessageAvatarProps> = React.memo(
  ({ role }) => {
    const isUser = role === "user";
    // Add handling for 'system' role if needed, otherwise default to assistant icon
    const Icon = isUser ? UserIcon : BotIcon;
    const bgColor = isUser
      ? "bg-blue-900/30"
      : role === "assistant"
        ? "bg-violet-900/30"
        : "bg-gray-700/30"; // Example for system
    const textColor = isUser
      ? "text-blue-400"
      : role === "assistant"
        ? "text-violet-400"
        : "text-gray-400"; // Example for system

    return (
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          bgColor,
          textColor,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
    );
  },
);
MessageAvatar.displayName = "MessageAvatar";
