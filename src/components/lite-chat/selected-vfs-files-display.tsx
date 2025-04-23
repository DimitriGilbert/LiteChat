
import React from "react";
import { Button } from "@/components/ui/button";
import { XIcon, FileTextIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectedVfsFilesDisplayProps {
  className?: string;
  selectedVfsPaths: string[];
  removeSelectedVfsPath: (path: string) => void;
  isVfsEnabledForItem: boolean;
  isVfsReady: boolean;
}

const SelectedVfsFilesDisplayComponent: React.FC<
  SelectedVfsFilesDisplayProps
> = ({
  className,
  selectedVfsPaths,
  removeSelectedVfsPath,
  isVfsEnabledForItem,
  isVfsReady,
}) => {
  if (!isVfsEnabledForItem || !isVfsReady || selectedVfsPaths.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 px-4 pt-3 pb-2 border-b border-border bg-background dark:bg-background/50",
        className,
      )}
    >
      <p className="text-xs font-medium text-muted-foreground w-full mb-1">
        Selected files for context:
      </p>
      {selectedVfsPaths.map((path) => (
        <div
          key={path}
          className="flex items-center gap-1.5 bg-card dark:bg-card rounded-md pl-2 pr-1 py-1 text-xs border border-border shadow-sm transition-all hover:shadow-md animate-fadeIn"
          title={path}
        >
          <FileTextIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="font-mono truncate max-w-[150px]">
            {path.startsWith("/") ? path.substring(1) : path}{" "}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-destructive transition-colors ml-1 flex-shrink-0"
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

export const SelectedVfsFilesDisplay = React.memo(
  SelectedVfsFilesDisplayComponent,
);
