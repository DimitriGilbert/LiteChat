// src/components/LiteChat/file-manager/FileManagerRow.tsx
// FULL FILE
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
  FolderGitIcon,
  Loader2Icon,
} from "lucide-react";
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
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

interface FileManagerRowProps {
  entry: VfsNode;
  isEditingThis: boolean;
  isChecked: boolean;
  isGitRepo: boolean;
  newName: string;
  isOperationLoading: boolean;
  creatingFolder: boolean;
  handleNavigate: (entry: VfsNode) => void;
  handleCheckboxChange: (checked: boolean, nodeId: string) => void;
  startEditing: (entry: VfsNode) => void;
  cancelEditing: () => void;
  handleRename: () => void;
  handleDownload: (entry: VfsNode) => void;
  handleDelete: (entry: VfsNode) => void;
  setNewName: (name: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
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
  isGitRepo,
  newName,
  isOperationLoading,
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
  handleGitInit,
  handleGitPull,
  handleGitCommit,
  handleGitPush,
  handleGitStatus,
}) => {
  const isDirectory = entry.type === "folder";

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Prevent navigation/selection if clicking on interactive elements
    if (
      (e.target as HTMLElement).closest(
        'input[type="checkbox"], button, input[type="text"], [data-radix-context-menu-trigger]'
      )
    ) {
      return;
    }
    if (isEditingThis || isOperationLoading) return;

    // If it's a directory, navigate
    if (isDirectory) {
      handleNavigate(entry);
    } else {
      // If it's a file, toggle its selection state
      handleCheckboxChange(!isChecked, entry.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const Icon = isDirectory
    ? isGitRepo
      ? FolderGitIcon
      : FolderIcon
    : FileIcon;
  const iconColor = isDirectory
    ? isGitRepo
      ? "text-green-400"
      : "text-yellow-400"
    : "text-blue-400";

  const rowContent = (
    <TableRow
      key={entry.id}
      className={cn(
        "group hover:bg-muted/50",
        isEditingThis && "bg-muted ring-1 ring-primary",
        isOperationLoading && "opacity-70 cursor-not-allowed",
        !isDirectory && "cursor-pointer"
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
            handleCheckboxChange(!!checked, entry.id)
          }
          aria-label={`Select ${entry.name}`}
          className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          disabled={isOperationLoading || isDirectory} // Keep disabled for folders
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
              isDirectory && "cursor-pointer hover:underline"
            )}
            title={entry.name}
            // Keep folder navigation on name click
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
            isOperationLoading && "opacity-30"
          )}
        >
          {isEditingThis ? (
            <>
              <ActionTooltipButton
                tooltipText="Save (Enter)"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRename();
                }}
                aria-label="Save name"
                disabled={isOperationLoading || !newName.trim()}
                icon={
                  isOperationLoading ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckIcon />
                  )
                }
                className="h-6 w-6 text-green-500 hover:text-green-400"
              />
              <ActionTooltipButton
                tooltipText="Cancel (Esc)"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEditing();
                }}
                aria-label="Cancel edit"
                disabled={isOperationLoading}
                icon={<XIcon />}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              />
            </>
          ) : (
            <>
              <ActionTooltipButton
                tooltipText="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing(entry);
                }}
                aria-label="Rename"
                disabled={isOperationLoading || creatingFolder}
                icon={<EditIcon />}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              />
              <ActionTooltipButton
                tooltipText={
                  isDirectory ? "Download folder (.zip)" : "Download file"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(entry);
                }}
                aria-label={
                  isDirectory ? "Download folder as ZIP" : "Download file"
                }
                disabled={isOperationLoading}
                icon={<DownloadIcon />}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              />
              <ActionTooltipButton
                tooltipText="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(entry);
                }}
                aria-label={`Delete ${isDirectory ? "folder" : "file"}`}
                disabled={isOperationLoading}
                icon={<Trash2Icon />}
                className="h-6 w-6 text-destructive hover:text-destructive/80"
              />
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  if (isDirectory) {
    return (
      <ContextMenu key={entry.id}>
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
    // For files, wrap the row content in the ContextMenuTrigger directly
    // This allows right-clicking the file row for potential future file-specific actions
    return (
      <ContextMenu key={entry.id}>
        <ContextMenuTrigger
          disabled={isEditingThis || isOperationLoading}
          asChild
        >
          {rowContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {/* Add file-specific context menu items here if needed later */}
          <ContextMenuItem
            onSelect={() => handleCheckboxChange(!isChecked, entry.id)}
            disabled={isOperationLoading}
          >
            {isChecked ? "Deselect" : "Select"} File
          </ContextMenuItem>
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
            Download File
          </ContextMenuItem>
          <ContextMenuItem
            className="text-red-600 focus:text-red-600 focus:bg-red-100 dark:focus:bg-red-900/20"
            onSelect={() => handleDelete(entry)}
            disabled={isOperationLoading}
          >
            <Trash2Icon className="mr-2 h-4 w-4" />
            Delete File
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }
};
