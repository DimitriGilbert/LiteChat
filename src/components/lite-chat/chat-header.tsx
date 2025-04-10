// src/components/lite-chat/chat-header.tsx
import React, { useMemo } from "react"; // Import useMemo
import { useChatContext } from "@/hooks/use-chat-context";
import { ChatHeaderActions } from "./chat-header-actions";
import { cn } from "@/lib/utils";
// No longer need db or useLiveQuery here

interface ChatHeaderProps {
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ className }) => {
  const {
    selectedItemId,
    selectedItemType,
    sidebarItems, // Get the list of items from context
  } = useChatContext();

  // Derive title by finding the selected item in the sidebarItems list
  const title = useMemo(() => {
    if (!selectedItemId || !selectedItemType) {
      return "LiteChat"; // Default title if nothing selected
    }
    const selectedItem = sidebarItems.find(
      (item) => item.id === selectedItemId,
    );

    if (!selectedItem) {
      // Should ideally not happen if selection is valid, but handle defensively
      console.warn(
        `ChatHeader: Selected item ${selectedItemId} not found in sidebarItems.`,
      );
      return "LiteChat";
    }

    // Check the type from the found item (more robust than relying on selectedItemType state)
    if (selectedItem.type === "conversation") {
      return selectedItem.title;
    } else if (selectedItem.type === "project") {
      return selectedItem.name;
    }

    return "LiteChat"; // Fallback
  }, [selectedItemId, sidebarItems]); // Depend on ID and the list itself

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b bg-gray-800/60 backdrop-blur-sm px-4 text-gray-200",
        className,
      )}
    >
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
