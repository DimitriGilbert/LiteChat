// src/components/lite-chat/message/message-actions.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
// Removed useChatContext import
// Import necessary store hooks
import { useModStore } from "@/store/mod.store";
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
    // Get custom actions from mod store
    const { customMessageActions } = useModStore((s) => ({
      customMessageActions: s.modMessageActions,
    }));

    // TODO: Get context snapshot function if needed by custom actions
    // This might require importing multiple stores or a dedicated selector
    const getContextSnapshot = () => {
      console.warn("Context snapshot for message actions not implemented");
      return {}; // Placeholder
    };

    const handleCopy = () => {
      let textToCopy = "";
      if (typeof message.content === "string") {
        textToCopy = message.content;
      } else if (Array.isArray(message.content)) {
        textToCopy = message.content
          .filter((part): part is TextPart => part.type === "text")
          .map((part) => part.text)
          .join("\n");
        if (!textToCopy) {
          textToCopy = "[Image content - cannot copy text]";
        }
      }

      if (!textToCopy) {
        toast.info("Nothing to copy.");
        return;
      }

      navigator.clipboard
        .writeText(textToCopy)
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
          "flex items-center gap-0.5 opacity-0 group-hover/message:opacity-100 transition-opacity",
          className,
        )}
      >
        {/* Custom Message Actions */}
        {customMessageActions.map((action) => {
          const contextSnapshot = getContextSnapshot(); // Get snapshot if needed
          const isVisible = action.isVisible
            ? action.isVisible(message, contextSnapshot as any) // Pass snapshot
            : true;
          if (!isVisible) return null;

          return (
            <TooltipProvider key={action.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-6 w-6", action.className)}
                    onClick={() =>
                      action.onClick(message, contextSnapshot as any)
                    } // Pass snapshot
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
