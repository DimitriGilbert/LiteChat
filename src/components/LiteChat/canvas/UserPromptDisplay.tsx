// src/components/LiteChat/canvas/UserPromptDisplay.tsx
import React, { useState, useCallback, useMemo } from "react"; // Added useCallback
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import {
  UserIcon,
  ClipboardIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  EditIcon,
  CopyIcon, // Added CopyIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { FilePreviewRenderer } from "@/components/LiteChat/common/FilePreviewRenderer";
// Import the type directly, no need for store here
import type { AttachedFileMetadata } from "@/store/input.store";

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
  const [isIdCopied, setIsIdCopied] = useState(false); // State for copy ID button

  const userContent =
    interaction.prompt?.content &&
    typeof interaction.prompt.content === "string"
      ? interaction.prompt.content
      : "";

  // Get file metadata directly from the interaction's prompt snapshot
  // Ensure it's treated as the correct type, including content fields
  const attachedFiles = (interaction.prompt?.metadata?.attachedFiles ||
    []) as AttachedFileMetadata[];

  const hasContent = userContent || attachedFiles.length > 0;

  const handleCopy = useCallback(async () => {
    if (!userContent) return;
    try {
      await navigator.clipboard.writeText(userContent);
      setIsCopied(true);
      toast.success("Prompt text copied to clipboard!");
      setTimeout(() => setIsCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy prompt text.");
      console.error("Clipboard copy failed:", err);
    }
  }, [userContent]);

  // Callback to copy the interaction ID
  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(interaction.id);
      setIsIdCopied(true);
      toast.success("Interaction ID copied to clipboard!");
      setTimeout(() => setIsIdCopied(false), 1500);
    } catch (err) {
      toast.error("Failed to copy interaction ID.");
      console.error("Clipboard copy failed:", err);
    }
  }, [interaction.id]);

  const toggleFold = () => setIsFolded((prev) => !prev);

  const foldedPreviewText = useMemo(() => {
    if (!userContent) return "";
    return userContent
      .split(
        `
`,
      )
      .slice(0, 3).join(`
`);
  }, [userContent]);

  return (
    <div className={cn("flex items-start gap-3 my-2 group", className)}>
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center mt-1">
        <UserIcon className="h-5 w-5" />
      </div>
      <div className="p-3 border rounded-md shadow-sm bg-muted/50 flex-grow min-w-0 relative">
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
                  disabled={!hasContent}
                >
                  <ChevronsUpDownIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFolded ? "Unfold" : "Fold"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Copy ID Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopyId}
                  aria-label="Copy interaction ID"
                >
                  {isIdCopied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <CopyIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy ID</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Copy Text Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                  aria-label="Copy prompt text"
                  disabled={!userContent}
                >
                  {isCopied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <ClipboardIcon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Copy Text</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Edit Button */}
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
        <div className="text-sm">
          {isFolded ? (
            <div
              className="folded-content-preview cursor-pointer"
              onClick={toggleFold}
            >
              {userContent ? (
                <pre className="whitespace-pre-wrap break-words text-muted-foreground">
                  {foldedPreviewText}
                </pre>
              ) : (
                <span className="text-muted-foreground italic">
                  [No text content]
                </span>
              )}
              {attachedFiles.length > 0 && (
                <span className="text-muted-foreground text-xs ml-1">
                  (+{attachedFiles.length} file(s))
                </span>
              )}
            </div>
          ) : (
            <>
              {userContent ? (
                <pre className="whitespace-pre-wrap break-words mb-2">
                  {userContent}
                </pre>
              ) : (
                !attachedFiles.length && (
                  <span className="text-muted-foreground italic">
                    [No text content]
                  </span>
                )
              )}
              {attachedFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {attachedFiles.map((fileMeta) => (
                    // Pass the full metadata from the interaction's prompt
                    <FilePreviewRenderer
                      key={fileMeta.id}
                      fileMeta={fileMeta} // This now includes contentText/contentBase64
                      isReadOnly={true}
                      // onRemove is not needed for read-only
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
