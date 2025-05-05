// src/components/LiteChat/file-manager/FileManagerTable.tsx
import React, { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// Removed ScrollArea import
import type { VfsNode } from "@/types/litechat/vfs";
import { NewFolderRow } from "./NewFolderRow";
import { FileManagerRow } from "./FileManagerRow";

interface FileManagerTableProps {
  entries: VfsNode[];
  editingPath: string | null;
  newName: string;
  creatingFolder: boolean;
  newFolderName: string;
  // Replace checkedPaths with selectedFileIds from store
  selectedFileIds: Set<string>;
  isOperationLoading: boolean;
  handleNavigate: (entry: VfsNode) => void;
  // Update checkbox handler signature
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

export const FileManagerTable: React.FC<FileManagerTableProps> = ({
  entries,
  editingPath,
  newName,
  creatingFolder,
  newFolderName,
  // Use selectedFileIds from props
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
  const memoizedEntries = useMemo(() => entries, [entries]);

  if (isOperationLoading && entries.length === 0 && !creatingFolder) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    // Removed ScrollArea component
    // Added relative container for sticky header
    <div className="relative h-full">
      <Table className="w-full text-sm">
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow className="hover:bg-card">
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
            <NewFolderRow
              newFolderName={newFolderName}
              setNewFolderName={setNewFolderName}
              handleCreateFolder={handleCreateFolder}
              cancelCreatingFolder={cancelCreatingFolder}
              newFolderInputRef={newFolderInputRef}
              isOperationLoading={isOperationLoading}
            />
          )}
          {memoizedEntries.map((entry) => {
            const isEditingThis = editingPath === entry.path;
            // Check if the node ID is in the selectedFileIds set
            const isChecked = selectedFileIds.has(entry.id);
            const isGitRepo = gitRepoStatus[entry.path] ?? false;

            return (
              <FileManagerRow
                key={entry.id} // Use node ID as key
                entry={entry}
                isEditingThis={isEditingThis}
                isChecked={isChecked} // Pass checked status based on store
                isGitRepo={isGitRepo}
                newName={isEditingThis ? newName : ""}
                isOperationLoading={isOperationLoading}
                creatingFolder={creatingFolder}
                handleNavigate={handleNavigate}
                handleCheckboxChange={handleCheckboxChange} // Pass updated handler
                startEditing={startEditing}
                cancelEditing={cancelEditing}
                handleRename={handleRename}
                handleDownload={handleDownload}
                handleDelete={handleDelete}
                setNewName={setNewName}
                renameInputRef={renameInputRef}
                handleGitInit={handleGitInit}
                handleGitPull={handleGitPull}
                handleGitCommit={handleGitCommit}
                handleGitPush={handleGitPush}
                handleGitStatus={handleGitStatus}
              />
            );
          })}
          {entries.length === 0 && !creatingFolder && !isOperationLoading && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                Folder is empty
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
