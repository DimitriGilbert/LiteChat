// src/components/LiteChat/common/FilePreviewRenderer.tsx

import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FileTextIcon,
  ImageIcon,
  MusicIcon,
  VideoIcon,
  FileQuestionIcon,
  Loader2Icon,
  AlertCircleIcon,
  UploadCloudIcon,
  XIcon,
  ChevronsUpDownIcon,
  HardDriveIcon,
  DownloadIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UniversalBlockRenderer } from "./UniversalBlockRenderer";
import type { AttachedFileMetadata } from "@/store/input.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { formatBytes } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FilePreviewRendererProps {
  fileMeta: AttachedFileMetadata;
  onRemove?: (attachmentId: string) => void;
  isReadOnly?: boolean;
  compact?: boolean;
}

const MAX_TEXT_PREVIEW_SIZE = 1024 * 5;

const base64ToBlobUrl = (base64: string, mimeType: string): string | null => {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("Error creating blob URL from base64:", e);
    return null;
  }
};

const metadataToFile = (meta: AttachedFileMetadata): File | null => {
  let blob: Blob | null = null;
  if (meta.contentText !== undefined) {
    blob = new Blob([meta.contentText], { type: meta.type });
  } else if (meta.contentBase64 !== undefined) {
    try {
      const byteCharacters = atob(meta.contentBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: meta.type });
    } catch (e) {
      console.error("Failed to reconstruct file from base64:", e);
      return null;
    }
  }

  if (blob) {
    return new File([blob], meta.name, { type: meta.type });
  }

  console.error(
    `Failed to reconstruct file "${meta.name}": No content found in metadata.`,
  );
  return null;
};

// Constants and helper function moved to file-extensions.ts

