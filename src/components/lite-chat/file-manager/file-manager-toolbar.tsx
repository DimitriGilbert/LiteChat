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
  GitBranchIcon, // Added GitBranchIcon
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
  handleCloneClick: () => void; // Added handler for clone button
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  archiveInputRef: React.RefObject<HTMLInputElement | null>;
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
  handleCloneClick, // Added handler prop
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
        disabled={isAnyLoading}
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
        disabled={isAnyLoading}
      />
      <input
        type="file"
        ref={archiveInputRef}
        onChange={handleArchiveChange}
        className="hidden"
        accept=".zip"
        disabled={isAnyLoading}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-700 flex-shrink-0 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-1 flex-shrink-0">
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
            className="text-sm font-mono text-gray-400 truncate flex-shrink min-w-0 px-2 py-1 rounded bg-gray-800/50 max-w-[200px] sm:max-w-xs md:max-w-sm lg:max-w-md"
            title={currentPath}
          >
            {currentPath}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isAnyLoading}
            title="Refresh current directory"
            className="h-8 w-8"
          >
            {isOperationLoading ? (
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
            {isOperationLoading && creatingFolder ? (
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
            {isOperationLoading ? (
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
          {/* Added Clone Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCloneClick}
            disabled={isAnyLoading}
            className="h-8"
            title="Clone Git Repository"
          >
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <GitBranchIcon className="h-4 w-4 mr-1" />
            )}
            Clone
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
      </div>
    </>
  );
};
