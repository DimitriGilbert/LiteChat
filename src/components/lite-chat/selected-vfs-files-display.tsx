// src/components/lite-chat/selected-vfs-files-display.tsx
import React from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { XIcon, FileTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedVfsFilesDisplayProps {
  className?: string;
}

export const SelectedVfsFilesDisplay: React.FC<
  SelectedVfsFilesDisplayProps
> = ({ className }) => {
  const {
    selectedVfsPaths,
    removeSelectedVfsPath,
    isVfsEnabledForItem, // Get the flag
    vfs, // Get the vfs object
  } = useChatContext();

  // Only render if VFS is enabled for the item, the hook is ready, and paths are selected
  if (!isVfsEnabledForItem || !vfs.isReady || selectedVfsPaths.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50",
        className,
      )}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 w-full mb-1">
        Selected files for context:
      </p>
      {selectedVfsPaths.map((path) => (
        <div
          key={path}
          className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-md pl-2 pr-1 py-1 text-xs border border-gray-200 dark:border-gray-700 shadow-sm"
          title={path} // Show full path on hover
        >
          <FileTextIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="truncate max-w-[150px] font-mono">
            {path.startsWith("/") ? path.substring(1) : path}{" "}
            {/* Hide leading slash */}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 ml-1 flex-shrink-0"
            onClick={() => removeSelectedVfsPath(path)}
            aria-label={`Remove file ${path} from context`}
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
};
