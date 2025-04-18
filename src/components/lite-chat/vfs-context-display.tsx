// src/components/lite-chat/vfs-context-display.tsx
import React from "react";
import { FileTextIcon } from "lucide-react";

interface VfsContextDisplayProps {
  paths: string[] | null | undefined; // Allow null/undefined
}

export const VfsContextDisplay: React.FC<VfsContextDisplayProps> = React.memo(
  ({ paths }) => {
    if (!paths || paths.length === 0) {
      return null;
    }
    return (
      <div className="mt-2 pt-2 border-t border-gray-700/50 flex flex-wrap gap-x-3 gap-y-1">
        <span className="text-xs text-gray-500 font-medium w-full mb-0.5 select-none">
          Included context:
        </span>
        {paths.map((path) => (
          <div
            key={path}
            className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded"
            title={path}
          >
            <FileTextIcon className="h-3 w-3 flex-shrink-0" />
            <span className="font-mono truncate max-w-[200px]">
              {path.startsWith("/") ? path.substring(1) : path}
            </span>
          </div>
        ))}
      </div>
    );
  },
);
VfsContextDisplay.displayName = "VfsContextDisplay";
