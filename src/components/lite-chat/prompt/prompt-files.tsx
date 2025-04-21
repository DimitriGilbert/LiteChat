// src/components/lite-chat/prompt/prompt-files.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { XIcon, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromptFilesProps {
  className?: string;
  attachedFiles: File[];
  removeAttachedFile: (fileName: string) => void;
}

const PromptFilesComponent: React.FC<PromptFilesProps> = ({
  className,
  attachedFiles,
  removeAttachedFile,
}) => {
  if (attachedFiles.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-border bg-background dark:bg-background/50",
        className,
      )}
    >
      {attachedFiles.map((file) => {
        const isImage = file.type.startsWith("image/");
        const previewUrl = isImage ? URL.createObjectURL(file) : null;

        return (
          <div
            key={file.name}
            className="flex items-center gap-2 bg-card dark:bg-card rounded-md p-2 text-xs border border-border shadow-sm transition-all hover:shadow-md animate-fadeIn"
          >
            {isImage && previewUrl ? (
              <div className="h-10 w-10 rounded bg-muted overflow-hidden flex items-center justify-center flex-shrink-0">
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <div className="flex flex-col overflow-hidden">
              <span
                className="truncate text-ellipsis max-w-[120px] font-medium"
                title={file.name}
              >
                {file.name}
              </span>
              <span className="text-muted-foreground text-[10px]">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors ml-1 flex-shrink-0"
              onClick={() => removeAttachedFile(file.name)}
              aria-label={`Remove file ${file.name}`}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
};

export const PromptFiles = React.memo(PromptFilesComponent);
