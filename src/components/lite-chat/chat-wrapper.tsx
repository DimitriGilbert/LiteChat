import React from "react";
import { ChatContent } from "./chat-content";
import { PromptWrapper } from "./prompt-wrapper";
import { ChatHeader } from "./chat-header";
import { cn } from "@/lib/utils";
import type { SidebarItem, SidebarItemType } from "@/lib/types";

interface ChatWrapperProps {
  className?: string;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  sidebarItems: SidebarItem[];
  regenerateMessage: (messageId: string) => void;
}

export const ChatWrapper: React.FC<ChatWrapperProps> = ({
  className,
  selectedItemId,
  selectedItemType,
  sidebarItems,
  regenerateMessage,
}) => {
  return (
    <main
      className={cn(
        "flex flex-grow flex-col bg-background overflow-hidden",
        className,
      )}
    >
      <ChatHeader
        selectedItemId={selectedItemId}
        selectedItemType={selectedItemType}
        sidebarItems={sidebarItems}
      />
      <ChatContent
        className="flex-grow h-0"
        regenerateMessage={regenerateMessage}
      />
      <PromptWrapper />
    </main>
  );
};
