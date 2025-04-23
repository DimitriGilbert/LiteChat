
import React from "react";
import { cn } from "@/lib/utils";
import { BotIcon, UserIcon } from "lucide-react";
import type { Message } from "@/lib/types";

interface MessageAvatarProps {
  role: Message["role"];
}

export const MessageAvatar: React.FC<MessageAvatarProps> = React.memo(
  ({ role }) => {
    const isUser = role === "user";
    const Icon = isUser ? UserIcon : BotIcon;
    const bgColor = isUser
      ? "bg-blue-900/30"
      : role === "assistant"
        ? "bg-violet-900/30"
        : "bg-muted/30";
    const textColor = isUser
      ? "text-blue-400"
      : role === "assistant"
        ? "text-violet-400"
        : "text-muted-foreground";

    return (
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
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
