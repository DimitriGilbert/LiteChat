import React, { useRef } from "react"; // Add useRef
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, PaperclipIcon } from "lucide-react";
import { useChatContext } from "@/context/chat-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PromptActionsProps {
  className?: string;
}

export const PromptActions: React.FC<PromptActionsProps> = ({ className }) => {
  const { prompt, handleSubmit, isStreaming, addAttachedFile } =
    useChatContext();
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
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple // Allow multiple files?
        // accept="image/*" // TODO: Specify acceptable file types
      />

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAttachClick} // Use handler
              disabled={isStreaming}
              aria-label="Attach file" // Update label
            >
              <PaperclipIcon className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {/* TODO: Update tooltip based on model capabilities */}
            <p>Attach file (multimodal support varies)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* ... Send Button ... */}
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              {" "}
              {/* Wrapper for disabled tooltip */}
              <Button
                type="submit"
                size="icon"
                disabled={!canSubmit}
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
