// src/components/LiteChat/canvas/UserPromptDisplay.tsx
import React, { useState, useCallback, useMemo } from "react";
import type { Interaction } from "@/types/litechat/interaction";
import { cn } from "@/lib/utils";
import {
  UserIcon,
  ClipboardIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  EditIcon,
  CopyIcon,
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
import type { AttachedFileMetadata } from "@/store/input.store";
// Import markdown parser and renderer
import {
  useMarkdownParser,
  type ParsedContent,
} from "@/lib/litechat/useMarkdownParser";
import { CodeBlockRenderer } from "@/components/LiteChat/common/CodeBlockRenderer";

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
  const [isIdCopied, setIsIdCopied] = useState(false);

  const userContent =
    interaction.prompt?.content &&
    typeof interaction.prompt.content === "string"
      ? interaction.prompt.content
      : "";

  // Parse user content for markdown
  const parsedUserContent: ParsedContent = useMarkdownParser(userContent);

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
        {/* Apply markdown-content class for styling */}
        <div className="text-sm markdown-content">
          {isFolded ? (
            <div
              className="folded-content-preview cursor-pointer"
              onClick={toggleFold}
            >
              {userContent ? (
                // Render folded preview as plain text (pre preserves whitespace)
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
              {userContent
                ? // Render parsed markdown content
                  parsedUserContent.map((part, index) => {
                    if (typeof part === "string") {
                      return (
                        <div
                          key={index}
                          dangerouslySetInnerHTML={{ __html: part }}
                        />
                      );
                    } else if (part.type === "code") {
                      return (
                        <CodeBlockRenderer
                          key={index}
                          lang={part.lang}
                          code={part.code}
                        />
                      );
                    }
                    return null;
                  })
                : !attachedFiles.length && (
                    <span className="text-muted-foreground italic">
                      [No text content]
                    </span>
                  )}
              {attachedFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {attachedFiles.map((fileMeta) => (
                    <FilePreviewRenderer
                      key={fileMeta.id}
                      fileMeta={fileMeta}
                      isReadOnly={true}
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
