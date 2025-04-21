// src/components/lite-chat/prompt/prompt-actions.tsx
import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonalIcon, PaperclipIcon, ImageIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AiModelConfig, CustomPromptAction } from "@/lib/types";

interface PromptActionsProps {
  className?: string;
  prompt: string;
  isStreaming: boolean;
  addAttachedFile: (file: File) => void;
  setPrompt: (value: string) => void;
  selectedModel: AiModelConfig | undefined;
  customPromptActions: CustomPromptAction[];
  getContextSnapshot: () => any;
}

const PromptActionsComponent: React.FC<PromptActionsProps> = ({
  className,
  prompt,
  isStreaming,
  addAttachedFile,
  setPrompt,
  selectedModel,
  customPromptActions,
  getContextSnapshot,
}) => {
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

  const handleImagineClick = () => {
    if (prompt.trim().length > 0 && !prompt.startsWith("/imagine ")) {
      setPrompt(`/imagine ${prompt}`);
    } else if (prompt.trim().length === 0) {
      setPrompt("/imagine ");
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
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAttachClick}
              disabled={isStreaming}
              className="h-10 w-10 rounded-full border-border transition-colors hover:bg-muted"
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
      {canGenerateImage && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleImagineClick}
                disabled={isStreaming || prompt.trim().length === 0}
                className={cn(
                  "h-10 w-10 rounded-full border-border transition-colors hover:bg-muted",
                  prompt.startsWith("/imagine ") && "bg-primary/20",
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
      {customPromptActions.map((action) => (
        <TooltipProvider key={action.id} delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => action.onClick(getContextSnapshot())}
                disabled={isStreaming}
                className={cn(
                  "h-10 w-10 rounded-full border-border transition-colors hover:bg-muted",
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
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Button
                type="submit"
                size="icon"
                disabled={!canSubmit}
                className={cn(
                  "h-10 w-10 rounded-full transition-all",
                  canSubmit
                    ? "bg-primary hover:bg-primary/90 hover:scale-105"
                    : "bg-muted dark:bg-muted",
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

export const PromptActions = React.memo(PromptActionsComponent);
