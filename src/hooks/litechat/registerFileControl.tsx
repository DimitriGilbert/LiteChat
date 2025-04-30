// src/hooks/litechat/registerFileControl.tsx
// Entire file content provided
import React, { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { useInputStore } from "@/store/input.store";
import { useInteractionStore } from "@/store/interaction.store";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FilePreviewRenderer } from "@/components/LiteChat/common/FilePreviewRenderer";
// Import the helper from file-extensions
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function registerFileControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const FileControlTrigger: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addAttachedFile = useInputStore.getState().addAttachedFile;
    const isStreaming = useInteractionStore.getState().status === "streaming";

    const handleFileChange = useCallback(
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
          if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error(
              `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
            );
            continue;
          }

          try {
            // Initialize fileData object
            let fileData: {
              contentText?: string;
              contentBase64?: string;
            } = {};

            // Determine if it's likely text using the helper function
            const isText = isLikelyTextFile(file.name, file.type); // Use imported helper
            const isImage = file.type.startsWith("image/");

            if (isText) {
              // Read as text if the helper identifies it as text
              fileData.contentText = await file.text();
            } else if (isImage) {
              // Read as base64 ONLY if it's an image
              const reader = new FileReader();
              const promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
              });
              reader.readAsDataURL(file);
              const dataUrl = await promise;
              // Ensure dataUrl is not null and split correctly
              if (dataUrl && dataUrl.includes(",")) {
                fileData.contentBase64 = dataUrl.split(",")[1];
              } else {
                console.warn(
                  `Could not extract base64 from data URL for ${file.name}`,
                );
              }
            } else {
              // For other types, do not attempt to read content here
              console.log(
                `File type ${file.type} (Name: ${file.name}) not directly processed for content storage in InputStore.`,
              );
            }

            // Add to store with potentially populated contentText/contentBase64
            addAttachedFile({
              source: "direct",
              name: file.name,
              // Store the original browser-provided type, but content processing will use isLikelyTextFile
              type: file.type || "application/octet-stream",
              size: file.size,
              ...fileData, // Spread the potentially populated content fields
            });
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            toast.error(
              `Failed to process file "${file.name}": ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Reset file input
        if (event.target) {
          event.target.value = "";
        }
      },
      [addAttachedFile],
    );

    const handleButtonClick = () => {
      fileInputRef.current?.click();
    };

    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          disabled={isStreaming}
        />
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleButtonClick}
                disabled={isStreaming}
                className="h-8 w-8"
                aria-label="Attach Files"
              >
                <PaperclipIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Attach Files</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );
  };

  const FileControlPanel: React.FC = () => {
    // Read directly from the store within the component instance
    const { attachedFilesMetadata, removeAttachedFile } =
      useInputStore.getState();
    const isStreaming = useInteractionStore.getState().status === "streaming";

    if (attachedFilesMetadata.length === 0) {
      return null;
    }

    return (
      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
        {attachedFilesMetadata.map((fileMeta) => (
          <FilePreviewRenderer
            key={fileMeta.id}
            fileMeta={fileMeta}
            onRemove={removeAttachedFile}
            isReadOnly={isStreaming}
          />
        ))}
      </div>
    );
  };

  registerPromptControl({
    id: "core-file-attachment",
    order: 20,
    triggerRenderer: () => React.createElement(FileControlTrigger),
    renderer: () => React.createElement(FileControlPanel),
    // Metadata is handled by PromptWrapper reading from InputStore
    clearOnSubmit: () => {
      // InputStore.clearAttachedFiles is called by PromptWrapper
    },
    show: () => true, // Always show file attachment capability
  });

  console.log("[Function] Registered Core File Attachment Control");
  // No cleanup needed or returned
}
