// src/components/lite-chat/chat/chat-header-actions.tsx
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
// REMOVED store imports
import { cn } from "@/lib/utils";

// Define props based on what ChatHeader passes down
interface ChatHeaderActionsProps {
  className?: string;
  conversationId: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  exportConversation: (conversationId: string) => Promise<void>; // Expects non-null ID here
}

// Wrap component logic in a named function for React.memo
const ChatHeaderActionsComponent: React.FC<ChatHeaderActionsProps> = ({
  className,
  conversationId,
  searchTerm,
  setSearchTerm,
  exportConversation,
}) => {
  // REMOVED store access

  // Use props directly
  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversationId) {
      exportConversation(conversationId); // Use prop action
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Search Input */}
      <div className="relative max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          placeholder="Search messages..."
          className="pl-8 h-9 w-full bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400"
          value={searchTerm} // Use prop
          onChange={(e) => setSearchTerm(e.target.value)} // Use prop action
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
              disabled={!conversationId} // Use prop
              aria-label="Export current chat"
              className="h-9 w-9 text-gray-400 hover:text-white hover:bg-gray-700"
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

// Export the memoized component
export const ChatHeaderActions = React.memo(ChatHeaderActionsComponent);
