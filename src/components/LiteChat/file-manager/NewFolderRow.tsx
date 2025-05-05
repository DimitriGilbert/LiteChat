// src/components/LiteChat/file-manager/NewFolderRow.tsx

import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FolderIcon, CheckIcon, XIcon, Loader2Icon } from "lucide-react";

interface NewFolderRowProps {
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  handleCreateFolder: () => void;
  cancelCreatingFolder: () => void;
  newFolderInputRef: React.RefObject<HTMLInputElement | null>;
  isOperationLoading: boolean;
  isMobile?: boolean;
}

export const NewFolderRow: React.FC<NewFolderRowProps> = ({
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  cancelCreatingFolder,
  newFolderInputRef,
  isOperationLoading,
  isMobile = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCreateFolder();
    } else if (e.key === "Escape") {
      cancelCreatingFolder();
    }
  };

  // If mobile, render a simpler div structure instead of TableRow/TableCell
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 p-1">
        <FolderIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
        <Input
          ref={newFolderInputRef}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onBlur={handleCreateFolder}
          onKeyDown={handleKeyDown}
          className="h-7 px-2 py-1 text-sm bg-input border-border focus:ring-1 focus:ring-primary flex-grow"
          placeholder="New folder name"
          disabled={isOperationLoading}
        />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-500 hover:text-green-400"
            onClick={handleCreateFolder}
            aria-label="Create folder"
            disabled={isOperationLoading || !newFolderName.trim()}
          >
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <CheckIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={cancelCreatingFolder}
            aria-label="Cancel create folder"
            disabled={isOperationLoading}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Desktop Table Row rendering
  return (
    <TableRow className="bg-muted/30">
      <TableCell className="px-2 py-1">
        {/* Placeholder for checkbox */}
      </TableCell>
      <TableCell className="px-2 py-1">
        <FolderIcon className="h-5 w-5 text-yellow-400" />
      </TableCell>
      <TableCell className="py-1 px-2" colSpan={3}>
        <Input
          ref={newFolderInputRef}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onBlur={handleCreateFolder} // Consider if onBlur is the best trigger
          onKeyDown={handleKeyDown}
          className="h-7 px-2 py-1 text-sm bg-input border-border focus:ring-1 focus:ring-primary w-full"
          placeholder="New folder name"
          disabled={isOperationLoading}
        />
      </TableCell>
      <TableCell className="text-right pr-4 py-1">
        <div className="flex items-center justify-end gap-0.5">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-500 hover:text-green-400"
                  onClick={handleCreateFolder}
                  aria-label="Create folder"
                  disabled={isOperationLoading || !newFolderName.trim()}
                >
                  {isOperationLoading ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Create (Enter)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={cancelCreatingFolder}
                  aria-label="Cancel create folder"
                  disabled={isOperationLoading}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Cancel (Esc)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
};
