import React from "react";
import { Button } from "@/components/ui/button"; // Assuming shadcn/ui Button
import { CopyIcon, RefreshCwIcon } from "lucide-react"; // Example icons

interface MessageActionsProps {
  messageContent: string;
  onRegenerate?: () => void; // Optional: For AI messages
  className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = React.memo(
  ({ messageContent, onRegenerate, className }) => {
    const handleCopy = () => {
      navigator.clipboard.writeText(messageContent);
      // Add toast notification here if desired
    };

    return (
      <div
        className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${className}`}
      >
        {onRegenerate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRegenerate}
            aria-label="Regenerate response"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
          aria-label="Copy message"
        >
          <CopyIcon className="h-4 w-4" />
        </Button>
        {/* Add other actions like Edit (for user), Delete, etc. */}
      </div>
    );
  },
);

MessageActions.displayName = "MessageActions";
