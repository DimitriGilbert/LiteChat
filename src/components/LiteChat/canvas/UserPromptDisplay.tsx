// src/components/LiteChat/canvas/UserPromptDisplay.tsx
// FULL FILE
import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { PromptTurnObject } from "@/types/litechat/prompt";
import { FilePreviewRenderer } from "@/components/LiteChat/common/FilePreviewRenderer";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardIcon,
  CheckIcon,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { useSettingsStore } from "@/store/settings.store";
// Import markdown parser and types
import {
  useMarkdownParser,
} from "@/lib/litechat/useMarkdownParser";
import { UniversalBlockRenderer } from "@/components/LiteChat/common/UniversalBlockRenderer";
import type { AttachedFileMetadata } from "@/store/input.store";

interface UserPromptDisplayProps {
  turnData: Readonly<PromptTurnObject>;
  timestamp: Date | null;
  className?: string;
  isAssistantComplete?: boolean;
  interactionId?: string;
}

// Component to render files in a responsive grid
const FileGridDisplay: React.FC<{
  files: AttachedFileMetadata[];
  isReadOnly: boolean;
}> = ({ files, isReadOnly }) => {
  const [modalImage, setModalImage] = useState<null | { src: string; name: string }>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set());

  const toggleFold = (id: string) => {
    setFolded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!files.length) return null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
        {files.map((fileMeta) => {
          const isImage = fileMeta.type?.startsWith("image/");
          let previewUrl = undefined;
          if (isImage && fileMeta.contentBase64) {
            previewUrl = `data:${fileMeta.type};base64,${fileMeta.contentBase64}`;
          }
          const isFolded = folded.has(fileMeta.id);
          return (
            <div
              key={fileMeta.id}
              className="relative w-full h-32 sm:h-36 md:h-40 lg:h-48 xl:h-56 bg-muted/20 overflow-hidden rounded group flex items-center justify-center"
            >
              {/* Fold/Unfold button */}
              <button
                className="absolute top-1 right-1 z-10 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => { e.stopPropagation(); toggleFold(fileMeta.id); }}
                tabIndex={0}
                aria-label={isFolded ? "Unfold preview" : "Fold preview"}
              >
                {isFolded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
              </button>
              {/* Preview area */}
              {isImage && previewUrl ? (
                isFolded ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground opacity-60" />
                  </div>
                ) : (
                  <img
                    src={previewUrl}
                    alt={fileMeta.name}
                    className="w-full h-full object-cover rounded cursor-pointer"
                    draggable={false}
                    onClick={() => setModalImage({ src: previewUrl!, name: fileMeta.name })}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground">
                  <FilePreviewRenderer fileMeta={fileMeta} isReadOnly={isReadOnly} compact={true} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Modal for full image preview */}
      {modalImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setModalImage(null)}>
          <div className="max-w-3xl max-h-[90vh] p-4 bg-transparent flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={modalImage.src} alt={modalImage.name} className="max-w-full max-h-[80vh] rounded shadow-lg" />
            <div className="mt-2 text-white text-xs truncate w-full text-center">{modalImage.name}</div>
            <button className="mt-4 px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20" onClick={() => setModalImage(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

// Component to render parsed user content
const UserContentView: React.FC<{ markdownContent: string | null, interactionId?: string }> = ({
  markdownContent,
  interactionId,
}) => {
  const parsedContent = useMarkdownParser(markdownContent);

  if (!markdownContent?.trim()) {
    return null;
  }

  return (
    // Add overflow-wrap here for the main text content
    <div className="overflow-wrap-anywhere">
      {parsedContent.map((item, index) => {
        if (typeof item === "string") {
          return (
            <div
              key={`html-${index}`}
              // Apply markdown styles, but maybe slightly different for user prompts?
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: item }}
            />
          );
        } else if (item.type === "block") {
          // Always use UniversalBlockRenderer for all code blocks
          return (
            <UniversalBlockRenderer
              key={`block-${index}`}
              lang={item.lang}
              code={item.code}
              filepath={item.filepath}
              interactionId={interactionId}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export const UserPromptDisplay: React.FC<UserPromptDisplayProps> = React.memo(
  ({ turnData, timestamp, className, isAssistantComplete = true, interactionId }) => {
    const foldUserMessagesOnCompletion = useSettingsStore(
      (state) => state.foldUserMessagesOnCompletion,
    );

    const [isFolded, setIsFolded] = useState(
      isAssistantComplete && foldUserMessagesOnCompletion,
    );
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
      if (isAssistantComplete && foldUserMessagesOnCompletion) {
        setIsFolded(true);
      }
    }, [isAssistantComplete, foldUserMessagesOnCompletion]);

    const timeAgo = timestamp
      ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
      : "Sending...";

    const hasFiles =
      turnData.metadata?.attachedFiles &&
      turnData.metadata.attachedFiles.length > 0;
    const hasContent = turnData.content && turnData.content.trim().length > 0;

    const toggleFold = useCallback(() => setIsFolded((prev) => !prev), []);

    const handleCopy = useCallback(async () => {
      if (!turnData.content) return;
      try {
        await navigator.clipboard.writeText(turnData.content);
        setIsCopied(true);
        toast.success("User prompt copied!");
        setTimeout(() => setIsCopied(false), 1500);
      } catch (err) {
        toast.error("Failed to copy prompt.");
        console.error("Clipboard copy failed:", err);
      }
    }, [turnData.content]);

    // Memoize folded summary text
    const foldedSummaryText = useMemo(() => {
      let summary = "";
      if (hasContent) {
        summary += `"${turnData.content.substring(0, 50)}${turnData.content.length > 50 ? "..." : ""}"`;
      }
      if (hasContent && hasFiles) {
        summary += " + ";
      }
      if (hasFiles) {
        summary += `${turnData.metadata.attachedFiles?.length} file(s)`;
      }
      return summary || "[Empty Prompt]"; // Fallback if somehow both are false
    }, [hasContent, hasFiles, turnData.content, turnData.metadata]);

    return (
      <div
        className={cn(
          "user-prompt relative group/user overflow-wrap-anywhere",
          className,
        )}
      >
        <div
          className={cn(
            "flex flex-col sm:flex-row justify-between items-start mb-2 sticky top-0 bg-card/80 backdrop-blur-sm z-10 p-1 -m-1 rounded-t",
          )}
        >
          {/* Left Group: Icon, Name, Actions */}
          <div className="flex items-center gap-1 mb-1 sm:mb-0">
            <UserIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-primary mr-1">
              User
            </span>
            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/user:opacity-100 focus-within:opacity-100 transition-opacity">
              {hasContent && (
                <ActionTooltipButton
                  tooltipText="Copy Prompt"
                  onClick={handleCopy}
                  aria-label="Copy user prompt"
                  icon={
                    isCopied ? (
                      <CheckIcon className="text-green-500" />
                    ) : (
                      <ClipboardIcon />
                    )
                  }
                  className="h-5 w-5"
                />
              )}
              {(hasContent || hasFiles) && (
                <ActionTooltipButton
                  tooltipText={isFolded ? "Unfold" : "Fold"}
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold prompt" : "Fold prompt"}
                  icon={isFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
                  iconClassName="h-3.5 w-3.5"
                  className="h-5 w-5"
                />
              )}
            </div>
          </div>
          {/* Right Group: Timestamp */}
          <div className="flex items-center flex-shrink-0 self-end sm:self-start">
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
        </div>

        {!isFolded && (
          <>
            {hasFiles && (
              <div className="mb-3">
                <FileGridDisplay 
                  files={turnData.metadata.attachedFiles || []}
                  isReadOnly={true}
                />
              </div>
            )}
            {/* Use the new UserContentView component */}
            <UserContentView markdownContent={turnData.content} interactionId={interactionId} />
          </>
        )}
        {isFolded && (
          <div
            className="text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20 p-1 rounded"
            onClick={toggleFold}
          >
            {foldedSummaryText}
          </div>
        )}
      </div>
    );
  },
);
UserPromptDisplay.displayName = "UserPromptDisplay";
