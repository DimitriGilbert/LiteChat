// src/components/lite-chat/prompt/prompt-actions.tsx
import React, { useRef } from "react"; // Removed useMemo, useCallback
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, PaperclipIcon, ImageIcon } from "lucide-react";
// REMOVED store imports
// import { useModStore } from "@/store/mod.store";
// import { useProviderStore } from "@/store/provider.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  AiModelConfig,
  // DbProviderConfig, // REMOVED
  CustomPromptAction, // Import type
} from "@/lib/types";

// Define props based on what PromptForm passes down
interface PromptActionsProps {
  className?: string;
  prompt: string;
  isStreaming: boolean;
  addAttachedFile: (file: File) => void;
  setPrompt: (value: string) => void;
  // Props needed for internal logic/derivations
  selectedModel: AiModelConfig | undefined; // Pass the derived model object
  // Custom actions (assuming passed from a higher level or mod store via props)
  customPromptActions: CustomPromptAction[];
  // Context snapshot getter (assuming passed from a higher level)
  getContextSnapshot: () => any; // Replace 'any' with a proper snapshot type if defined
}

// Wrap component logic in a named function for React.memo
const PromptActionsComponent: React.FC<PromptActionsProps> = ({
  className,
  prompt,
  isStreaming,
  addAttachedFile,
  setPrompt,
  selectedModel, // Use prop
  customPromptActions, // Use prop
  getContextSnapshot, // Use prop
}) => {
  // REMOVED store access

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use props for internal logic
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
        addAttachedFile(files[i]); // Use prop action
      }
      event.target.value = "";
    }
  };

  const handleImagineClick = () => {
    if (prompt.trim().length > 0 && !prompt.startsWith("/imagine ")) {
      setPrompt(`/imagine ${prompt}`); // Use prop action
    } else if (prompt.trim().length === 0) {
      setPrompt("/imagine "); // Use prop action
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
                disabled={isStreaming || prompt.trim().length === 0} // Use props
                className={cn(
                  "h-10 w-10 rounded-full border-gray-200 dark:border-gray-700",
                  prompt.startsWith("/imagine ") && "bg-primary/20", // Use prop
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
      {/* Use customPromptActions prop */}
      {customPromptActions.map((action) => (
        <TooltipProvider key={action.id} delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => action.onClick(getContextSnapshot())} // Use prop getter
                disabled={isStreaming} // Use prop
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
                disabled={!canSubmit} // Use derived state
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

// Export the memoized component
export const PromptActions = React.memo(PromptActionsComponent);
