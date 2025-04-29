// src/hooks/litechat/registerFileControl.ts
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
            let fileData: {
              contentText?: string;
              contentBase64?: string;
            } = {};
            const isText = file.type.startsWith("text/");
            const isImage = file.type.startsWith("image/");

            if (isText) {
              fileData.contentText = await file.text();
            } else if (isImage) {
              const reader = new FileReader();
              const promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
              });
              reader.readAsDataURL(file);
              const dataUrl = await promise;
              fileData.contentBase64 = dataUrl.split(",")[1]; // Extract base64 part
            } else {
              // For other types, maybe just store metadata or handle differently
              // For now, we'll skip adding content for non-text/non-image
              console.log(
                `File type ${file.type} not directly processed for content.`,
              );
            }

            addAttachedFile({
              source: "direct",
              name: file.name,
              type: file.type,
              size: file.size,
              ...fileData,
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
    // status: () => "ready", // Removed status
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
