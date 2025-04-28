// src/components/LiteChat/common/FilePreviewRenderer.tsx
import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeBlockRenderer } from "./CodeBlockRenderer";
import type { AttachedFileMetadata } from "@/store/input.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { formatBytes } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FilePreviewRendererProps {
  fileMeta: AttachedFileMetadata;
  onRemove?: (attachmentId: string) => void;
  isReadOnly?: boolean;
}

const MAX_TEXT_PREVIEW_SIZE = 1024 * 5; // 5 KB limit for text preview

// Helper to convert base64 string back to Blob URL for media previews
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

// Helper to reconstruct File object from metadata
// Ensures content is correctly handled
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

// --- Added Text Detection Logic ---
const COMMON_TEXT_EXTENSIONS_PREVIEW = [
  ".txt",
  ".md",
  ".json",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".html",
  ".css",
  ".py",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".cs",
  ".go",
  ".php",
  ".rb",
  ".swift",
  ".kt",
  ".rs",
  ".toml",
  ".yaml",
  ".yml",
  ".xml",
  ".sh",
  ".bat",
  ".ps1",
];

const isLikelyTextFilePreview = (name: string, mimeType?: string): boolean => {
  const fileNameLower = name.toLowerCase();
  if (mimeType?.startsWith("text/") || mimeType === "application/json") {
    return true;
  }
  return COMMON_TEXT_EXTENSIONS_PREVIEW.some((ext) =>
    fileNameLower.endsWith(ext),
  );
};
// --- End Text Detection Logic ---

export const FilePreviewRenderer: React.FC<FilePreviewRendererProps> = ({
  fileMeta,
  onRemove,
  isReadOnly = false,
}) => {
  const [previewContentUrl, setPreviewContentUrl] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isAddingToVfs, setIsAddingToVfs] = useState(false);

  // Determine type based on stored metadata and improved logic
  const mimeType = fileMeta.type || "application/octet-stream";
  const isText = isLikelyTextFilePreview(fileMeta.name, mimeType);
  const isImage = mimeType.startsWith("image/");
  const isAudio = mimeType.startsWith("audio/");
  const isVideo = mimeType.startsWith("video/");

  // Effect to generate Blob URL for media types from base64
  useEffect(() => {
    let objectUrl: string | null = null;
    setError(null); // Reset error on meta change

    if (!isText && fileMeta.contentBase64) {
      objectUrl = base64ToBlobUrl(fileMeta.contentBase64, mimeType);
      if (!objectUrl) {
        setError("Failed to decode file content for preview.");
      }
      setPreviewContentUrl(objectUrl);
    } else {
      setPreviewContentUrl(null); // Clear URL if it's text or has no base64
    }

    // Cleanup function
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setPreviewContentUrl(null);
      }
    };
  }, [fileMeta.contentBase64, mimeType, isText]); // Depend on base64 content and type

  // Check text size limit using stored content
  useEffect(() => {
    if (
      isText &&
      fileMeta.contentText &&
      fileMeta.contentText.length > MAX_TEXT_PREVIEW_SIZE
    ) {
      setError(
        `Text file too large for preview (${(fileMeta.size / 1024).toFixed(1)} KB).`,
      );
    } else if (isText && fileMeta.contentText === undefined) {
      // Content should always be present now, but handle defensively
      setError("Text content missing from metadata.");
    }
  }, [fileMeta.contentText, fileMeta.size, isText]);

  const handleAddToVfs = async () => {
    if (fileMeta.source === "vfs") {
      toast.info("File is already in VFS.");
      return;
    }
    const fileToAdd = metadataToFile(fileMeta); // Use the corrected helper

    if (!fileToAdd) {
      toast.error("Cannot add to VFS: Failed to reconstruct file data.");
      return;
    }

    setIsAddingToVfs(true);
    try {
      // Assuming VFS root for simplicity, adjust if needed
      const targetPath = "/";
      await VfsOps.uploadFilesOp([fileToAdd], targetPath);
      toast.success(`"${fileMeta.name}" added to VFS root.`);
      // Optionally, update the fileMeta source in the input store if needed
      // This would require passing an update function from the parent
    } catch (err) {
      console.error("Failed to add file to VFS:", err);
      toast.error(`Failed to add "${fileMeta.name}" to VFS.`);
    } finally {
      setIsAddingToVfs(false);
    }
  };

  const renderIcon = () => {
    if (isText) return <FileTextIcon className="h-5 w-5 text-blue-500" />;
    if (isImage) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    if (isAudio) return <MusicIcon className="h-5 w-5 text-green-500" />;
    if (isVideo) return <VideoIcon className="h-5 w-5 text-orange-500" />;
    return <FileQuestionIcon className="h-5 w-5 text-muted-foreground" />;
  };

  const renderPreview = () => {
    if (error) {
      return (
        <div className="p-2 text-xs text-destructive flex items-center gap-1">
          <AlertCircleIcon className="h-4 w-4" />
          <span>{error}</span>
        </div>
      );
    }

    // Render based on type and available content from fileMeta
    if (isText && fileMeta.contentText !== undefined) {
      return (
        <CodeBlockRenderer
          lang={mimeType === "text/markdown" ? "markdown" : "text"}
          code={fileMeta.contentText}
        />
      );
    } else if (isImage && previewContentUrl) {
      return (
        <img
          src={previewContentUrl}
          alt={fileMeta.name}
          className="max-w-full max-h-64 object-contain rounded"
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

    // Fallback if no preview could be generated or type not supported
    return (
      <p className="p-2 text-xs text-muted-foreground italic">
        Preview not available for this file type or content missing.
      </p>
    );
  };

  return (
    <div className="border rounded-md overflow-hidden bg-card shadow-sm my-2">
      <div className="flex items-center justify-between p-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          {renderIcon()}
          <span className="text-sm font-medium truncate" title={fileMeta.name}>
            {fileMeta.name}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            ({formatBytes(fileMeta.size)})
          </span>
          {fileMeta.source === "vfs" && fileMeta.path && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-blue-400 truncate max-w-[100px]">
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
        {!isReadOnly && onRemove && (
          <div className="flex items-center gap-1 flex-shrink-0">
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
          </div>
        )}
      </div>
      <div className={cn("p-2 max-h-80 overflow-y-auto")}>
        {renderPreview()}
      </div>
    </div>
  );
};
