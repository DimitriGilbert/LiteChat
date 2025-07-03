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
import { useMarkdownParser } from "@/lib/litechat/useMarkdownParser";
import { filterFileContentFromDisplay } from "@/lib/litechat/ai-helpers";
import { UniversalBlockRenderer } from "@/components/LiteChat/common/UniversalBlockRenderer";
import type { AttachedFileMetadata } from "@/store/input.store";
import { useTranslation } from "react-i18next";

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
  const [modalImage, setModalImage] = useState<null | {
    src: string;
    name: string;
  }>(null);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const { t } = useTranslation("canvas");

  const toggleFold = (id: string) => {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFold(fileMeta.id);
                }}
                tabIndex={0}
                aria-label={t(isFolded ? "unfoldPreview" : "foldPreview")}
              >
                {isFolded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronUpIcon className="h-4 w-4" />
                )}
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
                    onClick={() =>
                      setModalImage({ src: previewUrl!, name: fileMeta.name })
                    }
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground">
                  <FilePreviewRenderer
                    fileMeta={fileMeta}
                    isReadOnly={isReadOnly}
                    compact={true}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Modal for full image preview */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setModalImage(null)}
        >
          <div
            className="max-w-3xl max-h-[90vh] p-4 bg-transparent flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={modalImage.src}
              alt={modalImage.name}
              className="max-w-full max-h-[80vh] rounded shadow-lg"
            />
            <div className="mt-2 text-white text-xs truncate w-full text-center">
              {modalImage.name}
            </div>
            <button
              className="mt-4 px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20"
              onClick={() => setModalImage(null)}
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Component to render parsed user content
const UserContentView: React.FC<{
  markdownContent: string | null;
  interactionId?: string;
}> = ({ markdownContent, interactionId }) => {
  // Filter out file content for display (it's still sent to AI)
  const filteredContent = markdownContent
    ? filterFileContentFromDisplay(markdownContent)
    : markdownContent;
  const parsedContent = useMarkdownParser(filteredContent);

  if (!filteredContent?.trim()) {
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
  ({
    turnData,
    timestamp,
    className,
    isAssistantComplete = true,
    interactionId,
  }) => {
    const foldUserMessagesOnCompletion = useSettingsStore(
      (state) => state.foldUserMessagesOnCompletion
    );

    const [isFolded, setIsFolded] = useState(
      isAssistantComplete && foldUserMessagesOnCompletion
    );
    const [isCopied, setIsCopied] = useState(false);
    const { t } = useTranslation("canvas");

    useEffect(() => {
      if (isAssistantComplete && foldUserMessagesOnCompletion) {
        setIsFolded(true);
      }
    }, [isAssistantComplete, foldUserMessagesOnCompletion]);

    const timeAgo = timestamp
      ? formatDistanceToNow(new Date(timestamp), { addSuffix: true })
      : t("sending");

    const hasFiles =
      turnData.metadata?.attachedFiles &&
      turnData.metadata.attachedFiles.length > 0;
    const hasContent = turnData.content && turnData.content.trim().length > 0;

    const toggleFold = useCallback(() => setIsFolded((prev) => !prev), []);

    const handleCopy = useCallback(async () => {
      if (!turnData.content) return;
      try {
        // Copy filtered content without file content markers
        const filteredContent = filterFileContentFromDisplay(turnData.content);
        await navigator.clipboard.writeText(filteredContent);
        setIsCopied(true);
        toast.success(t("userPromptCopiedSuccess"));
        setTimeout(() => setIsCopied(false), 1500);
      } catch (err) {
        toast.error(t("failedToCopyPrompt"));
        console.error("Clipboard copy failed:", err);
      }
    }, [turnData.content, t]);

    // Memoize folded summary text
    const foldedSummaryText = useMemo(() => {
      let summary = "";
      if (hasContent) {
        // Filter file content from summary as well
        const filteredContent = turnData.content
          ? filterFileContentFromDisplay(turnData.content)
          : "";
        const summaryText = filteredContent.substring(0, 80);
        summary += `${t("promptLabel")}: "${summaryText}${
          filteredContent.length > 80 ? "..." : ""
        }"`;
      } else {
        summary += `${t("promptLabel")}: ${t("noContent")}`;
      }
      if (hasFiles) {
        summary += ` ${t("filesLabel")}: ${
          turnData.metadata?.attachedFiles?.length
        } file(s)`;
      } else {
        summary += ` ${t("filesLabel")}: ${t("noFiles")}`;
      }
      return summary;
    }, [
      hasContent,
      hasFiles,
      turnData.content,
      turnData.metadata?.attachedFiles?.length,
      t,
    ]);

    return (
      <div
        className={cn(
          "user-prompt relative group/user mb-4", // Main container
          "overflow-wrap-anywhere",
          className
        )}
      >
        {/* Header section */}
        <div
          className={cn(
            "flex flex-col sm:flex-row items-start justify-between gap-x-4"
          )}
        >
          {/* Left group: Icon, Name, Actions */}
          <div className="flex items-center gap-2 text-sm font-semibold text-secondary-foreground mb-2 sm:mb-0">
            <UserIcon className="h-5 w-5" />
            <span>{t("userPromptLabel", "You")}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover/user:opacity-100 focus-within:opacity-100 transition-opacity">
              <ActionTooltipButton
                tooltipText={isFolded ? t("unfoldPreview") : t("foldPreview")}
                onClick={toggleFold}
                aria-label={isFolded ? t("unfoldPreview") : t("foldPreview")}
                icon={isFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
              />
              <ActionTooltipButton
                tooltipText={t("copyPrompt")}
                onClick={handleCopy}
                aria-label={t("copyPrompt")}
                icon={
                  isCopied ? (
                    <CheckIcon className="text-green-500" />
                  ) : (
                    <ClipboardIcon />
                  )
                }
              />
            </div>
          </div>
          {/* Right group: Timestamp */}
          <div className="text-xs text-muted-foreground self-start sm:self-center">
            {timeAgo}
          </div>
        </div>

        {/* Content section */}
        <div className={cn("pl-7 mt-1", { "sr-only": isFolded })}>
          {hasFiles && (
            <div className="mb-2">
              <FileGridDisplay
                files={turnData.metadata!.attachedFiles!}
                isReadOnly={!isAssistantComplete}
              />
            </div>
          )}
          {hasContent && (
            <UserContentView
              markdownContent={turnData.content}
              interactionId={interactionId}
            />
          )}
        </div>

        {/* Folded Summary View */}
        {isFolded && (
          <div className="pl-7 mt-1 text-sm text-muted-foreground italic truncate">
            {foldedSummaryText}
          </div>
        )}
      </div>
    );
  }
);
UserPromptDisplay.displayName = "UserPromptDisplay";
