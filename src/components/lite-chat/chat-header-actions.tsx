// src/components/lite-chat/chat-header-actions.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DownloadIcon, SearchIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatContext } from "@/hooks/use-chat-context";
import { cn } from "@/lib/utils";

interface ChatHeaderActionsProps {
  className?: string;
}

export const ChatHeaderActions: React.FC<ChatHeaderActionsProps> = ({
  className,
}) => {
  const {
    selectedConversationId,
    exportConversation,
    searchTerm,
    setSearchTerm,
  } = useChatContext();

  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent interference if inside another clickable element
    exportConversation(selectedConversationId);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Search Input - Kept relatively small */}
      <div className="relative max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          placeholder="Search messages..."
          className="pl-8 h-9 w-full"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Export Current Chat Button */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportClick}
              disabled={!selectedConversationId}
              aria-label="Export current chat"
              className="h-9 w-9"
            >
              <DownloadIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Export current chat (.json)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
