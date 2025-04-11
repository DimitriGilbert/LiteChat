// src/components/lite-chat/chat-wrapper.tsx
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
  // REMOVED props for prompt state
}

export const ChatWrapper: React.FC<ChatWrapperProps> = ({
  className,
  selectedItemId,
  selectedItemType,
  sidebarItems,
  regenerateMessage,
  // REMOVED prompt state props
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
      {/* REMOVED passing prompt state props down */}
      <PromptWrapper />
    </main>
  );
};
