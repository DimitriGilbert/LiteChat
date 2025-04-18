// src/components/lite-chat/prompt-files.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { XIcon, FileIcon } from "lucide-react"; // Icons
import { cn } from "@/lib/utils";

interface PromptFilesProps {
  className?: string;
  attachedFiles: File[]; // Add prop
  removeAttachedFile: (fileName: string) => void; // Add prop
}
export const PromptFiles: React.FC<PromptFilesProps> = ({
  className,
  attachedFiles, // Use prop
  removeAttachedFile, // Use prop
}) => {
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
        // Check if file is an image
        const isImage = file.type.startsWith("image/");

        return (
          <div
            key={file.name}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-md p-2 text-xs border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            {isImage ? (
              <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <FileIcon className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            )}
            <div className="flex flex-col">
              <span className="truncate max-w-[120px] font-medium">
                {file.name}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-500 hover:text-red-600 dark:hover:text-red-400 ml-1"
              onClick={() => removeAttachedFile(file.name)} // Use prop
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
