// src/components/lite-chat/message/message-actions.tsx
import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import type { Message, TextPart, CustomMessageAction } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReadonlyChatContextSnapshot } from "@/mods/api";

interface MessageActionsProps {
  message: Message;
  onRegenerate?: () => void;
  className?: string;
  getContextSnapshotForMod: () => ReadonlyChatContextSnapshot;
  customMessageActions: CustomMessageAction[];
}

export const MessageActions: React.FC<MessageActionsProps> = React.memo(
  ({
    message,
    onRegenerate,
    className,
    getContextSnapshotForMod,
    customMessageActions = [],
  }) => {
    const getContextSnapshot = getContextSnapshotForMod;

    const handleCopy = useCallback(() => {
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
    }, [message.content]);

    return (
      <div
        className={cn(
          "flex items-center gap-0.5 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200",
          className,
        )}
      >
        {customMessageActions.map((action) => {
          const isVisible = action.isVisible
            ? action.isVisible(message, {} as any)
            : true;

          if (!isVisible) return null;

          const handleClick = () => {
            const contextSnapshot = getContextSnapshot();
            action.onClick(message, contextSnapshot as any);
          };

          return (
            <TooltipProvider key={action.id} delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-6 w-6 transition-colors",
                      action.className,
                    )}
                    onClick={handleClick}
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

        {onRegenerate && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors"
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

        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors"
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
