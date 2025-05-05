// src/components/LiteChat/file-manager/FileManagerToolbar.tsx

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
  GitBranchIcon,
} from "lucide-react";
import type { VfsNode } from "@/types/litechat/vfs";

interface FileManagerToolbarProps {
  currentPath: string;
  isAnyLoading: boolean;
  isOperationLoading: boolean;
  entries: VfsNode[];
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
  handleCloneClick: () => void;
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
  handleCloneClick,
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
      <div className="flex items-center gap-1 p-2 border-b border-border flex-shrink-0 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNavigateHome();
            }}
            disabled={currentPath === "/" || isAnyLoading}
            title="Go to root directory"
            className="h-8 w-8"
            type="button"
          >
            <HomeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNavigateUp();
            }}
            disabled={currentPath === "/" || isAnyLoading}
            title="Go up one level"
            className="h-8 w-8"
            type="button"
          >
            <FolderUpIcon className="h-4 w-4" />
          </Button>
          <span
            className="text-sm font-mono text-muted-foreground truncate flex-shrink min-w-0 px-2 py-1 rounded bg-muted/50 max-w-[150px] sm:max-w-xs md:max-w-sm lg:max-w-md" // Adjusted max-width for mobile
            title={currentPath}
          >
            {currentPath}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
          {" "}
          {/* Added justify-end */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRefresh();
            }}
            disabled={isAnyLoading} // Disable on any loading
            title="Refresh current directory"
            className="h-8 w-8"
            type="button"
          >
            {/* Show spinner only for FS operations, not all loading */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startCreatingFolder();
            }}
            disabled={isAnyLoading || creatingFolder || !!editingPath}
            className="h-8"
            title="Create New Folder"
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading && creatingFolder ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FolderPlusIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">Folder</span>{" "}
            {/* Hide text on small screens */}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleUploadClick();
            }}
            disabled={isAnyLoading}
            className="h-8"
            title="Upload Files"
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <UploadCloudIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">Files</span>{" "}
            {/* Hide text on small screens */}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFolderUploadClick();
            }}
            disabled={isAnyLoading}
            className="h-8"
            title="Upload Folder"
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FolderIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">Folder</span>{" "}
            {/* Hide text on small screens */}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleArchiveUploadClick();
            }}
            disabled={isAnyLoading}
            className="h-8"
            title="Upload & Extract ZIP"
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileArchiveIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">ZIP</span>{" "}
            {/* Hide text on small screens */}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCloneClick();
            }}
            disabled={isAnyLoading} // Disable on any loading
            className="h-8"
            title="Clone Git Repository"
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <GitBranchIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">Clone</span>{" "}
            {/* Hide text on small screens */}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDownloadAll();
            }}
            disabled={isAnyLoading || entries.length === 0}
            className="h-8"
            title="Download Current Directory as ZIP"
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ArchiveIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">Export</span>{" "}
            {/* Hide text on small screens */}
          </Button>
        </div>
      </div>
    </>
  );
};
