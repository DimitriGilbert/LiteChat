// src/components/LiteChat/file-manager/FileManagerList.tsx

import React from "react";
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
  MoreVerticalIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/litechat/file-manager-utils";
import type { VfsNode } from "@/types/litechat/vfs";
import { NewFolderRow } from "./NewFolderRow";
import { useTranslation } from "react-i18next";

interface FileManagerListProps {
  entries: VfsNode[];
  editingPath: string | null;
  newName: string;
  creatingFolder: boolean;
  newFolderName: string;
  selectedFileIds: Set<string>;
  isOperationLoading: boolean;
  handleNavigate: (entry: VfsNode) => void;
  handleCheckboxChange: (checked: boolean, nodeId: string) => void;
  startEditing: (entry: VfsNode) => void;
  cancelEditing: () => void;
  handleRename: () => void;
  cancelCreatingFolder: () => void;
  handleCreateFolder: () => void;
  handleDownload: (entry: VfsNode) => void;
  handleDelete: (entry: VfsNode) => void;
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

export const FileManagerList: React.FC<FileManagerListProps> = ({
  entries,
  editingPath,
  newName,
  creatingFolder,
  newFolderName,
  selectedFileIds,
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
  const { t } = useTranslation("vfs");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  if (isOperationLoading && entries.length === 0 && !creatingFolder) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        {t("table.loading")}
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {creatingFolder && (
        // Reuse NewFolderRow logic, maybe adapt styling slightly if needed
        <div className="border rounded-md p-2 bg-muted/30">
          <NewFolderRow
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            handleCreateFolder={handleCreateFolder}
            cancelCreatingFolder={cancelCreatingFolder}
            newFolderInputRef={newFolderInputRef}
            isOperationLoading={isOperationLoading}
            isMobile={true} // Indicate mobile context if styling needs adjustment
          />
        </div>
      )}
      {entries.map((entry) => {
        const isEditingThis = editingPath === entry.path;
        const isChecked = selectedFileIds.has(entry.id);
        const isGitRepo = gitRepoStatus[entry.path] ?? false;
        const isDirectory = entry.type === "folder";
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

        return (
          <div
            key={entry.id}
            className={cn(
              "flex items-center justify-between p-2 border rounded-md",
              isEditingThis && "bg-muted ring-1 ring-primary",
              isOperationLoading && "opacity-70 cursor-not-allowed",
              !isEditingThis && "hover:bg-muted/50",
              !isEditingThis && "cursor-pointer",
            )}
            onClick={() => {
              if (isEditingThis || isOperationLoading) return;
              if (isDirectory) handleNavigate(entry);
              else handleCheckboxChange(!isChecked, entry.id);
            }}
          >
            <div className="flex items-center gap-2 flex-grow min-w-0">
              {!isDirectory && (
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange(!!checked, entry.id)
                  }
                  aria-label={`Select ${entry.name}`}
                  className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                  disabled={isOperationLoading}
                  onClick={(e) => e.stopPropagation()} // Prevent row click from toggling checkbox twice
                />
              )}
              {isDirectory && (
                <div className="w-6 flex-shrink-0" /> // Placeholder for checkbox space
              )}
              <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
              <div className="flex flex-col min-w-0 flex-grow">
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
                    className="text-sm font-medium truncate"
                    title={entry.name}
                  >
                    {entry.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {entry.type === "file" && entry.size !== undefined
                    ? formatBytes(entry.size)
                    : entry.type === "folder"
                      ? isGitRepo
                        ? "Git Repository"
                        : "Folder"
                      : ""}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center flex-shrink-0 ml-2">
              {isEditingThis ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-500 hover:text-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRename();
                    }}
                    disabled={isOperationLoading || !newName.trim()}
                    aria-label="Save name"
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
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelEditing();
                    }}
                    disabled={isOperationLoading}
                    aria-label="Cancel edit"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isOperationLoading}
                      aria-label="More actions"
                    >
                      <MoreVerticalIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isDirectory && (
                      <DropdownMenuItem onSelect={() => handleNavigate(entry)}>
                        Open Folder
                      </DropdownMenuItem>
                    )}
                    {!isDirectory && (
                      <DropdownMenuItem
                        onSelect={() =>
                          handleCheckboxChange(!isChecked, entry.id)
                        }
                      >
                        {isChecked ? "Deselect" : "Select"} File
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => startEditing(entry)}>
                      <EditIcon className="mr-2 h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleDownload(entry)}>
                      <DownloadIcon className="mr-2 h-4 w-4" /> Download{" "}
                      {isDirectory ? "as ZIP" : ""}
                    </DropdownMenuItem>
                    {isDirectory && <DropdownMenuSeparator />}
                    {isDirectory && isGitRepo && (
                      <>
                        <DropdownMenuItem
                          onSelect={() => handleGitPull(entry.path)}
                        >
                          <GitMergeIcon className="mr-2 h-4 w-4" /> Git Pull
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleGitCommit(entry.path)}
                        >
                          <GitCommitIcon className="mr-2 h-4 w-4" /> Git
                          Commit...
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleGitPush(entry.path)}
                        >
                          <GitPullRequestIcon className="mr-2 h-4 w-4" /> Git
                          Push
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleGitStatus(entry.path)}
                        >
                          <InfoIcon className="mr-2 h-4 w-4" /> Git Status
                        </DropdownMenuItem>
                      </>
                    )}
                    {isDirectory && !isGitRepo && (
                      <DropdownMenuItem
                        onSelect={() => handleGitInit(entry.path)}
                      >
                        <GitBranchIcon className="mr-2 h-4 w-4" /> Initialize
                        Git Repo
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onSelect={() => handleDelete(entry)}
                    >
                      <Trash2Icon className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
      {entries.length === 0 && !creatingFolder && !isOperationLoading && (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Folder is empty
        </div>
      )}
    </div>
  );
};
