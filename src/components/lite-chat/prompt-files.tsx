import React from "react";
import { useChatContext } from "@/context/chat-context";
import { Button } from "@/components/ui/button";
import { XIcon, FileIcon } from "lucide-react"; // Icons

interface PromptFilesProps {
  className?: string;
}

export const PromptFiles: React.FC<PromptFilesProps> = ({ className }) => {
  const { attachedFiles, removeAttachedFile } = useChatContext();

  if (attachedFiles.length === 0) {
    return null; // Don't render anything if no files
  }

  return (
    <div
      className={`flex flex-wrap gap-2 px-3 pt-2 border-b pb-2 ${className}`}
    >
      {attachedFiles.map((file) => (
        <div
          key={file.name}
          className="flex items-center gap-1.5 bg-muted rounded-md p-1.5 text-xs"
        >
          <FileIcon className="h-3 w-3 flex-shrink-0" />
          <span className="truncate max-w-[100px]">{file.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 text-muted-foreground hover:text-destructive"
            onClick={() => removeAttachedFile(file.name)}
            aria-label={`Remove file ${file.name}`}
          >
            <XIcon className="h-3 w-3" />
          </Button>
          {/* TODO: Add image preview for image files */}
        </div>
      ))}
    </div>
  );
};
