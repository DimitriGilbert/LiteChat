// src/components/lite-chat/file-manager.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FileSystemEntry } from "@/lib/types";
import { toast } from "sonner";
import {
  FolderIcon,
  FileIcon,
  DownloadIcon,
  Trash2Icon,
  UploadCloudIcon,
  ArchiveIcon,
  FolderUpIcon,
  RefreshCwIcon,
  FileArchiveIcon,
  HomeIcon,
  Edit2Icon,
  CheckIcon,
  XIcon,
  FolderPlusIcon,
  Loader2Icon,
  UsersIcon,
  AlertCircleIcon, // Added for error display
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};
const normalizePath = (path: string): string => {
  // Ensure leading slash, remove trailing slash (unless root), collapse multiple slashes
  let p = path.replace(/\/+/g, "/");
  if (!p.startsWith("/")) {
    p = "/" + p;
  }
  if (p !== "/" && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
};
const joinPath = (...segments: string[]): string => {
  return normalizePath(
    segments
      .map((s) => s.trim())
      .filter(Boolean)
      .join("/"),
  );
};
const dirname = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) return "/"; // Should not happen with normalizePath
  if (lastSlash === 0) return "/"; // Parent of /file is /
  return normalized.substring(0, lastSlash);
};
const basename = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return ""; // No basename for root
  return normalized.substring(normalized.lastIndexOf("/") + 1);
};

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
        // toast.success(`"${entry.name}" deleted.`); // Removed: Handled by hook
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
      // toast.success(`Renamed "${oldName}" to "${trimmedNewName}"`); // Removed: Handled by hook
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
      // cancelEditing();
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
      // cancelCreatingFolder();
    }
  };
  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);

  // --- VFS Sharing Banner ---
  // (No changes needed here based on requirements)
  let vfsBanner: React.ReactNode = null;
  if (vfs.vfsKey === "orphan") {
    vfsBanner = (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <UsersIcon className="h-4 w-4" />
        <span>
          <b>Shared VFS:</b> All chats <i>not</i> in a project share this
          filesystem.
        </span>
      </div>
    );
  } else if (vfs.vfsKey && selectedItemType === "conversation") {
    vfsBanner = (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <UsersIcon className="h-4 w-4" />
        <span>
          <b>Project-shared VFS:</b> All chats in this project share this
          filesystem.
        </span>
      </div>
    );
  } else if (vfs.vfsKey && selectedItemType === "project") {
    vfsBanner = (
      <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/40 px-2 py-1 rounded mb-1">
        <FolderIcon className="h-4 w-4" />
        <span>
          <b>Project VFS:</b> Filesystem for this project and all its chats.
        </span>
      </div>
    );
  }

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
      {vfsBanner}
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

      {/* File List Table */}
      <ScrollArea className="flex-grow">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px] px-2"></TableHead>
              <TableHead className="w-[40px] px-2"></TableHead>
              <TableHead className="px-2">Name</TableHead>
              <TableHead className="w-[100px] px-2">Size</TableHead>
              <TableHead className="w-[150px] px-2">Modified</TableHead>
              <TableHead className="w-[100px] text-right px-2">
                Actions
              </TableHead>
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
                      // onBlur={handleCreateFolder} // Avoid auto-create on blur if operation is loading
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
                        // onBlur={handleRename} // Avoid auto-rename on blur if operation is loading
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
                      onClick={() =>
                        !isOperationLoading && handleNavigate(entry)
                      } // Allow click nav only if not loading
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
                        disabled={isAnyLoading || creatingFolder} // Disable if any loading or creating folder
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
                        disabled={isAnyLoading} // Disable if any loading
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
                        disabled={isAnyLoading} // Disable if any loading
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
                <TableCell
                  colSpan={6}
                  className="text-center text-gray-500 py-6"
                >
                  Folder is empty
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};
