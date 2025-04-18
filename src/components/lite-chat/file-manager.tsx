// src/components/lite-chat/file-manager.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FileSystemEntry } from "@/lib/types";
import { toast } from "sonner";
import { AlertCircleIcon } from "lucide-react";
import {
  normalizePath,
  joinPath,
  dirname,
  basename,
} from "@/utils/file-manager-utils";
import { FileManagerBanner } from "./file-manager/file-manager-banner";
import { FileManagerToolbar } from "./file-manager/file-manager-toolbar";
import { FileManagerTable } from "./file-manager/file-manager-table";

export const FileManager: React.FC<{ className?: string }> = ({
  className,
}) => {
  const {
    vfs,
    selectedItemType,
    selectedVfsPaths,
    addSelectedVfsPath,
    removeSelectedVfsPath,
  } = useChatContext();
  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(
    () => new Set(selectedVfsPaths),
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Use VFS hook states directly
  const isConfigLoading = vfs.isLoading; // Reflects initial configuration loading
  const isOperationLoading = vfs.isOperationLoading; // Reflects ongoing FS operations
  const configError = vfs.error; // Reflects configuration/readiness errors
  const isAnyLoading = isConfigLoading || isOperationLoading; // Combined loading state for disabling UI

  // Sync local checked state when context selection changes
  useEffect(() => {
    setCheckedPaths(new Set(selectedVfsPaths));
  }, [selectedVfsPaths]);

  const loadEntries = useCallback(
    async (path: string) => {
      // Prevent loading if VFS isn't ready, already loading, or key mismatch
      if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey || isAnyLoading) {
        return;
      }
      try {
        const normalizedPath = normalizePath(path);
        // No need to set isOperationLoading here, listFiles is read-only
        const fetchedEntries = await vfs.listFiles(normalizedPath);
        fetchedEntries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        setEntries(fetchedEntries);
        setCurrentPath(normalizedPath);
      } catch (error) {
        // Error is already toasted by the hook, just log here if needed
        console.error("FileManager List Error (already toasted):", error);
        // Optionally clear entries or show an error message in the table
        setEntries([]);
      }
    },
    [vfs, isAnyLoading], // Depend on vfs object and loading state
  );

  useEffect(() => {
    // Load entries when VFS becomes ready for the correct key, or when the key changes
    if (vfs.isReady && vfs.configuredVfsKey === vfs.vfsKey) {
      loadEntries(currentPath);
    } else {
      // Clear state if VFS is not ready or key mismatch
      setEntries([]);
      // Don't reset currentPath here, allow it to persist until a ready VFS loads it
      // setCurrentPath("/");
      setEditingPath(null);
      setCreatingFolder(false);
    }
    // Re-run when readiness, configured key, or target key changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vfs.isReady, vfs.configuredVfsKey, vfs.vfsKey]);

  // --- Navigation Handlers ---
  const handleNavigate = (entry: FileSystemEntry) => {
    if (isAnyLoading || editingPath) return; // Prevent navigation while loading or editing
    if (entry.isDirectory) {
      loadEntries(entry.path);
    }
  };
  const handleNavigateUp = () => {
    if (isAnyLoading) return;
    if (currentPath !== "/") {
      loadEntries(dirname(currentPath));
    }
  };
  const handleNavigateHome = () => {
    if (isAnyLoading) return;
    loadEntries("/");
  };
  const handleRefresh = () => {
    if (isAnyLoading) return;
    loadEntries(currentPath);
  };

  // --- Checkbox Handler ---
  const handleCheckboxChange = useCallback(
    (checked: boolean, path: string) => {
      if (isOperationLoading) return; // Prevent changes during operations
      setCheckedPaths((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(path);
          addSelectedVfsPath(path);
        } else {
          next.delete(path);
          removeSelectedVfsPath(path);
        }
        return next;
      });
    },
    [addSelectedVfsPath, removeSelectedVfsPath, isOperationLoading],
  );

  // --- Action Handlers ---
  const handleDelete = async (entry: FileSystemEntry) => {
    if (isAnyLoading) return; // Prevent action while loading
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready.");
      return;
    }
    const itemType = entry.isDirectory ? "folder" : "file";
    const confirmation = window.confirm(
      `Delete ${itemType} "${entry.name}"?${
        entry.isDirectory
          ? `

WARNING: This will delete all contents inside!`
          : ""
      }`,
    );
    if (confirmation) {
      try {
        // isOperationLoading set/unset within vfs.deleteItem
        await vfs.deleteItem(entry.path, entry.isDirectory);
        // Success toast handled by the hook if deletion succeeds
        if (!entry.isDirectory && checkedPaths.has(entry.path)) {
          removeSelectedVfsPath(entry.path); // Update selection state immediately
        }
        loadEntries(currentPath); // Refresh list after successful deletion
      } catch (error) {
        // Error already toasted by the hook
        console.error("FileManager Delete Error (already toasted):", error);
      }
    }
  };

  const handleDownload = async (entry: FileSystemEntry) => {
    if (isAnyLoading) return; // Prevent action while loading
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready.");
      return;
    }
    try {
      if (entry.isDirectory) {
        // Use downloadAllAsZip scoped to the directory path
        const filename = `vfs_${entry.name}.zip`;
        // isOperationLoading set/unset within vfs.downloadAllAsZip
        await vfs.downloadAllAsZip(filename, entry.path);
        // Success toast handled by the hook
      } else {
        // Use downloadFile for single files
        // isOperationLoading NOT set for single file download (usually fast)
        await vfs.downloadFile(entry.path, entry.name);
        // No success toast for single file download by default
      }
    } catch (error) {
      // Error already toasted by the hook
      console.error("FileManager Download Error (already toasted):", error);
    }
  };

  const handleUploadClick = () => {
    if (isAnyLoading) return;
    fileInputRef.current?.click();
  };
  const handleFolderUploadClick = () => {
    if (isAnyLoading) return;
    folderInputRef.current?.click();
  };
  const handleArchiveUploadClick = () => {
    if (isAnyLoading) return;
    archiveInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAnyLoading) {
      e.target.value = ""; // Clear input if loading
      return;
    }
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready for upload.");
      e.target.value = "";
      return;
    }
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        // isOperationLoading set/unset within vfs.uploadFiles
        await vfs.uploadFiles(files, currentPath);
        // Success/summary toast handled by the hook
        loadEntries(currentPath); // Refresh list after upload attempt
      } catch (error) {
        // Error already toasted by the hook
        console.error("FileManager Upload Error (already toasted):", error);
      }
    }
    e.target.value = ""; // Clear input after processing
  };

  const handleArchiveChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (isAnyLoading) {
      e.target.value = ""; // Clear input if loading
      return;
    }
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready for archive extraction.");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          // isOperationLoading set/unset within vfs.uploadAndExtractZip
          await vfs.uploadAndExtractZip(file, currentPath);
          // Success/summary toast handled by the hook
          loadEntries(currentPath); // Refresh list after extraction attempt
        } catch (error) {
          // Error already toasted by the hook
          console.error("FileManager Extract Error (already toasted):", error);
        }
      } else {
        toast.error("Only ZIP archive extraction is currently supported.");
      }
    }
    e.target.value = ""; // Clear input after processing
  };

  const handleDownloadAll = async () => {
    if (isAnyLoading) return; // Prevent action while loading
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready for export.");
      return;
    }
    try {
      // Export current directory (rootPath = currentPath)
      const filename = `vfs_${basename(currentPath) || "root"}_export.zip`;
      // isOperationLoading set/unset within vfs.downloadAllAsZip
      await vfs.downloadAllAsZip(filename, currentPath);
      // Success toast handled by the hook
    } catch (error) {
      // Error already toasted by the hook
      console.error("FileManager Export Error (already toasted):", error);
    }
  };

  // --- Rename Logic ---
  const startEditing = (entry: FileSystemEntry) => {
    if (isAnyLoading || creatingFolder) return; // Prevent editing while loading or creating
    setEditingPath(entry.path);
    setNewName(entry.name);
    setCreatingFolder(false); // Ensure not in create mode
  };
  const cancelEditing = () => {
    setEditingPath(null);
    setNewName("");
  };
  const handleRename = async () => {
    if (isOperationLoading) return; // Prevent rename if another operation is running
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready for rename.");
      cancelEditing();
      return;
    }
    if (!editingPath || !newName.trim()) {
      cancelEditing();
      return;
    }
    const oldName = basename(editingPath);
    const trimmedNewName = newName.trim();
    if (trimmedNewName === oldName) {
      cancelEditing();
      return;
    }
    const newPath = joinPath(dirname(editingPath), trimmedNewName);
    try {
      // isOperationLoading set/unset within vfs.rename
      await vfs.rename(editingPath, newPath);
      // Success toast handled by the hook
      if (checkedPaths.has(editingPath)) {
        removeSelectedVfsPath(editingPath);
        addSelectedVfsPath(newPath);
      }
      cancelEditing();
      loadEntries(currentPath); // Refresh list after successful rename
    } catch (error) {
      // Error already toasted by the hook
      console.error("FileManager Rename Error (already toasted):", error);
      // Don't cancel editing on error, let user retry or cancel explicitly
    }
  };
  useEffect(() => {
    if (editingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingPath]);

  // --- Create Folder Logic ---
  const startCreatingFolder = () => {
    if (isAnyLoading || editingPath) return; // Prevent creating while loading or editing
    setCreatingFolder(true);
    setNewFolderName("");
    setEditingPath(null); // Ensure not in rename mode
  };
  const cancelCreatingFolder = () => {
    setCreatingFolder(false);
    setNewFolderName("");
  };
  const handleCreateFolder = async () => {
    if (isOperationLoading) return; // Prevent create if another operation is running
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready to create folder.");
      cancelCreatingFolder();
      return;
    }
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      cancelCreatingFolder();
      return;
    }
    const newPath = joinPath(currentPath, trimmedName);
    try {
      // isOperationLoading set/unset within vfs.createDirectory
      await vfs.createDirectory(newPath);
      toast.success(`Folder "${trimmedName}" created.`); // Keep specific success toast here
      cancelCreatingFolder();
      loadEntries(currentPath); // Refresh list after successful creation
    } catch (error) {
      // Error already toasted by the hook
      console.error(
        "FileManager Create Folder Error (already toasted):",
        error,
      );
      // Don't cancel creating on error, let user retry or cancel explicitly
    }
  };
  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);

  // --- Render Logic ---
  if (isConfigLoading) {
    // Show skeletons only during initial config loading
    return (
      <div className={cn("p-4 space-y-2", className)}>
        <Skeleton className="h-8 w-1/2 bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
      </div>
    );
  }
  if (configError) {
    // Show configuration/readiness errors prominently
    return (
      <div className="p-4 text-center text-red-400 flex items-center justify-center gap-2">
        <AlertCircleIcon className="h-5 w-5" />
        <span>{configError}</span>
      </div>
    );
  }
  if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
    // Show message if VFS is disabled or not configured for the current item
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Virtual Filesystem not available or not enabled for this item.
      </div>
    );
  }

  // --- Main File Manager UI ---
  return (
    <div className={cn("flex flex-col h-[400px]", className)}>
      <FileManagerBanner
        vfsKey={vfs.vfsKey}
        selectedItemType={selectedItemType}
      />
      <FileManagerToolbar
        currentPath={currentPath}
        isAnyLoading={isAnyLoading}
        isOperationLoading={isOperationLoading}
        entries={entries}
        editingPath={editingPath}
        creatingFolder={creatingFolder}
        handleNavigateHome={handleNavigateHome}
        handleNavigateUp={handleNavigateUp}
        handleRefresh={handleRefresh}
        startCreatingFolder={startCreatingFolder}
        handleUploadClick={handleUploadClick}
        handleFolderUploadClick={handleFolderUploadClick}
        handleArchiveUploadClick={handleArchiveUploadClick}
        handleDownloadAll={handleDownloadAll}
        fileInputRef={fileInputRef}
        folderInputRef={folderInputRef}
        archiveInputRef={archiveInputRef}
        handleFileChange={handleFileChange}
        handleArchiveChange={handleArchiveChange}
      />
      <FileManagerTable
        entries={entries}
        editingPath={editingPath}
        newName={newName}
        creatingFolder={creatingFolder}
        newFolderName={newFolderName}
        checkedPaths={checkedPaths}
        isOperationLoading={isOperationLoading}
        handleNavigate={handleNavigate}
        handleCheckboxChange={handleCheckboxChange}
        startEditing={startEditing}
        cancelEditing={cancelEditing}
        handleRename={handleRename}
        cancelCreatingFolder={cancelCreatingFolder}
        handleCreateFolder={handleCreateFolder}
        handleDownload={handleDownload}
        handleDelete={handleDelete}
        setNewName={setNewName}
        setNewFolderName={setNewFolderName}
        renameInputRef={renameInputRef}
        newFolderInputRef={newFolderInputRef}
      />
    </div>
  );
};
