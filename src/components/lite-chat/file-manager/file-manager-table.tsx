// src/components/lite-chat/file-manager/file-manager-table.tsx
import React, { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { formatBytes } from "@/utils/file-manager-utils";
import type { FileSystemEntry } from "@/lib/types";

interface FileManagerTableProps {
  entries: FileSystemEntry[];
  editingPath: string | null;
  newName: string;
  creatingFolder: boolean;
  newFolderName: string;
  checkedPaths: Set<string>;
  isOperationLoading: boolean;
  handleNavigate: (entry: FileSystemEntry) => void;
  handleCheckboxChange: (checked: boolean, path: string) => void;
  startEditing: (entry: FileSystemEntry) => void;
  cancelEditing: () => void;
  handleRename: () => void;
  cancelCreatingFolder: () => void;
  handleCreateFolder: () => void;
  handleDownload: (entry: FileSystemEntry) => void;
  handleDelete: (entry: FileSystemEntry) => void;
  setNewName: (name: string) => void;
  setNewFolderName: (name: string) => void;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  newFolderInputRef: React.RefObject<HTMLInputElement | null>;
  gitRepoStatus: Record<string, boolean>;
  handleGitInit: (path: string) => void;
  handleGitPull: (path: string) => void;
  handleGitCommit: (path: string) => void;
  handleGitPush: (path: string) => void;
  handleGitStatus: (path: string) => void;
}

export const FileManagerTable: React.FC<FileManagerTableProps> = ({
  entries,
  editingPath,
  newName,
  creatingFolder,
  newFolderName,
  checkedPaths,
  isOperationLoading,
  handleNavigate,
  handleCheckboxChange,
  startEditing,
  cancelEditing,
  handleRename,
  cancelCreatingFolder,
  handleCreateFolder,
  handleDownload,
  handleDelete,
  setNewName,
  setNewFolderName,
  renameInputRef,
  newFolderInputRef,
  gitRepoStatus,
  handleGitInit,
  handleGitPull,
  handleGitCommit,
  handleGitPush,
  handleGitStatus,
}) => {
  const handleRowClick = (
    e: React.MouseEvent<HTMLTableRowElement>,
    entry: FileSystemEntry,
  ) => {
    if (
      (e.target as HTMLElement).closest(
        'input[type="checkbox"], button, input[type="text"]',
      ) ||
      (e.target as HTMLElement).closest("[data-radix-context-menu-trigger]")
    ) {
      return;
    }
    if (editingPath !== entry.path && !isOperationLoading) {
      handleNavigate(entry);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    handler: () => void,
    cancelHandler: () => void,
  ) => {
    if (e.key === "Enter") {
      handler();
    } else if (e.key === "Escape") {
      cancelHandler();
    }
  };
  const memoizedEntries = useMemo(() => entries, [entries]);

  if (isOperationLoading) {
    return (
      <div className="flex items-center justify-center h-full">loading</div>
    );
  }
  return (
    <ScrollArea className="flex-grow h-0 border-t border-gray-700">
      <Table className="w-full text-sm">
        <TableHeader className="sticky top-0 bg-gray-800 z-10">
          <TableRow className="hover:bg-gray-800">
            <TableHead className="w-[40px] px-2"></TableHead>
            <TableHead className="w-[40px] px-2"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-[100px] text-right">Size</TableHead>
            <TableHead className="w-[150px] text-right">Modified</TableHead>
            <TableHead className="w-[100px] text-right pr-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creatingFolder && (
            <TableRow className="bg-gray-700/50">
              <TableCell className="px-2">
                <FolderIcon className="h-5 w-5 text-yellow-400" />
              </TableCell>
              <TableCell className="px-2"></TableCell>
              <TableCell className="py-1 px-2" colSpan={3}>
                <Input
                  ref={newFolderInputRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={handleCreateFolder}
                  onKeyDown={(e) =>
                    handleKeyDown(e, handleCreateFolder, cancelCreatingFolder)
                  }
                  className="h-7 px-2 py-1 text-sm bg-gray-800 border-gray-600 focus:ring-1 focus:ring-blue-500 w-full"
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
                          className="h-6 w-6 text-gray-400 hover:text-gray-300"
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
          )}
          {memoizedEntries.map((entry) => {
            const isEditingThis = editingPath === entry.path;
            const isChecked = checkedPaths.has(entry.path);
            const isGitRepo = gitRepoStatus[entry.path] ?? false;

            const Icon = entry.isDirectory
              ? isGitRepo
                ? FolderGitIcon
                : FolderIcon
              : FileIcon;
            const iconColor = entry.isDirectory
              ? isGitRepo
                ? "text-green-400"
                : "text-yellow-400"
              : "text-blue-400";

            const rowContent = (
              <TableRow
                key={entry.path}
                className={cn(
                  "group hover:bg-gray-700/50",
                  isEditingThis && "bg-gray-700 ring-1 ring-blue-600",
                  isOperationLoading && "opacity-70 cursor-not-allowed",
                )}
                onClick={(e) => !isEditingThis && handleRowClick(e, entry)}
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
                    className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                    disabled={isOperationLoading}
                  />
                </TableCell>
                <TableCell className="px-2 py-1">
                  <Icon className={cn("h-5 w-5", iconColor)} />
                </TableCell>
                <TableCell className="py-1 px-2">
                  {isEditingThis ? (
                    <Input
                      ref={renameInputRef}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) =>
                        handleKeyDown(e, handleRename, cancelEditing)
                      }
                      className="h-7 px-2 py-1 text-sm bg-gray-800 border-gray-600 focus:ring-1 focus:ring-blue-500 w-full"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isOperationLoading}
                    />
                  ) : (
                    <span
                      className={cn(
                        "truncate",
                        entry.isDirectory && "cursor-pointer",
                      )}
                      title={entry.name}
                      onClick={(e) => {
                        if (entry.isDirectory) {
                          e.stopPropagation();
                          handleNavigate(entry);
                        }
                      }}
                    >
                      {entry.name}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right py-1 px-2">
                  {entry.size !== undefined && !entry.isDirectory
                    ? formatBytes(entry.size)
                    : ""}
                </TableCell>
                <TableCell className="text-right text-gray-400 py-1 px-2">
                  {/* --- MODIFIED: Use lastModified --- */}
                  {entry.lastModified?.toLocaleString()}
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
                            <TooltipContent side="top">
                              Save (Enter)
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-gray-400 hover:text-gray-300"
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
                            <TooltipContent side="top">
                              Cancel (Esc)
                            </TooltipContent>
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
                                className="h-6 w-6 text-gray-400 hover:text-white"
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
                                className="h-6 w-6 text-gray-400 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(entry);
                                }}
                                aria-label={
                                  entry.isDirectory
                                    ? "Download folder as ZIP"
                                    : "Download file"
                                }
                                disabled={isOperationLoading}
                              >
                                <DownloadIcon className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {entry.isDirectory
                                ? "Download folder (.zip)"
                                : "Download file"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-500 hover:text-red-400"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(entry);
                                }}
                                aria-label={`Delete ${entry.isDirectory ? "folder" : "file"}`}
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

            if (entry.isDirectory) {
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
              return rowContent;
            }
          })}
          {entries.length === 0 && !creatingFolder && !isOperationLoading && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                Folder is empty
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
};