export const FilePreviewRenderer: React.FC<FilePreviewRendererProps> = ({
  fileMeta,
  onRemove,
  isReadOnly = false,
  compact = false,
}) => {
  const { t } = useTranslation('common');
  const [previewContentUrl, setPreviewContentUrl] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isAddingToVfs, setIsAddingToVfs] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const mimeType = fileMeta.type || "application/octet-stream";
  const isText = isLikelyTextFile(fileMeta.name, mimeType);
  const isImage = mimeType.startsWith("image/");
  const isAudio = mimeType.startsWith("audio/");
  const isVideo = mimeType.startsWith("video/");
  const isVfsSource = fileMeta.source === "vfs";
  
  const [isFolded, setIsFolded] = useState(false);

  // Effect to handle preview generation for DIRECT uploads
  useEffect(() => {
    let objectUrl: string | null = null;
    setError(null);

    // Only generate blob URLs for non-text, direct uploads with base64 content
    if (fileMeta.source === "direct" && !isText && fileMeta.contentBase64) {
      objectUrl = base64ToBlobUrl(fileMeta.contentBase64, mimeType);
      if (!objectUrl) {
        setError(t('filePreview.decodeError'));
      }
      setPreviewContentUrl(objectUrl);
    } else {
      setPreviewContentUrl(null);
    }

    // Check for text preview size limit (only for direct uploads)
    if (
      fileMeta.source === "direct" &&
      isText &&
      fileMeta.contentText &&
      fileMeta.contentText.length > MAX_TEXT_PREVIEW_SIZE
    ) {
      setError(
        t('filePreview.tooLargeForPreview', { size: (fileMeta.size / 1024).toFixed(1) })
      );
    } else if (
      fileMeta.source === "direct" &&
      isText &&
      fileMeta.contentText === undefined
    ) {
      // This should ideally not happen if registerFileControl is correct
      setError(t('filePreview.missingContent'));
    }

    // Cleanup function for blob URLs
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setPreviewContentUrl(null);
      }
    };
    // Depend only on relevant fields for direct uploads
  }, [
    fileMeta.id,
    fileMeta.size,
    fileMeta.source,
    fileMeta.contentBase64,
    fileMeta.contentText,
    mimeType,
    isText,
    t
  ]);

  const handleAddToVfs = async () => {
    if (fileMeta.source === "vfs") {
      toast.info(t('filePreview.alreadyInVfs'));
      return;
    }
    const fileToAdd = metadataToFile(fileMeta);

    if (!fileToAdd) {
      toast.error(t('filePreview.reconstructError'));
      return;
    }

    setIsAddingToVfs(true);
    try {
      const targetPath = "/";
      await VfsOps.uploadFilesOp([fileToAdd], targetPath);
      toast.success(t('filePreview.addSuccess', { name: fileMeta.name }));
    } catch (err) {
      console.error("Failed to add file to VFS:", err);
      toast.error(t('filePreview.addFailed', { name: fileMeta.name }));
    } finally {
      setIsAddingToVfs(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      let blob: Blob;
      if (fileMeta.source === "vfs" && fileMeta.path) {
        const content = await VfsOps.readFileOp(fileMeta.path);
        blob = new Blob([content], { type: mimeType });
      } else {
        const file = metadataToFile(fileMeta);
        if (!file) throw new Error(t('filePreview.reconstructDownloadError'));
        blob = file;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileMeta.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download file:", err);
      toast.error(
        t('filePreview.downloadFailed', { error: err instanceof Error ? err.message : String(err) })
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleFold = () => setIsFolded((prev) => !prev);

  const renderIcon = () => {
    if (isVfsSource) return <HardDriveIcon className="h-5 w-5 text-cyan-500" />;
    if (isText) return <FileTextIcon className="h-5 w-5 text-blue-500" />;
    if (isImage) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    if (isAudio) return <MusicIcon className="h-5 w-5 text-green-500" />;
    if (isVideo) return <VideoIcon className="h-5 w-5 text-orange-500" />;
    return <FileQuestionIcon className="h-5 w-5 text-muted-foreground" />;
  };

  const renderPreview = () => {
    // No preview for VFS files in the prompt area
    if (isVfsSource) {
      return (
        <p className="p-2 text-xs text-muted-foreground italic">
          {t('filePreview.vfsAttached')}
        </p>
      );
    }

    // Handle errors first
    if (error) {
      return (
        <div className="p-2 text-xs text-destructive flex items-center gap-1">
          <AlertCircleIcon className="h-4 w-4" />
          <span>{error}</span>
        </div>
      );
    }

    // Render previews for DIRECT uploads based on type and available content
    if (isText && fileMeta.contentText !== undefined) {
      return (
        <UniversalBlockRenderer
          lang={mimeType === "text/markdown" ? "markdown" : "text"}
          code={fileMeta.contentText}
          filepath={fileMeta.name}
        />
      );
    } else if (isImage && previewContentUrl) {
      return (
        <img
          src={previewContentUrl}
          alt={fileMeta.name}
          className={compact 
            ? "w-full h-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" 
            : "max-w-full max-h-64 object-contain rounded"
          }
          onClick={compact ? () => setIsFolded(false) : undefined}
        />
      );
    } else if (isAudio && previewContentUrl) {
      return (
        <audio controls src={previewContentUrl} className="w-full">
          Your browser does not support the audio element.
        </audio>
      );
    } else if (isVideo && previewContentUrl) {
      return (
        <video
          controls
          src={previewContentUrl}
          className="max-w-full max-h-64 rounded"
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    // Fallback for direct uploads where content might be missing or type unsupported
    return (
      <p className="p-2 text-xs text-muted-foreground italic">
        Preview not available for this file type or content missing.
      </p>
    );
  };

  const foldedSummary = useMemo(() => {
    let typeLabel = "File";
    if (isVfsSource) typeLabel = "VFS File";
    else if (isText) typeLabel = "Text";
    else if (isImage) typeLabel = "Image";
    else if (isAudio) typeLabel = "Audio";
    else if (isVideo) typeLabel = "Video";
    return `${typeLabel} (${formatBytes(fileMeta.size)})`;
  }, [isVfsSource, isText, isImage, isAudio, isVideo, fileMeta.size]);

  return (
    <div className={cn(
      "border rounded-md overflow-hidden bg-card shadow-sm",
      compact ? "h-fit" : "my-1"
    )}>
      <div className={cn(
        "flex items-center justify-between bg-muted/30",
        compact ? "p-1.5 text-xs" : "p-2 border-b"
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {!compact && renderIcon()}
          <span className={cn(
            "font-medium truncate",
            compact ? "text-xs" : "text-sm"
          )} title={fileMeta.name}>
            {compact ? (fileMeta.name.length > 20 ? `${fileMeta.name.substring(0, 17)}...` : fileMeta.name) : fileMeta.name}
          </span>
          {!compact && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              ({formatBytes(fileMeta.size)})
            </span>
          )}
          {/* Show VFS path tooltip only if source is VFS */}
          {isVfsSource && fileMeta.path && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-cyan-400 truncate max-w-[100px]">
                    (VFS: {fileMeta.path})
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>From VFS: {fileMeta.path}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Download Button */}
          {!compact && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    aria-label="Download file"
                  >
                    {isDownloading ? (
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <DownloadIcon className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download File</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Fold/Unfold Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "text-muted-foreground hover:text-foreground",
                    compact ? "h-5 w-5" : "h-6 w-6"
                  )}
                  onClick={toggleFold}
                  aria-label={isFolded ? "Unfold preview" : "Fold preview"}
                >
                  <ChevronsUpDownIcon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isFolded ? "Unfold" : "Fold"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {!isReadOnly && onRemove && (
            <>
              {fileMeta.source === "direct" && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleAddToVfs}
                        disabled={isAddingToVfs}
                        aria-label="Add to VFS"
                      >
                        {isAddingToVfs ? (
                          <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UploadCloudIcon className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add to VFS</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive/80"
                      onClick={() => onRemove(fileMeta.id)}
                      aria-label="Remove file"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove from Prompt</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </div>
      {/* Conditionally render preview or folded summary */}
      {!isFolded ? (
        <div className={cn(
          compact ? "p-1" : "p-2",
          compact ? "h-40" : "max-h-80 overflow-y-auto"
        )}>
          {renderPreview()}
        </div>
      ) : compact && isImage ? (
        <div className="h-12 flex items-center justify-center bg-muted/30">
          {renderIcon()}
        </div>
      ) : (
        <div
          className={cn(
            "text-xs text-muted-foreground italic cursor-pointer hover:bg-muted/20",
            compact ? "p-1.5" : "p-2"
          )}
          onClick={toggleFold}
        >
          {foldedSummary}
        </div>
      )}
    </div>
  );
};
