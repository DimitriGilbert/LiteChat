// src/components/lite-chat/file-manager.tsx
import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useMemo
import { useChatContext } from "@/hooks/use-chat-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox
// ... other imports ...
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

// --- Helper Functions (remain the same) ---
const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};
const normalizePath = (path: string): string => {
  return path.replace(/\//g, "/").replace(/\/+/g, "/");
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
  if (lastSlash === -1) return "/";
  if (lastSlash === 0) return "/";
  return normalized.substring(0, lastSlash);
};
const basename = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  return normalized.substring(normalized.lastIndexOf("/") + 1);
};
// --- End Helper Functions ---

export const FileManager: React.FC<{ className?: string }> = ({
  className,
}) => {
  const {
    vfs,
    selectedItemId,
    selectedVfsPaths, // Get selected paths from context
    addSelectedVfsPath, // Get actions from context
    removeSelectedVfsPath,
  } = useChatContext();
  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Local state for checked paths within this component instance
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(
    () => new Set(selectedVfsPaths), // Initialize from context
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const isConfigLoading = vfs.isLoading;
  const isOperationLoading = vfs.isOperationLoading;
  const isAnyLoading = isConfigLoading || isOperationLoading;

  // Sync local checked state when context selection changes
  useEffect(() => {
    setCheckedPaths(new Set(selectedVfsPaths));
  }, [selectedVfsPaths]);

  const loadEntries = useCallback(
    async (path: string) => {
      if (
        !vfs.isReady ||
        vfs.configuredItemId !== selectedItemId ||
        isAnyLoading
      ) {
        return;
      }
      try {
        const normalizedPath = normalizePath(path);
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
        console.error("FileManager List Error:", error);
      }
    },
    [vfs, selectedItemId, isAnyLoading],
  );

  useEffect(() => {
    if (vfs.isReady && vfs.configuredItemId === selectedItemId) {
      console.log(
        `[FileManager] Effect: VFS ready for ${selectedItemId}, loading path: ${currentPath}`,
      );
      loadEntries(currentPath);
    } else {
      console.log(
        `[FileManager] Effect: VFS not ready or ID mismatch. isReady=${vfs.isReady}, configuredId=${vfs.configuredItemId}, selectedId=${selectedItemId}. Clearing state.`,
      );
      setEntries([]);
      setCurrentPath("/");
      setEditingPath(null);
      setCreatingFolder(false);
      // No need to clear checkedPaths here, it syncs via useEffect on selectedVfsPaths
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vfs.isReady, vfs.configuredItemId, selectedItemId]);

  // --- Navigation Handlers (remain the same) ---
  const handleNavigate = (entry: FileSystemEntry) => {
    if (entry.isDirectory) {
      loadEntries(entry.path);
    } else {
      // Maybe download on single click? Or show preview? For now, do nothing.
      // toast.info(`File: ${entry.name}`);
    }
  };
  const handleNavigateUp = () => {
    if (currentPath !== "/") {
      loadEntries(dirname(currentPath));
    }
  };
  const handleNavigateHome = () => {
    loadEntries("/");
  };
  const handleRefresh = () => {
    loadEntries(currentPath);
  };
  // --- End Navigation Handlers ---

  // --- Checkbox Handler ---
  const handleCheckboxChange = useCallback(
    (checked: boolean, path: string) => {
      setCheckedPaths((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(path);
          addSelectedVfsPath(path); // Update context
        } else {
          next.delete(path);
          removeSelectedVfsPath(path); // Update context
        }
        return next;
      });
    },
    [addSelectedVfsPath, removeSelectedVfsPath],
  );

  // --- Action Handlers (remain the same, use vfs from context) ---
  const handleDelete = async (entry: FileSystemEntry) => {
    if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
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
        await vfs.deleteItem(entry.path, entry.isDirectory);
        toast.success(`"${entry.name}" deleted.`);
        // If deleted file was selected, remove it from context
        if (!entry.isDirectory && checkedPaths.has(entry.path)) {
          removeSelectedVfsPath(entry.path);
        }
        loadEntries(currentPath);
      } catch {
        /* Error handled in hook */
      }
    }
  };

  const handleDownload = async (entry: FileSystemEntry) => {
    if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
      toast.error("Filesystem not ready.");
      return;
    }
    if (entry.isDirectory) {
      toast.warning(
        `Folder download for "${entry.name}" not yet implemented. Use Export button.`,
      );
    } else {
      try {
        await vfs.downloadFile(entry.path, entry.name);
      } catch {
        /* Error handled in hook */
      }
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFolderUploadClick = () => folderInputRef.current?.click();
  const handleArchiveUploadClick = () => archiveInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
      toast.error("Filesystem not ready for upload.");
      e.target.value = "";
      return;
    }
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        await vfs.uploadFiles(files, currentPath);
        loadEntries(currentPath);
      } catch {
        /* Error handled in hook */
      }
    }
    e.target.value = "";
  };

  const handleArchiveChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
      toast.error("Filesystem not ready for archive extraction.");
      e.target.value = "";
      return;
    }
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith(".zip")) {
        try {
          await vfs.uploadAndExtractZip(file, currentPath);
          loadEntries(currentPath);
        } catch {
          /* Error handled in hook */
        }
      } else {
        toast.error("Only ZIP archive extraction is currently supported.");
      }
    }
    e.target.value = "";
  };

  const handleDownloadAll = async () => {
    if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
      toast.error("Filesystem not ready for export.");
      return;
    }
    try {
      const filename = `vfs_${basename(currentPath) || "root"}.zip`;
      await vfs.downloadAllAsZip(filename);
    } catch {
      /* Error handled in hook */
    }
  };
  // --- End Action Handlers ---

  // --- Rename Logic (remain the same, use vfs from context) ---
  const startEditing = (entry: FileSystemEntry) => {
    setEditingPath(entry.path);
    setNewName(entry.name);
    setCreatingFolder(false);
  };
  const cancelEditing = () => {
    setEditingPath(null);
    setNewName("");
  };
  const handleRename = async () => {
    if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
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
      await vfs.rename(editingPath, newPath);
      toast.success(`Renamed "${oldName}" to "${trimmedNewName}"`);
      // If renamed file was selected, update the selection path
      if (checkedPaths.has(editingPath)) {
        removeSelectedVfsPath(editingPath);
        addSelectedVfsPath(newPath);
      }
      cancelEditing();
      loadEntries(currentPath);
    } catch {
      cancelEditing();
    }
  };
  useEffect(() => {
    if (editingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingPath]);
  // --- End Rename Logic ---

  // --- Create Folder Logic (remain the same, use vfs from context) ---
  const startCreatingFolder = () => {
    setCreatingFolder(true);
    setNewFolderName("");
    setEditingPath(null);
  };
  const cancelCreatingFolder = () => {
    setCreatingFolder(false);
    setNewFolderName("");
  };
  const handleCreateFolder = async () => {
    if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
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
      await vfs.createDirectory(newPath);
      toast.success(`Folder "${trimmedName}" created.`);
      cancelCreatingFolder();
      loadEntries(currentPath);
    } catch {
      cancelCreatingFolder();
    }
  };
  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);
  // --- End Create Folder Logic ---

  // --- Render Logic ---
  if (isConfigLoading) {
    return (
      <div className={cn("p-4 space-y-2", className)}>
        <Skeleton className="h-8 w-1/2 bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
      </div>
    );
  }
  if (vfs.error) {
    return (
      <div className="p-4 text-center text-red-400">
        Error initializing filesystem: {vfs.error}
      </div>
    );
  }
  if (!vfs.isReady || vfs.configuredItemId !== selectedItemId) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Virtual Filesystem not available or not enabled for this item.
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-[400px]", className)}>
      {/* Hidden Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
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
      />
      <input
        type="file"
        ref={archiveInputRef}
        onChange={handleArchiveChange}
        className="hidden"
        accept=".zip"
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
          <FolderPlusIcon className="h-4 w-4 mr-1" /> Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadClick}
          disabled={isAnyLoading}
          className="h-8"
          title="Upload Files"
        >
          <UploadCloudIcon className="h-4 w-4 mr-1" /> Files
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFolderUploadClick}
          disabled={isAnyLoading}
          className="h-8"
          title="Upload Folder"
        >
          <FolderIcon className="h-4 w-4 mr-1" /> Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleArchiveUploadClick}
          disabled={isAnyLoading}
          className="h-8"
          title="Upload & Extract ZIP"
        >
          <FileArchiveIcon className="h-4 w-4 mr-1" /> ZIP
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadAll}
          disabled={isAnyLoading || entries.length === 0}
          className="h-8"
          title="Download Current Directory as ZIP"
        >
          <ArchiveIcon className="h-4 w-4 mr-1" /> Export
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
                      onBlur={handleCreateFolder}
                      placeholder="New folder name..."
                      className="h-6 px-1 text-xs flex-grow bg-gray-800 border-gray-600 focus:ring-blue-500"
                      disabled={isOperationLoading}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right px-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-green-500 hover:bg-green-900/50"
                    onClick={handleCreateFolder}
                    disabled={isOperationLoading || !newFolderName.trim()}
                    title="Create folder"
                  >
                    <CheckIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:bg-gray-600/50"
                    onClick={cancelCreatingFolder}
                    disabled={isOperationLoading}
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
                )}
                onDoubleClick={() => !editingPath && handleNavigate(entry)}
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
                      disabled={isOperationLoading}
                      aria-label={`Select file ${entry.name}`}
                      className="mt-0.5" // Adjust alignment if needed
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
                        onBlur={handleRename}
                        className="h-6 px-1 text-xs flex-grow bg-gray-800 border-gray-600 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                        disabled={isOperationLoading}
                      />
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer"
                      onClick={() => handleNavigate(entry)}
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
                        disabled={isOperationLoading || !newName.trim()}
                        title="Save name"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:bg-gray-600/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEditing();
                        }}
                        disabled={isOperationLoading}
                        title="Cancel rename"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-gray-600/50"
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(entry);
                        }}
                        disabled={isOperationLoading || creatingFolder}
                      >
                        <Edit2Icon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-gray-600/50"
                        title={
                          entry.isDirectory
                            ? "Download (ZIP - Not Impl.)"
                            : "Download"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(entry);
                        }}
                        disabled={isOperationLoading || entry.isDirectory}
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
                        disabled={isOperationLoading}
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {entries.length === 0 && !creatingFolder && (
              <TableRow>
                <TableCell
                  colSpan={6} // Adjusted colspan
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
