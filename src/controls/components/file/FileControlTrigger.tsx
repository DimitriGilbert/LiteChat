// src/controls/components/file/FileControlTrigger.tsx
// FULL FILE
import React, { useRef, useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FileControlModule } from "@/controls/modules/FileControlModule";
import { useTranslation } from "react-i18next";

interface FileControlTriggerProps {
  module: FileControlModule;
}

export const FileControlTrigger: React.FC<FileControlTriggerProps> = ({
  module,
}) => {
  const { t } = useTranslation('prompt');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const isStreaming = module.getIsStreaming();
  const modelSupportsNonText = module.getModelSupportsNonText();

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      for (const file of Array.from(files)) {
        try {
          let fileData: {
            contentText?: string;
            contentBase64?: string;
          } = {};

          const isText = module.isLikelyTextFile(file.name, file.type);
          const isImage = file.type.startsWith("image/");

          if (isText) {
            fileData.contentText = await file.text();
          } else if (isImage && modelSupportsNonText) {
            const reader = new FileReader();
            const promise = new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (error) => reject(error);
            });
            reader.readAsDataURL(file);
            const dataUrl = await promise;
            if (dataUrl && dataUrl.includes(",")) {
              fileData.contentBase64 = dataUrl.split(",")[1];
            }
          }

          module.onFileAdd({
            source: "direct",
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            ...fileData,
          });
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          toast.error(
            t('fileControl.processingError', {
              fileName: file.name,
              error: error instanceof Error ? error.message : String(error)
            })
          );
        }
      }
      if (event.target) {
        event.target.value = "";
      }
    },
    [module, modelSupportsNonText, t]
  );

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const tooltipText = modelSupportsNonText
    ? t('fileControl.attachFilesWithImages')
    : t('fileControl.attachTextFiles');

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
