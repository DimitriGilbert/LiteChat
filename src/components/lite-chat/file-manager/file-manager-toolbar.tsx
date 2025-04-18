// src/components/lite-chat/file-manager/file-manager-toolbar.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import {
  FolderIcon,
  UploadCloudIcon,
  ArchiveIcon,
  FolderUpIcon,
  RefreshCwIcon,
  FileArchiveIcon,
  HomeIcon,
  FolderPlusIcon,
  Loader2Icon,
} from "lucide-react";
import type { FileSystemEntry } from "@/lib/types";

interface FileManagerToolbarProps {
  currentPath: string;
  isAnyLoading: boolean;
  isOperationLoading: boolean;
  entries: FileSystemEntry[];
  editingPath: string | null;
  creatingFolder: boolean;
  handleNavigateHome: () => void;
  handleNavigateUp: () => void;
  handleRefresh: () => void;
  startCreatingFolder: () => void;
  handleUploadClick: () => void;
  handleFolderUploadClick: () => void;
  handleArchiveUploadClick: () => void;
  handleDownloadAll: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>; // Changed type
  folderInputRef: React.RefObject<HTMLInputElement | null>; // Changed type
  archiveInputRef: React.RefObject<HTMLInputElement | null>; // Changed type
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleArchiveChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const FileManagerToolbar: React.FC<FileManagerToolbarProps> = ({
  currentPath,
  isAnyLoading,
  isOperationLoading,
  entries,
  editingPath,
  creatingFolder,
  handleNavigateHome,
  handleNavigateUp,
  handleRefresh,
  startCreatingFolder,
  handleUploadClick,
  handleFolderUploadClick,
  handleArchiveUploadClick,
  handleDownloadAll,
  fileInputRef,
  folderInputRef,
  archiveInputRef,
  handleFileChange,
  handleArchiveChange,
}) => {
  return (
    <>
      {/* Hidden Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        disabled={isAnyLoading} // Disable hidden input as well
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileChange}
        className="hidden"
        {...{
          webkitdirectory: "true",
          mozdirectory: "true",
          directory: "true",
        }}
        disabled={isAnyLoading} // Disable hidden input as well
      />
      <input
        type="file"
        ref={archiveInputRef}
        onChange={handleArchiveChange}
        className="hidden"
        accept=".zip"
        disabled={isAnyLoading} // Disable hidden input as well
      />

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-700 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNavigateHome}
          disabled={currentPath === "/" || isAnyLoading}
          title="Go to root directory"
          className="h-8 w-8"
        >
          <HomeIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNavigateUp}
          disabled={currentPath === "/" || isAnyLoading}
          title="Go up one level"
          className="h-8 w-8"
        >
          <FolderUpIcon className="h-4 w-4" />
        </Button>
        <span
          className="text-sm font-mono text-gray-400 truncate flex-shrink min-w-0 px-2 py-1 rounded bg-gray-800/50"
          title={currentPath}
        >
          {currentPath}
        </span>
        <div className="flex-grow" />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isAnyLoading} // Disable refresh if config loading OR operation loading
          title="Refresh current directory"
          className="h-8 w-8"
        >
          {isOperationLoading ? ( // Show spinner only for operations, not config loading
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={startCreatingFolder}
          disabled={isAnyLoading || creatingFolder || !!editingPath}
          className="h-8"
          title="Create New Folder"
        >
          {isOperationLoading && creatingFolder ? ( // Spinner if creating
            <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FolderPlusIcon className="h-4 w-4 mr-1" />
          )}
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadClick}
          disabled={isAnyLoading}
          className="h-8"
          title="Upload Files"
        >
          {isOperationLoading ? ( // Generic spinner if any operation is loading
            <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <UploadCloudIcon className="h-4 w-4 mr-1" />
          )}
          Files
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFolderUploadClick}
          disabled={isAnyLoading}
          className="h-8"
          title="Upload Folder"
        >
          {isOperationLoading ? (
            <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FolderIcon className="h-4 w-4 mr-1" />
          )}
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleArchiveUploadClick}
          disabled={isAnyLoading}
          className="h-8"
          title="Upload & Extract ZIP"
        >
          {isOperationLoading ? (
            <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <FileArchiveIcon className="h-4 w-4 mr-1" />
          )}
          ZIP
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadAll}
          disabled={isAnyLoading || entries.length === 0}
          className="h-8"
          title="Download Current Directory as ZIP"
        >
          {isOperationLoading ? (
            <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ArchiveIcon className="h-4 w-4 mr-1" />
          )}
          Export
        </Button>
      </div>
    </>
  );
};
