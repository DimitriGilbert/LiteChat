// src/components/LiteChat/file-manager/FileManagerRow.tsx
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderIcon,
  FileIcon,
  DownloadIcon,
  Trash2Icon,
  EditIcon,
  CheckIcon,
  XIcon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  GitMergeIcon,
  InfoIcon,
  FolderGitIcon, // Use FolderGitIcon
  Loader2Icon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/litechat/file-manager-utils";
import type { VfsNode } from "@/types/litechat/vfs";

interface FileManagerRowProps {
  entry: VfsNode;
  isEditingThis: boolean;
  isChecked: boolean;
  isGitRepo: boolean; // Receive git status
  newName: string;
  isOperationLoading: boolean; // Combined loading state
  creatingFolder: boolean;
  handleNavigate: (entry: VfsNode) => void;
  handleCheckboxChange: (checked: boolean, path: string) => void;
  startEditing: (entry: VfsNode) => void;
  cancelEditing: () => void;
  handleRename: () => void;
  handleDownload: (entry: VfsNode) => void;
  handleDelete: (entry: VfsNode) => void;
  setNewName: (name: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  // Git actions
  handleGitInit: (path: string) => void;
  handleGitPull: (path: string) => void;
  handleGitCommit: (path: string) => void;
  handleGitPush: (path: string) => void;
  handleGitStatus: (path: string) => void;
}

export const FileManagerRow: React.FC<FileManagerRowProps> = ({
  entry,
  isEditingThis,
  isChecked,
  isGitRepo, // Use git status
  newName,
  isOperationLoading, // Use combined loading
  creatingFolder,
  handleNavigate,
  handleCheckboxChange,
  startEditing,
  cancelEditing,
  handleRename,
  handleDownload,
  handleDelete,
  setNewName,
  renameInputRef,
  // Receive git handlers
  handleGitInit,
  handleGitPull,
  handleGitCommit,
  handleGitPush,
  handleGitStatus,
}) => {
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    if (
      (e.target as HTMLElement).closest(
        'input[type="checkbox"], button, input[type="text"], [data-radix-context-menu-trigger]',
      )
    ) {
      return;
    }
    if (!isEditingThis && !isOperationLoading) {
      handleNavigate(entry);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const isDirectory = entry.type === "folder";

  // Use FolderGitIcon if it's a directory and a git repo
  const Icon = isDirectory
    ? isGitRepo
      ? FolderGitIcon
      : FolderIcon
    : FileIcon;
  const iconColor = isDirectory
    ? isGitRepo
      ? "text-green-400" // Git repo color
      : "text-yellow-400"
    : "text-blue-400";

  const rowContent = (
    <TableRow
      key={entry.path}
      className={cn(
        "group hover:bg-muted/50",
        isEditingThis && "bg-muted ring-1 ring-primary",
        isOperationLoading && "opacity-70 cursor-not-allowed",
      )}
      onClick={handleRowClick}
      onDoubleClick={() =>
        !isOperationLoading && !isEditingThis && handleNavigate(entry)
      }
    >
      <TableCell className="px-2 py-1">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) =>
            handleCheckboxChange(!!checked, entry.path)
          }
          aria-label={`Select ${entry.name}`}
          className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          disabled={isOperationLoading}
        />
      </TableCell>
      <TableCell className="px-2 py-1">
        <Icon className={cn("h-5 w-5", iconColor)} />
      </TableCell>
      <TableCell className="py-1 px-2">
        {isEditingThis ? (
          <Input
            ref={renameInputRef as React.RefObject<HTMLInputElement>}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="h-7 px-2 py-1 text-sm bg-input border-border focus:ring-1 focus:ring-primary w-full"
            onClick={(e) => e.stopPropagation()}
            disabled={isOperationLoading}
          />
        ) : (
          <span
            className={cn(
              "truncate",
              isDirectory && "cursor-pointer hover:underline",
            )}
            title={entry.name}
            onClick={(e) => {
              if (isDirectory) {
                e.stopPropagation();
                handleNavigate(entry);
              }
            }}
          >
            {entry.name}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right py-1 px-2 text-xs text-muted-foreground">
        {entry.type === "file" && entry.size !== undefined
          ? formatBytes(entry.size)
          : ""}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground py-1 px-2">
        {new Date(entry.lastModified).toLocaleString()}
      </TableCell>
      <TableCell className="text-right pr-4 py-1">
        <div
          className={cn(
            "flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity",
            isEditingThis && "opacity-100",
            isOperationLoading && "opacity-30",
          )}
        >
          {isEditingThis ? (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-green-500 hover:text-green-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename();
                      }}
                      aria-label="Save name"
                      disabled={isOperationLoading || !newName.trim()}
                    >
                      {isOperationLoading ? (
                        <Loader2Icon className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Save (Enter)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditing();
                      }}
                      aria-label="Cancel edit"
                      disabled={isOperationLoading}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Cancel (Esc)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(entry);
                      }}
                      aria-label="Rename"
                      disabled={isOperationLoading || creatingFolder}
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Rename</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(entry);
                      }}
                      aria-label={
                        isDirectory ? "Download folder as ZIP" : "Download file"
                      }
                      disabled={isOperationLoading}
                    >
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {isDirectory ? "Download folder (.zip)" : "Download file"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(entry);
                      }}
                      aria-label={`Delete ${isDirectory ? "folder" : "file"}`}
                      disabled={isOperationLoading}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  // Context Menu for Folders
  if (isDirectory) {
    return (
      <ContextMenu key={entry.path}>
        <ContextMenuTrigger
          disabled={isEditingThis || isOperationLoading}
          asChild
        >
          {rowContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={() => handleNavigate(entry)}
            disabled={isEditingThis || isOperationLoading}
          >
            Open Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
          {/* Git Actions */}
          {isGitRepo ? (
            <>
              <ContextMenuItem
                onSelect={() => handleGitPull(entry.path)}
                disabled={isOperationLoading}
              >
                <GitMergeIcon className="mr-2 h-4 w-4" />
                Git Pull
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => handleGitCommit(entry.path)}
                disabled={isOperationLoading}
              >
                <GitCommitIcon className="mr-2 h-4 w-4" />
                Git Commit...
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => handleGitPush(entry.path)}
                disabled={isOperationLoading}
              >
                <GitPullRequestIcon className="mr-2 h-4 w-4" />
                Git Push
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => handleGitStatus(entry.path)}
                disabled={isOperationLoading}
              >
                <InfoIcon className="mr-2 h-4 w-4" />
                Git Status
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem
              onSelect={() => handleGitInit(entry.path)}
              disabled={isOperationLoading}
            >
              <GitBranchIcon className="mr-2 h-4 w-4" />
              Initialize Git Repository
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          {/* Standard Actions */}
          <ContextMenuItem
            onSelect={() => startEditing(entry)}
            disabled={isOperationLoading}
          >
            <EditIcon className="mr-2 h-4 w-4" />
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => handleDownload(entry)}
            disabled={isOperationLoading}
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            Download as ZIP
          </ContextMenuItem>
          <ContextMenuItem
            className="text-red-600 focus:text-red-600 focus:bg-red-100 dark:focus:bg-red-900/20"
            onSelect={() => handleDelete(entry)}
            disabled={isOperationLoading}
          >
            <Trash2Icon className="mr-2 h-4 w-4" />
            Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  } else {
    // Files don't have the extended context menu for now
    return rowContent;
  }
};
