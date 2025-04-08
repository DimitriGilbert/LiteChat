// src/components/lite-chat/prompt-actions.tsx
import React, { useRef } from "react"; // Add useRef
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, PaperclipIcon } from "lucide-react";
import { useChatContext } from "@/hooks/use-chat-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PromptActionsProps {
  className?: string;
}

export const PromptActions: React.FC<PromptActionsProps> = ({ className }) => {
  const { prompt, isStreaming, addAttachedFile } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  const canSubmit =
    prompt.trim().length > 0 /* || attachedFiles.length > 0 */ && !isStreaming; // TODO: Allow submit with only files

  const handleAttachClick = () => {
    fileInputRef.current?.click(); // Trigger hidden input
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        addAttachedFile(files[i]); // Add selected files to context
      }
      // Reset input value so selecting the same file again triggers onChange
      event.target.value = "";
    }
  };

  return (
    <div className={cn("flex items-end ml-2 mb-1", className)}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
      />

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Add type="button" here */}
            <Button
              type="button" // <--- ADD THIS LINE
              variant="outline"
              size="icon"
              onClick={handleAttachClick}
              disabled={isStreaming}
              className="h-10 w-10 rounded-full mr-2 border-gray-200 dark:border-gray-700"
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

      {/* Submit button remains type="submit" (implicitly via form) */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                type="submit"
                size="icon"
                disabled={!canSubmit}
                className={cn(
                  "h-10 w-10 rounded-full",
                  canSubmit
                    ? "bg-primary hover:bg-primary/90"
                    : "bg-gray-200 dark:bg-gray-700",
                )}
                aria-label="Send message"
              >
                <SendHorizonalIcon className="h-5 w-5" />
              </Button>
            </div>
          </TooltipTrigger>
          {!canSubmit && (
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
