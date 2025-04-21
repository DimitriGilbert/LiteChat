// src/components/lite-chat/chat/chat-header.tsx
import React, { useMemo } from "react";
import { ChatHeaderActions } from "./chat-header-actions";
import { cn } from "@/lib/utils";
import type { SidebarItem, SidebarItemType } from "@/lib/types";

// Define props based on what ChatWrapper passes down
interface ChatHeaderProps {
  className?: string;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  sidebarItems: SidebarItem[];
  // Props for ChatHeaderActions
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  exportConversation: (conversationId: string | null) => Promise<void>;
}

// Wrap component logic in a named function for React.memo
const ChatHeaderComponent: React.FC<ChatHeaderProps> = ({
  className,
  selectedItemId,
  selectedItemType,
  sidebarItems,
  // Destructure props for ChatHeaderActions
  searchTerm,
  setSearchTerm,
  exportConversation,
}) => {
  // Title derivation logic remains the same, uses props
  const title = useMemo(() => {
    if (!selectedItemId || !selectedItemType) {
      return "LiteChat";
    }
    const selectedItem = sidebarItems.find(
      (item) => item.id === selectedItemId,
    );
    if (!selectedItem) {
      console.warn(
        `ChatHeader: Selected item ${selectedItemId} not found in sidebarItems.`,
      );
      return "LiteChat";
    }
    if (selectedItem.type === "conversation") {
      return selectedItem.title;
    } else if (selectedItem.type === "project") {
      return selectedItem.name;
    }
    return "LiteChat";
  }, [selectedItemId, selectedItemType, sidebarItems]);

  const conversationId =
    selectedItemType === "conversation" ? selectedItemId : null;

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
      {/* Pass necessary props down to ChatHeaderActions */}
      <ChatHeaderActions
        conversationId={conversationId}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
    </header>
  );
};

// Export the memoized component
export const ChatHeader = React.memo(ChatHeaderComponent);
