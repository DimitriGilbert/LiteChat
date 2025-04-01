// src/components/lite-chat/chat-header.tsx
import React from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { ChatHeaderActions } from "./chat-header-actions";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ className }) => {
  const { selectedConversationId, conversations } = useChatContext();

  const currentConversation = conversations.find(
    (c) => c.id === selectedConversationId,
  );
  const title = currentConversation?.title ?? ""; // Default title

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b bg-gray-100/40 px-4 dark:bg-gray-800/40",
        className,
      )}
    >
      <h2 className="text-lg font-semibold truncate pr-4">{title}</h2>
      <ChatHeaderActions />
    </header>
  );
};
