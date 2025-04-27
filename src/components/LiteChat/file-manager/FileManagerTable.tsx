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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VfsNode } from "@/types/litechat/vfs";
import { NewFolderRow } from "./NewFolderRow";
import { FileManagerRow } from "./FileManagerRow";

interface FileManagerTableProps {
  entries: VfsNode[];
  editingPath: string | null;
  newName: string;
  creatingFolder: boolean;
  newFolderName: string;
  checkedPaths: Set<string>;
  isOperationLoading: boolean; // Combined loading state
  handleNavigate: (entry: VfsNode) => void;
  handleCheckboxChange: (checked: boolean, path: string) => void;
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
  gitRepoStatus: Record<string, boolean>; // Git status per path
  // Git action handlers
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
  isOperationLoading, // Use combined loading state
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
  gitRepoStatus, // Receive git status
  // Receive git handlers
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
    <ScrollArea className="flex-grow h-0 border-t border-border">
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
            const isChecked = checkedPaths.has(entry.path);
            const isGitRepo = gitRepoStatus[entry.path] ?? false; // Check git status

            return (
              <FileManagerRow
                key={entry.path}
                entry={entry}
                isEditingThis={isEditingThis}
                isChecked={isChecked}
                isGitRepo={isGitRepo} // Pass git status
                newName={isEditingThis ? newName : ""}
                isOperationLoading={isOperationLoading} // Pass combined loading
                creatingFolder={creatingFolder}
                handleNavigate={handleNavigate}
                handleCheckboxChange={handleCheckboxChange}
                startEditing={startEditing}
                cancelEditing={cancelEditing}
                handleRename={handleRename}
                handleDownload={handleDownload}
                handleDelete={handleDelete}
                setNewName={setNewName}
                renameInputRef={renameInputRef}
                // Pass git handlers
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
    </ScrollArea>
  );
};
