// src/components/lite-chat/file-manager.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
import { useGit } from "@/hooks/use-git";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FileSystemEntry } from "@/lib/types";
import { toast } from "sonner";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import {
  normalizePath,
  joinPath,
  dirname,
  basename,
} from "@/utils/file-manager-utils";
import { FileManagerBanner } from "./file-manager/file-manager-banner";
import { FileManagerToolbar } from "./file-manager/file-manager-toolbar";
import { FileManagerTable } from "./file-manager/file-manager-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// Removed unused import: import type { GitRepoInfoData } from "@/utils/git-utils";

// Helper function to extract repo name from URL
const getRepoNameFromUrl = (url: string): string => {
  try {
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const lastPart = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
    return lastPart.endsWith(".git") ? lastPart.slice(0, -4) : lastPart;
  } catch (e) {
    console.error("Failed to parse repo name from URL:", url, e);
    return "repository";
  }
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
  const git = useGit(vfs.fs);

  const [currentPath, setCurrentPath] = useState("/");
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(
    () => new Set(selectedVfsPaths),
  );

  const [gitRepoStatus, setGitRepoStatus] = useState<Record<string, boolean>>(
    {},
  );
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitPath, setCommitPath] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);

  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [cloneRepoUrl, setCloneRepoUrl] = useState("");
  const [cloneBranch, setCloneBranch] = useState("main");
  const [isCloning, setIsCloning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const isConfigLoading = vfs.isLoading;
  const isOperationLoading = vfs.isOperationLoading || git.loading;
  const configError = vfs.error;
  const isAnyLoading = isConfigLoading || isOperationLoading;

  useEffect(() => {
    setCheckedPaths(new Set(selectedVfsPaths));
  }, [selectedVfsPaths]);

  const checkGitStatusForEntries = useCallback(
    async (currentEntries: FileSystemEntry[]) => {
      if (!git.initialized) return;

      const statusUpdates: Record<string, boolean> = {};
      const promises = currentEntries
        .filter((entry) => entry.isDirectory)
        .map(async (dirEntry) => {
          try {
            const isRepo = await git.isGitRepository(dirEntry.path);
            statusUpdates[dirEntry.path] = isRepo;
          } catch (error) {
            console.error(
              `Error checking git status for ${dirEntry.path}:`,
              error,
            );
            statusUpdates[dirEntry.path] = false;
          }
        });

      await Promise.allSettled(promises);
      setGitRepoStatus((prev) => ({ ...prev, ...statusUpdates }));
    },
    [git],
  );

  const loadEntries = useCallback(
    async (path: string) => {
      if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey || isAnyLoading) {
        return;
      }
      try {
        const normalizedPath = normalizePath(path);
        const fetchedEntries = await vfs.listFiles(normalizedPath);
        fetchedEntries.sort((a: FileSystemEntry, b: FileSystemEntry) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        setEntries(fetchedEntries);
        setCurrentPath(normalizedPath);
        await checkGitStatusForEntries(fetchedEntries);
      } catch (error) {
        console.error("FileManager List Error (already toasted):", error);
        setEntries([]);
      }
    },
    [vfs, isAnyLoading, checkGitStatusForEntries],
  );

  useEffect(() => {
    if (vfs.isReady && vfs.configuredVfsKey === vfs.vfsKey) {
      loadEntries(currentPath);
    } else {
      setEntries([]);
      setGitRepoStatus({});
      setEditingPath(null);
      setCreatingFolder(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vfs.isReady, vfs.configuredVfsKey, vfs.vfsKey]);

  const handleNavigate = (entry: FileSystemEntry) => {
    if (isAnyLoading || editingPath) return;
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

  const handleCheckboxChange = useCallback(
    (checked: boolean, path: string) => {
      if (isOperationLoading) return;
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

  const handleDelete = async (entry: FileSystemEntry) => {
    if (isAnyLoading) return;
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
        await vfs.deleteItem(entry.path, entry.isDirectory);
        if (!entry.isDirectory && checkedPaths.has(entry.path)) {
          removeSelectedVfsPath(entry.path);
        }
        loadEntries(currentPath);
      } catch (error) {
        console.error("FileManager Delete Error (already toasted):", error);
      }
    }
  };

  const handleDownload = async (entry: FileSystemEntry) => {
    if (isAnyLoading) return;
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready.");
      return;
    }
    try {
      if (entry.isDirectory) {
        const filename = `vfs_${entry.name}.zip`;
        await vfs.downloadAllAsZip(filename, entry.path);
      } else {
        await vfs.downloadFile(entry.path, entry.name);
      }
    } catch (error) {
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
      e.target.value = "";
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
        await vfs.uploadFiles(files, currentPath);
        loadEntries(currentPath);
      } catch (error) {
        console.error("FileManager Upload Error (already toasted):", error);
      }
    }
    e.target.value = "";
  };

  const handleArchiveChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (isAnyLoading) {
      e.target.value = "";
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
          await vfs.uploadAndExtractZip(file, currentPath);
          loadEntries(currentPath);
        } catch (error) {
          console.error("FileManager Extract Error (already toasted):", error);
        }
      } else {
        toast.error("Only ZIP archive extraction is currently supported.");
      }
    }
    e.target.value = "";
  };

  const handleDownloadAll = async () => {
    if (isAnyLoading) return;
    if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
      toast.error("Filesystem not ready for export.");
      return;
    }
    try {
      const filename = `vfs_${basename(currentPath) || "root"}_export.zip`;
      await vfs.downloadAllAsZip(filename, currentPath);
    } catch (error) {
      console.error("FileManager Export Error (already toasted):", error);
    }
  };

  const startEditing = (entry: FileSystemEntry) => {
    if (isAnyLoading || creatingFolder) return;
    setEditingPath(entry.path);
    setNewName(entry.name);
    setCreatingFolder(false);
  };
  const cancelEditing = () => {
    setEditingPath(null);
    setNewName("");
  };
  const handleRename = async () => {
    if (isOperationLoading) return;
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
      await vfs.rename(editingPath, newPath);
      if (checkedPaths.has(editingPath)) {
        removeSelectedVfsPath(editingPath);
        addSelectedVfsPath(newPath);
      }
      cancelEditing();
      loadEntries(currentPath);
    } catch (error) {
      console.error("FileManager Rename Error (already toasted):", error);
    }
  };
  useEffect(() => {
    if (editingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingPath]);

  const startCreatingFolder = () => {
    if (isAnyLoading || editingPath) return;
    setCreatingFolder(true);
    setNewFolderName("");
    setEditingPath(null);
  };
  const cancelCreatingFolder = () => {
    setCreatingFolder(false);
    setNewFolderName("");
  };
  const handleCreateFolder = async () => {
    if (isOperationLoading) return;
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
      await vfs.createDirectory(newPath);
      toast.success(`Folder "${trimmedName}" created.`);
      cancelCreatingFolder();
      loadEntries(currentPath);
    } catch (error) {
      console.error(
        "FileManager Create Folder Error (already toasted):",
        error,
      );
    }
  };
  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);

  // --- Git Handlers ---
  const handleGitInit = useCallback(
    async (path: string) => {
      if (!git.initialized) {
        toast.error("Git is not ready.");
        return;
      }
      const result = await git.initRepository(path);
      if (result.success) {
        setGitRepoStatus((prev) => ({ ...prev, [path]: true }));
      }
      // No need to check result.data as init returns void
    },
    [git],
  );

  const handleGitPull = useCallback(
    async (path: string) => {
      if (!git.initialized) {
        toast.error("Git is not ready.");
        return;
      }
      const result = await git.pullChanges(path);
      if (result.success) {
        // Pull might return data (PullResult), but we don't use it here
        loadEntries(currentPath); // Refresh after pull
      }
    },
    [git, loadEntries, currentPath],
  );

  const handleGitCommit = useCallback((path: string) => {
    setCommitPath(path);
    setCommitMessage("");
    setIsCommitDialogOpen(true);
  }, []);

  const handleGitPush = useCallback(
    async (path: string) => {
      if (!git.initialized) {
        toast.error("Git is not ready.");
        return;
      }
      await git.pushChanges(path); // Success/error handled by hook
    },
    [git],
  );

  const handleGitStatus = useCallback(
    async (path: string) => {
      if (!git.initialized) {
        toast.error("Git is not ready.");
        return;
      }
      const result = await git.getRepoInfo(path);
      // ONLY check result.success before accessing result.data
      if (result.success) {
        // Now TypeScript knows result is the success type and has 'data'
        console.log(`Git Status for ${path}:`, result.data);
        const branch = result.data.branch ?? "Unknown";
        // Use optional chaining for nested properties within data
        const commitMsg = result.data.lastCommit?.message ?? "No commits yet";
        toast.info(
          `Git Status for ${basename(path)}: Branch: ${branch}, Last Commit: ${commitMsg.substring(0, 50)}...`,
        );
      } else {
        // Error handled by hook, but we could add context
        toast.error(`Failed to get Git status for ${basename(path)}.`);
      }
    },
    [git],
  );

  const submitCommit = useCallback(async () => {
    if (!commitPath || !commitMessage.trim() || !git.initialized) {
      toast.error("Commit message cannot be empty.");
      return;
    }
    setIsCommitting(true);
    const author = { name: "LiteChat User", email: "user@litechat.dev" };
    await git.addFile(commitPath, ".");
    const result = await git.commitChanges(commitPath, {
      message: commitMessage.trim(),
      author,
    });
    setIsCommitting(false);
    if (result.success) {
      // Commit returns { sha: string } in result.data if needed
      // console.log("Commit successful, SHA:", result.data.sha);
      setIsCommitDialogOpen(false);
      setCommitPath(null);
    }
  }, [commitPath, commitMessage, git]);

  // --- Clone Handlers ---
  const handleCloneClick = () => {
    if (isAnyLoading) return;
    setCloneRepoUrl("");
    setCloneBranch("main");
    setIsCloneDialogOpen(true);
  };

  const submitClone = async () => {
    const trimmedUrl = cloneRepoUrl.trim();
    const trimmedBranch = cloneBranch.trim();

    if (!trimmedUrl) {
      toast.error("Repository URL cannot be empty.");
      return;
    }
    if (!git.initialized) {
      toast.error("Git is not initialized. Please wait and try again.");
      return;
    }

    const repoName = getRepoNameFromUrl(trimmedUrl);
    if (!repoName) {
      toast.error("Could not determine repository name from URL.");
      return;
    }
    const expectedRepoPath = joinPath(currentPath, repoName);

    setIsCloning(true);

    try {
      const currentEntries = await vfs.listFiles(currentPath);
      const conflict = currentEntries.find((entry) => entry.name === repoName);

      if (conflict) {
        toast.error(
          `Cannot clone: An item named "${repoName}" already exists in ${currentPath === "/" ? "the root directory" : `"${basename(currentPath)}"`}.`,
        );
        setIsCloning(false);
        return;
      }

      const result = await git.cloneRepository(trimmedUrl, expectedRepoPath, {
        branch: trimmedBranch || undefined,
      });

      if (result.success) {
        // Clone returns void, no data to access
        setIsCloneDialogOpen(false);
        loadEntries(currentPath);
      }
    } catch (listError) {
      console.error("Error checking for existing directory:", listError);
      toast.error("Failed to check destination path before cloning.");
    } finally {
      setIsCloning(false);
    }
  };

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
  if (configError) {
    return (
      <div className="p-4 text-center text-red-400 flex items-center justify-center gap-2">
        <AlertCircleIcon className="h-5 w-5" />
        <span>{configError}</span>
      </div>
    );
  }
  if (!vfs.isReady || vfs.configuredVfsKey !== vfs.vfsKey) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        Virtual Filesystem not available or not enabled for this item.
      </div>
    );
  }

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
        handleCloneClick={handleCloneClick}
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
        gitRepoStatus={gitRepoStatus}
        handleGitInit={handleGitInit}
        handleGitPull={handleGitPull}
        handleGitCommit={handleGitCommit}
        handleGitPush={handleGitPush}
        handleGitStatus={handleGitStatus}
      />

      {/* Commit Dialog */}
      <Dialog
        open={isCommitDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCommitDialogOpen(false);
            setCommitPath(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commit Changes</DialogTitle>
            <DialogDescription>
              Enter a commit message for the changes in{" "}
              <code>{commitPath}</code>. All current changes in this directory
              will be staged and committed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="commit-msg" className="text-right">
                Message
              </Label>
              <Input
                id="commit-msg"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Add feature X"
                disabled={isCommitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCommitDialogOpen(false)}
              disabled={isCommitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitCommit}
              disabled={isCommitting || !commitMessage.trim()}
            >
              {isCommitting ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                "Commit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Dialog */}
      <Dialog
        open={isCloneDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCloneDialogOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Git Repository</DialogTitle>
            <DialogDescription>
              Enter the repository URL. It will be cloned into a new folder
              named after the repository within <code>{currentPath}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clone-url" className="text-right">
                URL
              </Label>
              <Input
                id="clone-url"
                value={cloneRepoUrl}
                onChange={(e) => setCloneRepoUrl(e.target.value)}
                className="col-span-3"
                placeholder="https://github.com/user/repo.git"
                disabled={isCloning}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clone-branch" className="text-right">
                Branch
              </Label>
              <Input
                id="clone-branch"
                value={cloneBranch}
                onChange={(e) => setCloneBranch(e.target.value)}
                className="col-span-3"
                placeholder="main (default)"
                disabled={isCloning}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCloneDialogOpen(false)}
              disabled={isCloning}
            >
              Cancel
            </Button>
            <Button
              onClick={submitClone}
              disabled={isCloning || !cloneRepoUrl.trim()}
            >
              {isCloning ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Cloning...
                </>
              ) : (
                "Clone"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
