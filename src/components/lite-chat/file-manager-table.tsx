// src/components/lite-chat/file-manager/file-manager-table.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FolderIcon,
  FileIcon,
  DownloadIcon,
  Trash2Icon,
  Edit2Icon,
  CheckIcon,
  XIcon,
  Loader2Icon,
} from "lucide-react";
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
}) => {
  return (
    <ScrollArea className="flex-grow">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px] px-2"></TableHead>
            <TableHead className="w-[40px] px-2"></TableHead>
            <TableHead className="px-2">Name</TableHead>
            <TableHead className="w-[100px] px-2">Size</TableHead>
            <TableHead className="w-[150px] px-2">Modified</TableHead>
            <TableHead className="w-[100px] text-right px-2">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creatingFolder && (
            <TableRow className="bg-gray-700/50">
              <TableCell className="px-2">
                <FolderIcon className="h-4 w-4 text-yellow-400" />
              </TableCell>
              <TableCell className="px-2"></TableCell>
              <TableCell className="px-2" colSpan={3}>
                <div className="flex items-center gap-1">
                  <Input
                    ref={newFolderInputRef}
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") cancelCreatingFolder();
                    }}
                    placeholder="New folder name..."
                    className="h-6 px-1 text-xs flex-grow bg-gray-800 border-gray-600 focus:ring-blue-500"
                    disabled={isOperationLoading} // Disable input during any operation
                  />
                </div>
              </TableCell>
              <TableCell className="text-right px-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-green-500 hover:bg-green-900/50"
                  onClick={handleCreateFolder}
                  disabled={isOperationLoading || !newFolderName.trim()} // Disable during op or if name empty
                  title="Create folder"
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
                  className="h-6 w-6 text-gray-400 hover:bg-gray-600/50"
                  onClick={cancelCreatingFolder}
                  disabled={isOperationLoading} // Disable cancel during op
                  title="Cancel"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          )}
          {entries.map((entry) => (
            <TableRow
              key={entry.path}
              className={cn(
                "hover:bg-gray-700/50 group",
                editingPath === entry.path && "bg-gray-700/70",
                isOperationLoading && "opacity-70 cursor-not-allowed", // Dim rows during operations
              )}
              onDoubleClick={() =>
                !isOperationLoading && !editingPath && handleNavigate(entry)
              } // Prevent double click during op
            >
              <TableCell className="px-2">
                {entry.isDirectory ? (
                  <FolderIcon className="h-4 w-4 text-yellow-400" />
                ) : (
                  <FileIcon className="h-4 w-4 text-gray-400" />
                )}
              </TableCell>
              <TableCell className="px-2">
                {!entry.isDirectory && (
                  <Checkbox
                    id={`select-${entry.path}`}
                    checked={checkedPaths.has(entry.path)}
                    onCheckedChange={(checked) =>
                      handleCheckboxChange(!!checked, entry.path)
                    }
                    disabled={isOperationLoading} // Disable checkbox during op
                    aria-label={`Select file ${entry.name}`}
                    className="mt-0.5"
                  />
                )}
              </TableCell>
              <TableCell
                className="font-medium truncate max-w-[200px] px-2"
                title={entry.name}
              >
                {editingPath === entry.path ? (
                  <div className="flex items-center gap-1">
                    <Input
                      ref={renameInputRef}
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      className="h-6 px-1 text-xs flex-grow bg-gray-800 border-gray-600 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()} // Prevent row navigation
                      disabled={isOperationLoading} // Disable input during op
                    />
                  </div>
                ) : (
                  <span
                    className={cn(
                      entry.isDirectory && "cursor-pointer",
                      !entry.isDirectory && "cursor-default",
                    )}
                    onClick={() => !isOperationLoading && handleNavigate(entry)} // Allow click nav only if not loading
                  >
                    {entry.name}
                  </span>
                )}
              </TableCell>
              <TableCell className="px-2">
                {entry.isDirectory ? "-" : formatBytes(entry.size)}
              </TableCell>
              <TableCell className="px-2">
                {entry.lastModified.toLocaleString()}
              </TableCell>
              <TableCell className="text-right px-2">
                {editingPath === entry.path ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-green-500 hover:bg-green-900/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename();
                      }}
                      disabled={isOperationLoading || !newName.trim()} // Disable during op or if name empty
                      title="Save name"
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
                      className="h-6 w-6 text-gray-400 hover:bg-gray-600/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEditing();
                      }}
                      disabled={isOperationLoading} // Disable cancel during op
                      title="Cancel rename"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-0.5",
                      isOperationLoading && "opacity-30", // Dim actions during op
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-gray-600/50"
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(entry);
                      }}
                      disabled={isOperationLoading || creatingFolder} // Disable if any loading or creating folder
                    >
                      <Edit2Icon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-gray-600/50"
                      title={
                        entry.isDirectory
                          ? "Download Folder (ZIP)"
                          : "Download File"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(entry);
                      }}
                      disabled={isOperationLoading} // Disable if any loading
                    >
                      <DownloadIcon className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-400 hover:bg-red-900/30"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(entry);
                      }}
                      disabled={isOperationLoading} // Disable if any loading
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && !creatingFolder && !isOperationLoading && (
            // Show empty message only if not loading and not creating
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500 py-6">
                Folder is empty
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
};
