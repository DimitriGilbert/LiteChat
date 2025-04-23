// src/components/lite-chat/chat/chat-header.tsx
import React, { useMemo } from "react";
import { ChatHeaderActions } from "./chat-header-actions";
import { cn } from "@/lib/utils";
// import type {
//   // SidebarItem, // Removed - Fetched from store
//   SidebarItemType,
//   DbConversation,
//   DbProject, // Added DbProject import
// } from "@/lib/types";
// Import store hooks
import { useShallow } from "zustand/react/shallow";
import { useSidebarStore } from "@/store/sidebar.store";
import { useChatStorage } from "@/hooks/use-chat-storage"; // To get items

interface ChatHeaderProps {
  className?: string;
  // Remove props fetched from store
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  exportConversation?: (conversationId: string | null) => Promise<void>;
}

const ChatHeaderComponent: React.FC<ChatHeaderProps> = ({
  className,
  searchTerm = "",
  setSearchTerm = () => {},
  exportConversation = async () => {},
}) => {
  // --- Fetch state from stores ---
  const { selectedItemId, selectedItemType } = useSidebarStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      // activeConversationData is derived below
    })),
  );

  // Fetch items from storage for title fallback and active data
  const { projects, conversations } = useChatStorage();

  // Derive activeConversationData locally
  const activeConversationData = useMemo(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      return (conversations || []).find((c) => c.id === selectedItemId);
    }
    return null;
  }, [selectedItemId, selectedItemType, conversations]);

  const title = useMemo(() => {
    if (selectedItemType === "conversation" && activeConversationData) {
      return activeConversationData.title;
    }
    if (selectedItemId && selectedItemType) {
      if (selectedItemType === "conversation") {
        const item = (conversations || []).find((c) => c.id === selectedItemId);
        return item?.title;
      } else if (selectedItemType === "project") {
        const item = (projects || []).find((p) => p.id === selectedItemId);
        return item?.name;
      }
    }
    return "LiteChat"; // Default title
  }, [
    selectedItemId,
    selectedItemType,
    activeConversationData,
    conversations,
    projects,
  ]);

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
