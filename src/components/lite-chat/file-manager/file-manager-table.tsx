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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FileSystemEntry } from "@/lib/types";
import { NewFolderRow } from "./new-folder-row";
import { FileManagerRow } from "./file-manager-row";

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
  const memoizedEntries = useMemo(() => entries, [entries]);

  if (isOperationLoading && entries.length === 0 && !creatingFolder) {
    // Show a simple loading state if the table would otherwise be empty
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <ScrollArea className="flex-grow h-0 border-t border-gray-700">
      <Table className="w-full text-sm">
        <TableHeader className="sticky top-0 bg-gray-800 z-10">
          <TableRow className="hover:bg-gray-800">
            {/* Adjusted widths slightly */}
            <TableHead className="w-[40px] px-2"></TableHead> {/* Checkbox */}
            <TableHead className="w-[40px] px-2"></TableHead> {/* Icon */}
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
            const isGitRepo = gitRepoStatus[entry.path] ?? false;

            return (
              <FileManagerRow
                key={entry.path} // Key remains here for the list mapping
                entry={entry}
                isEditingThis={isEditingThis}
                isChecked={isChecked}
                isGitRepo={isGitRepo}
                newName={isEditingThis ? newName : ""} // Pass newName only when editing this row
                isOperationLoading={isOperationLoading}
                creatingFolder={creatingFolder}
                handleNavigate={handleNavigate}
                handleCheckboxChange={handleCheckboxChange}
                startEditing={startEditing}
                cancelEditing={cancelEditing}
                handleRename={handleRename}
                handleDownload={handleDownload}
                handleDelete={handleDelete}
                setNewName={setNewName} // Pass setter down
                renameInputRef={renameInputRef} // Pass ref down
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
