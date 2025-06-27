import React from "react";
import {
  Wand2,
  Bug,
  MessagesSquare,
  MessageCircle,
  FileText,
  Files,
} from "lucide-react";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

export interface RepairEnhanceCodeBlockControlProps {
  interactionId: string;
  codeBlockId: string;
  language?: string;
  codeContent: string;
  filepath?: string;
  errorMessage?: string;
  disabled?: boolean;
}

export const RepairEnhanceCodeBlockControl: React.FC<
  RepairEnhanceCodeBlockControlProps
> = ({
  interactionId,
  codeBlockId,
  language,
  codeContent,
  filepath,
  errorMessage,
  disabled,
}) => {
  const handleRequest = (
    mode:
      | "repair"
      | "enhance"
      | "complete-message"
      | "complete-conversation"
      | "other-blocks-message"
      | "other-blocks-conversation"
  ) => {
    if (disabled) return;
    emitter.emit(canvasEvent.repairEnhanceCodeBlockRequest, {
      interactionId,
      codeBlockId,
      language,
      filepath,
      originalContent: codeContent,
      mode,
      errorMessage,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionTooltipButton
          tooltipText="AI Actions"
          icon={<Wand2 className="h-4 w-4" />}
          disabled={disabled}
          tabIndex={-1}
          onClick={(e) => {
            e.preventDefault();
            // Mark as codeblock button interaction to prevent scroll interference
            const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (viewport) {
              (viewport as any)._isCodeblockButtonInteraction = true;
              setTimeout(() => {
                (viewport as any)._isCodeblockButtonInteraction = false;
              }, 100);
            }
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>AI Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleRequest("repair")}>
          <Bug className="mr-2 h-4 w-4" />
          <span>Repair Code</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRequest("enhance")}>
          <Wand2 className="mr-2 h-4 w-4" />
          <span>Enhance Code</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Enhance with Context</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleRequest("other-blocks-message")}>
          <MessageCircle className="mr-2 h-4 w-4" />
          <span>This Message's Blocks</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleRequest("other-blocks-conversation")}
        >
          <MessagesSquare className="mr-2 h-4 w-4" />
          <span>This Conversation's Blocks</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Complete from Context</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleRequest("complete-message")}>
          <FileText className="mr-2 h-4 w-4" />
          <span>This Message's Blocks</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleRequest("complete-conversation")}
        >
          <Files className="mr-2 h-4 w-4" />
          <span>This Conversation's Blocks</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
