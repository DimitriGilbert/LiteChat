// src/components/lite-chat/chat-history.tsx (Example Structure)
import React from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DownloadIcon, Trash2Icon, EditIcon } from "lucide-react"; // Add icons
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DbConversation } from "@/lib/types";

// Example Item Component (adjust based on your actual implementation)
const HistoryItem: React.FC<{ conversation: DbConversation }> = ({
  conversation,
}) => {
  const {
    selectConversation,
    selectedConversationId,
    deleteConversation,
    renameConversation, // Assuming you have rename UI elsewhere or add it here
    exportConversation,
  } = useChatContext();
  const isActive = conversation.id === selectedConversationId;

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation
    exportConversation(conversation.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete chat "${conversation.title}"?`)) {
      deleteConversation(conversation.id);
    }
  };

  // Add rename functionality if needed, e.g., on double click or dedicated button

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded-md cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800",
        isActive && "bg-gray-100 dark:bg-gray-800",
      )}
      onClick={() => selectConversation(conversation.id)}
    >
      {/* Ensure text is centered vertically within its container */}
      <span className="text-sm truncate flex-grow pr-2">
        {conversation.title}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleExportClick}
                aria-label="Export this chat"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Export chat</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {/* Add Rename/Delete buttons similarly */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-600"
                onClick={handleDeleteClick}
                aria-label="Delete chat"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Delete chat</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export const ChatHistory: React.FC<{ className?: string }> = ({
  className,
}) => {
  const { conversations } = useChatContext();

  return (
    <ScrollArea className={cn("flex-grow h-0", className)}>
      <div className="p-2 space-y-1">
        {conversations.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">
            No chats yet.
          </p>
        )}
        {conversations.map((conv) => (
          <HistoryItem key={conv.id} conversation={conv} />
        ))}
      </div>
    </ScrollArea>
  );
};
