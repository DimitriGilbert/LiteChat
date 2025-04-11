// src/components/lite-chat/prompt-actions.tsx
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, PaperclipIcon } from "lucide-react";
import { useChatContext } from "@/hooks/use-chat-context"; // Still need context for custom actions
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PromptActionsProps {
  className?: string;
  prompt: string; // Add prop for prompt value
  isStreaming: boolean; // Add prop
  addAttachedFile: (file: File) => void; // Add prop
}

export const PromptActions: React.FC<PromptActionsProps> = ({
  className,
  prompt, // Use prop
  isStreaming, // Use prop
  addAttachedFile, // Use prop
}) => {
  // Get context only for custom actions
  const context = useChatContext();
  const {
    // REMOVED: prompt, isStreaming, addAttachedFile
    customPromptActions = [], // Default to empty array
  } = context;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use the passed-in prompt prop to determine if submit is possible
  const canSubmit = prompt.trim().length > 0 && !isStreaming;

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        addAttachedFile(files[i]); // Use prop
      }
      event.target.value = "";
    }
  };

  return (
    <div className={cn("flex items-end ml-2 mb-1 gap-1", className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
      />
      {/* Attach Button */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAttachClick}
              disabled={isStreaming} // Use prop
              className="h-10 w-10 rounded-full border-gray-200 dark:border-gray-700"
              aria-label="Attach file"
            >
              <PaperclipIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Attach file</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* Custom Prompt Actions */}
      {customPromptActions.map((action) => (
        <TooltipProvider key={action.id} delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => action.onClick(context)} // Pass full context
                disabled={isStreaming} // Use prop
                className={cn(
                  "h-10 w-10 rounded-full border-gray-200 dark:border-gray-700",
                  action.className, // Apply custom classes
                )}
                aria-label={action.tooltip}
              >
                {action.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{action.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      {/* Send Button */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                type="submit"
                size="icon"
                disabled={!canSubmit} // Use derived state based on prop
                className={cn(
                  "h-10 w-10 rounded-full",
                  canSubmit // Use derived state based on prop
                    ? "bg-primary hover:bg-primary/90"
                    : "bg-gray-200 dark:bg-gray-700",
                )}
                aria-label="Send message"
              >
                <SendHorizonalIcon className="h-5 w-5" />
              </Button>
            </div>
          </TooltipTrigger>
          {!canSubmit && ( // Use derived state based on prop
            <TooltipContent>
              <p>
                {isStreaming ? "Waiting for response..." : "Enter a message"}
              </p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
