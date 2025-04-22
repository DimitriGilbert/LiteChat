// src/components/lite-chat/chat/chat-header.tsx
import React, { useMemo } from "react";
import { ChatHeaderActions } from "./chat-header-actions";
import { cn } from "@/lib/utils";
import type {
  SidebarItem,
  SidebarItemType,
  DbConversation, // Added DbConversation import
} from "@/lib/types";

interface ChatHeaderProps {
  className?: string;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  // Make sidebarItems optional to handle potential initial undefined state
  sidebarItems?: SidebarItem[];
  activeConversationData: DbConversation | null; // Added activeConversationData prop
  searchTerm?: string; // Make optional
  setSearchTerm?: (term: string) => void; // Make optional
  exportConversation?: (conversationId: string | null) => Promise<void>; // Make optional
}

const ChatHeaderComponent: React.FC<ChatHeaderProps> = ({
  className,
  selectedItemId,
  selectedItemType,
  sidebarItems, // Receive as potentially optional
  activeConversationData, // Receive activeConversationData
  searchTerm = "", // Default optional props
  setSearchTerm = () => {}, // Default optional props
  exportConversation = async () => {}, // Default optional props
}) => {
  const title = useMemo(() => {
    // Use activeConversationData directly if available and it's a conversation
    if (selectedItemType === "conversation" && activeConversationData) {
      return activeConversationData.title;
    }
    // Fallback to finding in sidebarItems if activeConversationData is not passed or not a convo
    if (selectedItemId && selectedItemType && sidebarItems) {
      // Check if sidebarItems exists
      const selectedItem = sidebarItems.find(
        (item) => item.id === selectedItemId && item.type === selectedItemType, // Ensure type matches too
      );
      if (selectedItem) {
        if (selectedItem.type === "conversation") {
          return selectedItem.title;
        } else if (selectedItem.type === "project") {
          return selectedItem.name;
        }
      } else {
        console.warn(
          `ChatHeader: Selected item ${selectedItemId} (${selectedItemType}) not found in sidebarItems.`,
        );
      }
    }
    return "LiteChat"; // Default title
  }, [selectedItemId, selectedItemType, sidebarItems, activeConversationData]); // Add activeConversationData dependency

  const conversationId =
    selectedItemType === "conversation" ? selectedItemId : null;

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b border-border bg-card/60 backdrop-blur-sm px-4 text-card-foreground",
        className,
      )}
    >
      <h2 className="text-lg font-semibold truncate pr-4 pl-10 md:pl-0">
        {title}
      </h2>
      <ChatHeaderActions
        conversationId={conversationId}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        exportConversation={exportConversation}
      />
    </header>
  );
};

export const ChatHeader = React.memo(ChatHeaderComponent);
