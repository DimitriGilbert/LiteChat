// src/components/lite-chat/prompt/prompt-actions.tsx
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, PaperclipIcon, ImageIcon } from "lucide-react"; // Added ImageIcon
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
  prompt: string;
  isStreaming: boolean;
  addAttachedFile: (file: File) => void;
  // Add function to modify prompt for image generation
  setPrompt: (value: string) => void;
}

export const PromptActions: React.FC<PromptActionsProps> = ({
  className,
  prompt,
  isStreaming,
  addAttachedFile,
  setPrompt, // Receive setPrompt
}) => {
  const context = useChatContext();
  const {
    customPromptActions = [],
    selectedModel, // Get selected model to check capabilities
  } = context;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = prompt.trim().length > 0 && !isStreaming;
  const canGenerateImage =
    selectedModel?.supportsImageGeneration && !isStreaming;

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        addAttachedFile(files[i]);
      }
      event.target.value = "";
    }
  };

  // Function to trigger image generation by prefixing prompt
  const handleImagineClick = () => {
    if (prompt.trim().length > 0 && !prompt.startsWith("/imagine ")) {
      setPrompt(`/imagine ${prompt}`);
      // Optionally trigger submit immediately after setting prompt?
      // Or let user press send? Let user press send for now.
    } else if (prompt.trim().length === 0) {
      setPrompt("/imagine "); // Add prefix even if prompt is empty
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
              disabled={isStreaming}
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
      {/* Imagine Button */}
      {canGenerateImage && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleImagineClick}
                disabled={isStreaming || prompt.trim().length === 0} // Disable if no prompt
                className={cn(
                  "h-10 w-10 rounded-full border-gray-200 dark:border-gray-700",
                  prompt.startsWith("/imagine ") && "bg-primary/20", // Indicate active state
                )}
                aria-label="Generate Image (Prefixes prompt with /imagine)"
              >
                <ImageIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Generate Image (Prefixes prompt with /imagine)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {/* Custom Prompt Actions */}
      {customPromptActions.map((action) => (
        <TooltipProvider key={action.id} delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => action.onClick(context)}
                disabled={isStreaming}
                className={cn(
                  "h-10 w-10 rounded-full border-gray-200 dark:border-gray-700",
                  action.className,
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
