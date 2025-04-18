import React, { useMemo } from "react";
import { ChatHeaderActions } from "./chat-header-actions";
import { cn } from "@/lib/utils";
import type { SidebarItem, SidebarItemType } from "@/lib/types";

interface ChatHeaderProps {
  className?: string;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  sidebarItems: SidebarItem[];
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  className,
  selectedItemId,
  selectedItemType,
  sidebarItems,
}) => {
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
      <ChatHeaderActions
        conversationId={
          selectedItemType === "conversation" ? selectedItemId : null
        }
      />
    </header>
  );
};
