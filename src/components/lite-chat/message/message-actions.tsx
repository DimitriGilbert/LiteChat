// src/components/lite-chat/message/message-actions.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { useChatContext } from "@/hooks/use-chat-context";
import type { Message, TextPart } from "@/lib/types"; // Import TextPart
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MessageActionsProps {
  message: Message; // Accept the full message object
  onRegenerate?: () => void;
  className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = React.memo(
  ({ message, onRegenerate, className }) => {
    // Get custom actions and the full context
    const context = useChatContext();
    const { customMessageActions = [] } = context;

    const handleCopy = () => {
      let textToCopy = "";
      if (typeof message.content === "string") {
        textToCopy = message.content;
      } else if (Array.isArray(message.content)) {
        // Extract text from TextPart elements for copying
        textToCopy = message.content
          .filter((part): part is TextPart => part.type === "text")
          .map((part) => part.text)
          .join("\n\n"); // Join text parts with double newline
        if (!textToCopy) {
          textToCopy = "[Image content - cannot copy text]"; // Placeholder if only images
        }
      }

      if (!textToCopy) {
        toast.info("Nothing to copy.");
        return;
      }

      navigator.clipboard
        .writeText(textToCopy) // Use the extracted/formatted text
        .then(() => {
          toast.success("Copied to clipboard!");
        })
        .catch((err) => {
          toast.error("Failed to copy text.");
          console.error("Copy failed:", err);
        });
    };

    return (
      <div
        className={cn(
          "flex items-center gap-0.5 opacity-0 group-hover/message:opacity-100 transition-opacity", // Use group-hover/message
          className,
        )}
      >
        {/* Custom Message Actions */}
        {customMessageActions.map((action) => {
          // Check visibility condition if provided
          const isVisible = action.isVisible
            ? action.isVisible(message, context)
            : true;
          if (!isVisible) return null;

          return (
            <TooltipProvider key={action.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-6 w-6", action.className)} // Apply custom classes
                    onClick={() => action.onClick(message, context)} // Pass message and context
                    aria-label={action.tooltip}
                  >
                    {action.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{action.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}

        {/* Default Regenerate Action */}
        {onRegenerate && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onRegenerate}
                  aria-label="Regenerate response"
                >
                  <RefreshCwIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Regenerate</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Default Copy Action */}
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
                aria-label="Copy message"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Copy</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  },
);

MessageActions.displayName = "MessageActions";
