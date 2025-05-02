// src/hooks/litechat/registerFileControl.tsx

import React, { useRef, useCallback, useMemo } from "react";
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
import { useShallow } from "zustand/react/shallow";
import {
  createAiModelConfig,
  splitModelId,
} from "@/lib/litechat/provider-helpers"; // Import helper

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function registerFileControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const FileControlTrigger: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const addAttachedFile = useInputStore.getState().addAttachedFile;
    const isStreaming = useInteractionStore.getState().status === "streaming";

    // Select primitive/stable values needed for computation
    const { selectedModelId, dbProviderConfigs, dbApiKeys } = useProviderStore(
      useShallow((state) => ({
        selectedModelId: state.selectedModelId,
        dbProviderConfigs: state.dbProviderConfigs,
        dbApiKeys: state.dbApiKeys,
      })),
    );

    // Compute selectedModel *inside* useMemo based on stable IDs/configs
    const selectedModel = useMemo(() => {
      if (!selectedModelId) return undefined;
      const { providerId, modelId: specificModelId } =
        splitModelId(selectedModelId);
      if (!providerId || !specificModelId) return undefined;
      const config = dbProviderConfigs.find((p) => p.id === providerId);
      if (!config) return undefined;
      const apiKeyRecord = dbApiKeys.find((k) => k.id === config.apiKeyId);
      return createAiModelConfig(config, specificModelId, apiKeyRecord?.value);
    }, [selectedModelId, dbProviderConfigs, dbApiKeys]); // Depend on stable values/arrays

    // Determine if file input should be allowed based on computed model metadata
    const allowFileInput = useMemo(() => {
      const inputModalities =
        selectedModel?.metadata?.architecture?.input_modalities;
      // If no model selected or modalities unknown, allow by default
      if (!inputModalities) return true;
      // Allow if it supports anything other than just text
      return inputModalities.some((mod) => mod !== "text");
    }, [selectedModel]); // Depend on the computed model

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

            const isText = isLikelyTextFile(file.name, file.type);
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
              if (dataUrl && dataUrl.includes(",")) {
                fileData.contentBase64 = dataUrl.split(",")[1];
              } else {
                console.warn(
                  `Could not extract base64 from data URL for ${file.name}`,
                );
              }
            } else {
              console.log(
                `File type ${file.type} (Name: ${file.name}) not directly processed for content storage in InputStore.`,
              );
            }

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
      [addAttachedFile],
    );

    const handleButtonClick = () => {
      fileInputRef.current?.click();
    };

    const tooltipText = allowFileInput
      ? "Attach Files"
      : "File input not supported by this model";

    return (
      <>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          disabled={isStreaming || !allowFileInput} // Disable based on modality
        />
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleButtonClick}
                disabled={isStreaming || !allowFileInput} // Disable based on modality
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

  const FileControlPanel: React.FC = () => {
    const { attachedFilesMetadata, removeAttachedFile } = useInputStore(
      useShallow((state) => ({
        attachedFilesMetadata: state.attachedFilesMetadata,
        removeAttachedFile: state.removeAttachedFile,
      })),
    );
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
    clearOnSubmit: () => {
      // InputStore.clearAttachedFiles is called by PromptWrapper
    },
    show: () => true, // Control visibility based on model capability inside the trigger
  });

  console.log("[Function] Registered Core File Attachment Control");
}
