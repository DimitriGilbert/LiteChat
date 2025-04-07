// src/components/lite-chat/chat-header.tsx
import React from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { ChatHeaderActions } from "./chat-header-actions";
import { cn } from "@/lib/utils";
import { db } from "@/lib/db"; // Import db for direct fetching if needed
import { useLiveQuery } from "dexie-react-hooks";

interface ChatHeaderProps {
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ className }) => {
  const { selectedItemId, selectedItemType } = useChatContext();

  // Use useLiveQuery to reactively fetch the selected item's data
  const selectedItemData = useLiveQuery(async () => {
    if (!selectedItemId || !selectedItemType) return null;
    if (selectedItemType === "conversation") {
      return await db.conversations.get(selectedItemId);
    } else if (selectedItemType === "project") {
      return await db.projects.get(selectedItemId);
    }
    return null;
  }, [selectedItemId, selectedItemType]); // Dependencies

  const title = selectedItemData
    ? selectedItemType === "conversation"
      ? (selectedItemData as import("@/lib/types").DbConversation).title
      : (selectedItemData as import("@/lib/types").DbProject).name
    : "LiteChat"; // Default title or placeholder

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b bg-gray-800/60 backdrop-blur-sm px-4 text-gray-200", // Adjusted background/style
        className,
      )}
    >
      {/* Add padding for the menu button on small screens */}
      <h2 className="text-lg font-semibold truncate pr-4 pl-10 md:pl-0">
        {title}
      </h2>
      {/* Pass conversation ID only if a conversation is selected */}
      <ChatHeaderActions
        conversationId={
          selectedItemType === "conversation" ? selectedItemId : null
        }
      />
    </header>
  );
};
