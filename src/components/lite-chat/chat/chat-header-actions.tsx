
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
import { cn } from "@/lib/utils";

interface ChatHeaderActionsProps {
  className?: string;
  conversationId: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  exportConversation: (conversationId: string) => Promise<void>;
}

const ChatHeaderActionsComponent: React.FC<ChatHeaderActionsProps> = ({
  className,
  conversationId,
  searchTerm,
  setSearchTerm,
  exportConversation,
}) => {
  const handleExportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversationId) {
      exportConversation(conversationId);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative max-w-xs">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search messages..."
          className="pl-8 h-9 w-full bg-background border-border text-foreground placeholder-muted-foreground"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExportClick}
              disabled={!conversationId}
              aria-label="Export current chat"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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

export const ChatHeaderActions = React.memo(ChatHeaderActionsComponent);
