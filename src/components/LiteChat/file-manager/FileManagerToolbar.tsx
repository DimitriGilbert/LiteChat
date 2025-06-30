// src/components/LiteChat/file-manager/FileManagerToolbar.tsx

import React from "react";
import { Button } from "@/components/ui/button";
import {
  FolderUpIcon,
  FileUpIcon,
  RefreshCwIcon,
  ArchiveIcon,
  HomeIcon,
  FolderPlusIcon,
  Loader2Icon,
  GitBranchIcon,
} from "lucide-react";
import type { VfsNode } from "@/types/litechat/vfs";
import { useTranslation } from "react-i18next";

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
  gitRepoStatus: Record<string, boolean>;
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
  gitRepoStatus,
}) => {
  const { t } = useTranslation("vfs");
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
            title={t("toolbar.goToRootDir")}
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
            title={t("toolbar.goUpOneLevel")}
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
            title={t("toolbar.refreshCurrentDir")}
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
            title={t("toolbar.createNewFolder")}
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading && creatingFolder ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FolderPlusIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">{t("toolbar.folder")}</span>{" "}
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
            title={t("toolbar.uploadFiles")}
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileUpIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">{t("toolbar.files")}</span>{" "}
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
            title={t("toolbar.uploadFolder")}
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FolderUpIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">{t("toolbar.folder")}</span>{" "}
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
            title={t("toolbar.uploadAndExtractZip")}
            type="button"
          >
            {/* Spinner logic remains the same */}
            {isOperationLoading ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ArchiveIcon className="h-4 w-4 mr-1" />
            )}
            <span className="hidden sm:inline">{t("toolbar.zip")}</span>{" "}
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
            disabled={isAnyLoading}
            className="h-8"
            title={t("toolbar.cloneRepository")}
            type="button"
          >
            <GitBranchIcon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t("toolbar.cloneRepository")}</span>{" "}
          </Button>
          {/* Git Operations Button (conditionally rendered) */}
          {entries.some((entry) => gitRepoStatus[entry.path]) && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => e.preventDefault()} // Placeholder, actual menu in dropdown
              disabled={isAnyLoading}
              className="h-8"
              title={t("toolbar.gitOperations")}
              type="button"
            >
              <GitBranchIcon className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t("toolbar.gitOperations")}</span>{" "}
            </Button>
          )}
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
            title={t("toolbar.downloadAll")}
            type="button"
          >
            <ArchiveIcon className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">{t("toolbar.downloadAll")}</span>{" "}
          </Button>
        </div>
      </div>
    </>
  );
};
