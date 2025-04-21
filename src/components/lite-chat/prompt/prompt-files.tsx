// src/components/lite-chat/prompt/prompt-files.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { XIcon, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Define props based on what PromptForm passes down
interface PromptFilesProps {
  className?: string;
  attachedFiles: File[];
  removeAttachedFile: (fileName: string) => void;
}

// Wrap component logic in a named function for React.memo
const PromptFilesComponent: React.FC<PromptFilesProps> = ({
  className,
  attachedFiles, // Use prop
  removeAttachedFile, // Use prop
}) => {
  // REMOVED store access

  if (attachedFiles.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50",
        className,
      )}
    >
      {attachedFiles.map((file) => {
        const isImage = file.type.startsWith("image/");
        const previewUrl = isImage ? URL.createObjectURL(file) : null;

        return (
          <div
            key={file.name}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-md p-2 text-xs border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            {isImage && previewUrl ? (
              <div className="h-10 w-10 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <FileIcon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            )}
            <div className="flex flex-col overflow-hidden">
              <span
                className="truncate text-ellipsis max-w-[120px] font-medium"
                title={file.name}
              >
                {file.name}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-red-600 dark:hover:text-red-400 ml-1 flex-shrink-0"
              onClick={() => removeAttachedFile(file.name)} // Use prop action
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

// Export the memoized component
export const PromptFiles = React.memo(PromptFilesComponent);
