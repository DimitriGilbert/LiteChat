// src/hooks/litechat/registerFileControl.tsx
// FULL FILE
import React, { useRef, useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { useInputStore } from "@/store/input.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useProviderStore } from "@/store/provider.store";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FilePreviewRenderer } from "@/components/LiteChat/common/FilePreviewRenderer";
import { isLikelyTextFile } from "@/lib/litechat/file-extensions";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import type { AttachedFileMetadata } from "@/store/input.store";

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// --- Trigger Component ---
const FileControlTrigger: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addAttachedFile = useInputStore.getState().addAttachedFile;

  // Local state managed by events
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  // State to track if the current model supports non-text input
  const [modelSupportsNonText, setModelSupportsNonText] = useState(true);

  // Subscribe to events
  useEffect(() => {
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };

    const handleModelChange = (payload: { modelId: string | null }) => {
      if (!payload.modelId) {
        setModelSupportsNonText(false);
        return;
      }
      const { getSelectedModel } = useProviderStore.getState();
      const selectedModel = getSelectedModel();
      const inputModalities =
        selectedModel?.metadata?.architecture?.input_modalities;
      // Check if *any* modality other than 'text' is present
      setModelSupportsNonText(
        !inputModalities || inputModalities.some((mod) => mod !== "text"),
      );
    };

    // Initial check
    handleModelChange({ modelId: useProviderStore.getState().selectedModelId });

    // Subscriptions
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    emitter.on(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);

    // Cleanup
    return () => {
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
      emitter.off(ModEvent.MODEL_SELECTION_CHANGED, handleModelChange);
    };
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      // Get current model support status inside the handler
      const currentModelSupportsNonText = modelSupportsNonText;

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(
            `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
          );
          continue;
        }

        const isText = isLikelyTextFile(file.name, file.type);
        const isImage = file.type.startsWith("image/");

        // Check if the file type is allowed
        if (!isText && !currentModelSupportsNonText) {
          toast.warning(
            `File "${file.name}" (${file.type}) cannot be uploaded. The current model only supports text input.`,
          );
          continue;
        }

        try {
          let fileData: {
            contentText?: string;
            contentBase64?: string;
          } = {};

          if (isText) {
            fileData.contentText = await file.text();
          } else if (isImage) {
            // Only process image if non-text is supported
            const reader = new FileReader();
            const promise = new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (error) => reject(error);
            });
            reader.readAsDataURL(file);
            const dataUrl = await promise;
            if (dataUrl && dataUrl.includes(",")) {
              fileData.contentBase64 = dataUrl.split(",")[1];
            } else {
              console.warn(
                `Could not extract base64 from data URL for ${file.name}`,
              );
            }
          } else {
            // Handle other non-text types if supported (e.g., audio, video in future)
            // For now, just log if it's not text/image but non-text is allowed
            if (currentModelSupportsNonText) {
              console.log(
                `File type ${file.type} (Name: ${file.name}) not directly processed for content storage, but model supports non-text.`,
              );
              // Potentially read as base64 for generic handling if needed later
            }
          }

          // This action will emit ATTACHED_FILES_CHANGED
          addAttachedFile({
            source: "direct",
            name: file.name,
            type: file.type || "application/octet-stream",
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

      if (event.target) {
        event.target.value = "";
      }
    },
    [addAttachedFile, modelSupportsNonText],
  );

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const tooltipText = modelSupportsNonText
    ? "Attach Files (Text, Images, etc.)"
    : "Attach Text Files";

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
        // Accept all files initially, filter in handleFileChange
        // accept={modelSupportsNonText ? undefined : "text/*,.md,.json,..."} // Example: restrict accept if needed
        disabled={isStreaming} // Only disable based on streaming status
      />
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleButtonClick}
              disabled={isStreaming} // Only disable based on streaming status
              className="h-8 w-8"
              aria-label={tooltipText}
            >
              <PaperclipIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
};

// --- Panel Component ---
const FileControlPanel: React.FC = () => {
  // Get remove action from store
  const removeAttachedFile = useInputStore.getState().removeAttachedFile;

  // Local state managed by events
  const [attachedFilesMetadata, setAttachedFilesMetadata] = useState<
    AttachedFileMetadata[]
  >(() => useInputStore.getState().attachedFilesMetadata);
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );

  // Subscribe to events
  useEffect(() => {
    const handleFilesChanged = (payload: { files: AttachedFileMetadata[] }) => {
      setAttachedFilesMetadata(payload.files);
    };
    const handleStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };

    // Subscriptions
    emitter.on(ModEvent.ATTACHED_FILES_CHANGED, handleFilesChanged);
    emitter.on(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);

    // Cleanup
    return () => {
      emitter.off(ModEvent.ATTACHED_FILES_CHANGED, handleFilesChanged);
      emitter.off(ModEvent.INTERACTION_STATUS_CHANGED, handleStatusChange);
    };
  }, []);

  if (attachedFilesMetadata.length === 0) {
    return null;
  }

  return (
    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
      {attachedFilesMetadata.map((fileMeta) => (
        <FilePreviewRenderer
          key={fileMeta.id}
          fileMeta={fileMeta}
          onRemove={removeAttachedFile} // Pass store action directly
          isReadOnly={isStreaming}
        />
      ))}
    </div>
  );
};

// --- Registration Function ---
export function registerFileControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-file-attachment",
    triggerRenderer: () => React.createElement(FileControlTrigger),
    renderer: () => React.createElement(FileControlPanel),
  });

  console.log("[Function] Registered Core File Attachment Control");
}
