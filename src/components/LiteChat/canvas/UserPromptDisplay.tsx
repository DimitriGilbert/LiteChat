// src/components/LiteChat/canvas/UserPromptDisplay.tsx
import React, { useState, useCallback, useMemo } from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import {
  UserIcon,
  ClipboardIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  EditIcon, // Placeholder for future edit
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

interface UserPromptDisplayProps {
  interaction: Interaction;
  className?: string;
}

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = ({
  interaction,
  className,
}) => {
  const [isFolded, setIsFolded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const userContent =
    interaction.prompt?.content &&
    typeof interaction.prompt.content === "string"
      ? interaction.prompt.content
      : "[User content unavailable]";

  const handleCopy = useCallback(async () => {
    if (!userContent || userContent === "[User content unavailable]") return;
    try {
      await navigator.clipboard.writeText(userContent);
      setIsCopied(true);
      toast.success("Prompt copied to clipboard!");
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy prompt.");
      console.error("Clipboard copy failed:", err);
    }
  }, [userContent]);

  const toggleFold = () => setIsFolded((prev) => !prev);

  // Get first few lines for folded preview
  const foldedPreviewText = useMemo(() => {
    if (!userContent) return "";
    return userContent.split("\n").slice(0, 3).join("\n");
  }, [userContent]);

  return (
    <div className={cn("flex items-start gap-3 my-2 group", className)}>
      {/* Avatar */}
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center mt-1">
        <UserIcon className="h-5 w-5" />
      </div>

      {/* Bubble Container */}
      <div className="p-3 border rounded-md shadow-sm bg-muted/50 flex-grow min-w-0 relative">
        {/* Action Buttons Container - Sticky */}
        <div className="interaction-card-actions-sticky">
          {/* Fold/Unfold Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold prompt" : "Fold prompt"}
                >
                  <ChevronsUpDownIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFolded ? "Unfold" : "Fold"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Copy Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                  aria-label="Copy prompt"
                  disabled={
                    !userContent || userContent === "[User content unavailable]"
                  }
                >
                  {isCopied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Edit Button (Placeholder) */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => toast.info("Edit functionality coming soon!")}
                  aria-label="Edit prompt (coming soon)"
                >
                  <EditIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit (Soon)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Content inside the bubble */}
        <div className="text-sm">
          {isFolded ? (
            // Folded Preview
            <div className="folded-content-preview" onClick={toggleFold}>
              <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                {foldedPreviewText}
              </pre>
            </div>
          ) : (
            // Full Content
            <pre className="whitespace-pre-wrap break-words">{userContent}</pre>
          )}
        </div>

        {/* Display attached files or other metadata if needed */}
        {interaction.prompt?.metadata?.attachedFileCount > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            ({interaction.prompt?.metadata.attachedFileCount} file(s))
          </div>
        )}
        {interaction.prompt?.metadata?.selectedVfsFiles &&
          interaction.prompt.metadata.selectedVfsFiles.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              ({interaction.prompt.metadata.selectedVfsFiles.length} VFS
              file(s))
            </div>
          )}
      </div>
    </div>
  );
};
