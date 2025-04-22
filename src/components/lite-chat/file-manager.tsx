// src/components/lite-chat/file-manager.tsx
import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { useVfsStore } from "@/store/vfs.store";
import { useSidebarStore } from "@/store/sidebar.store";
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

const FileManagerComponent: React.FC<{ className?: string }> = ({
  className,
}) => {
  const vfsKey = useVfsStore((s) => s.vfsKey);
  const isVfsReady = useVfsStore((s) => s.isVfsReady);
  const isVfsLoading = useVfsStore((s) => s.isVfsLoading);
  const isVfsOperationLoading = useVfsStore((s) => s.isVfsOperationLoading);
  const vfsError = useVfsStore((s) => s.vfsError);
  const selectedVfsPaths = useVfsStore((s) => s.selectedVfsPaths);
  const addSelectedVfsPath = useVfsStore((s) => s.addSelectedVfsPath);
  const removeSelectedVfsPath = useVfsStore((s) => s.removeSelectedVfsPath);
  const listFiles = useVfsStore((s) => s.listFiles);
  const deleteVfsItem = useVfsStore((s) => s.deleteVfsItem);
  const downloadAllAsZip = useVfsStore((s) => s.downloadAllAsZip);
  const downloadFile = useVfsStore((s) => s.downloadFile);
  const uploadFiles = useVfsStore((s) => s.uploadFiles);
  const uploadAndExtractZip = useVfsStore((s) => s.uploadAndExtractZip);
  const renameVfsItem = useVfsStore((s) => s.renameVfsItem);
  const createDirectory = useVfsStore((s) => s.createDirectory);
  const fsInstance = useVfsStore((s) => s.fs);

  const selectedItemType = useSidebarStore((s) => s.selectedItemType);

  useEffect(() => {
    // Store the effect cleanup status
    let isMounted = true;
    console.log(
      `[FileManager] Effect triggered. isVfsReady: ${isVfsReady}, vfsKey: ${vfsKey}`,
    );

    const loadInitialData = async () => {
      if (!isVfsReady) return;
      if (!isMounted) return;

      try {
        console.log(`[FileManager] Loading entries for root path`);
        // Force loading from root directory
        const normalizedPath = "/";
        const fetchedEntries = await listFiles(normalizedPath);

        if (!isMounted) return;

        fetchedEntries.sort((a: FileSystemEntry, b: FileSystemEntry) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        setEntries(fetchedEntries);
        setCurrentPath(normalizedPath);
        console.log(
          `[FileManager] Loaded ${fetchedEntries.length} entries for root`,
        );
      } catch (error) {
        console.error(`[FileManager] Initial load error:`, error);
        if (isMounted) {
          setEntries([]);
        }
      }
    };

    if (isVfsReady) {
      loadInitialData();
    } else {
      setEntries([]);
      setGitRepoStatus({});
      setEditingPath(null);
      setCreatingFolder(false);
      setCurrentPath("/");
      console.log("[FileManager] VFS not ready, resetting state.");
    }

    return () => {
      isMounted = false;
    };

    // Only run when these specific props change
  }, [isVfsReady, vfsKey, listFiles]);

  const git = useGit(fsInstance);

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

  const isConfigLoading = isVfsLoading;
  const isCombinedOperationLoading = isVfsOperationLoading || git.loading;
  const configError = vfsError;
  const isAnyLoading = isConfigLoading || isCombinedOperationLoading;

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

  // Replace the loadEntries function with this version that has safeguards
  const loadEntries = useCallback(
    async (path: string, forceRefresh = false) => {
      if (!isVfsReady || isCombinedOperationLoading) {
        console.log(
          `[FileManager] loadEntries skipped. isVfsReady: ${isVfsReady}, isAnyLoading: ${isCombinedOperationLoading}`,
        );
        return;
      }

      // Skip if already showing this path AND not forcing a refresh
      if (path === currentPath && !forceRefresh) {
        console.log(`[FileManager] Already showing path: ${path}`);
        return;
      }

      try {
        console.log(`[FileManager] Loading entries for path: ${path}`);
        const normalizedPath = normalizePath(path);
        const fetchedEntries = await listFiles(normalizedPath);

        fetchedEntries.sort((a: FileSystemEntry, b: FileSystemEntry) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        setEntries(fetchedEntries);
        setCurrentPath(normalizedPath);
        await checkGitStatusForEntries(fetchedEntries);
        console.log(
          `[FileManager] Loaded ${fetchedEntries.length} entries for ${normalizedPath}`,
        );
      } catch (error) {
        console.error(`[FileManager] List Error for path ${path}:`, error);
        setEntries([]);
      }
    },
    [
      isVfsReady,
      isCombinedOperationLoading,
      currentPath,
      listFiles,
      checkGitStatusForEntries,
    ],
  );

  const handleNavigate = useCallback(
    (entry: FileSystemEntry) => {
      if (isAnyLoading || editingPath) return;
      if (entry.isDirectory) {
        loadEntries(entry.path);
      }
    },
    [isAnyLoading, editingPath, loadEntries],
  );

  const handleNavigateUp = useCallback(() => {
    if (isAnyLoading) return;
    if (currentPath !== "/") {
      loadEntries(dirname(currentPath));
    }
  }, [isAnyLoading, currentPath, loadEntries]);

  const handleNavigateHome = useCallback(() => {
    if (isAnyLoading) return;
    loadEntries("/");
  }, [isAnyLoading, loadEntries]);

  const handleRefresh = useCallback(() => {
    if (isAnyLoading) return;
    loadEntries(currentPath);
  }, [isAnyLoading, currentPath, loadEntries]);

  const handleCheckboxChange = useCallback(
    (checked: boolean, path: string) => {
      if (isCombinedOperationLoading) return;
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
    [addSelectedVfsPath, removeSelectedVfsPath, isCombinedOperationLoading],
  );

  const handleDelete = useCallback(
    async (entry: FileSystemEntry) => {
      if (isAnyLoading) return;
      if (!isVfsReady) {
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
          await deleteVfsItem(entry.path, entry.isDirectory);
          loadEntries(currentPath, true); // Force refresh
        } catch (error) {
          console.error("FileManager Delete Error (handled by store):", error);
        }
      }
    },
    [isAnyLoading, isVfsReady, loadEntries, currentPath, deleteVfsItem],
  );

  const handleDownload = useCallback(
    async (entry: FileSystemEntry) => {
      if (isAnyLoading) return;
      if (!isVfsReady) {
        toast.error("Filesystem not ready.");
        return;
      }
      try {
        if (entry.isDirectory) {
          const filename = `vfs_${entry.name}.zip`;
          await downloadAllAsZip(filename, entry.path);
        } else {
          await downloadFile(entry.path, entry.name);
        }
      } catch (error) {
        console.error("FileManager Download Error (handled by store):", error);
      }
    },
    [isAnyLoading, isVfsReady, downloadAllAsZip, downloadFile],
  );

  const handleUploadClick = useCallback(() => {
    if (isAnyLoading) return;
    fileInputRef.current?.click();
  }, [isAnyLoading]);
  const handleFolderUploadClick = useCallback(() => {
    if (isAnyLoading) return;
    folderInputRef.current?.click();
  }, [isAnyLoading]);
  const handleArchiveUploadClick = useCallback(() => {
    if (isAnyLoading) return;
    archiveInputRef.current?.click();
  }, [isAnyLoading]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isAnyLoading) {
        e.target.value = "";
        return;
      }
      if (!isVfsReady) {
        toast.error("Filesystem not ready for upload.");
        e.target.value = "";
        return;
      }
      const files = e.target.files;
      if (files && files.length > 0) {
        try {
          await uploadFiles(Array.from(files), currentPath);
          loadEntries(currentPath, true); // Force refresh
        } catch (error) {
          console.error("FileManager Upload Error (handled by store):", error);
        }
      }
      e.target.value = "";
    },
    [isAnyLoading, isVfsReady, uploadFiles, loadEntries, currentPath],
  );

  const handleArchiveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isAnyLoading) {
        e.target.value = "";
        return;
      }
      if (!isVfsReady) {
        toast.error("Filesystem not ready for archive extraction.");
        e.target.value = "";
        return;
      }
      const file = e.target.files?.[0];
      if (file) {
        if (file.name.toLowerCase().endsWith(".zip")) {
          try {
            await uploadAndExtractZip(file, currentPath);
            loadEntries(currentPath, true); // Force refresh
          } catch (error) {
            console.error(
              "FileManager Extract Error (handled by store):",
              error,
            );
          }
        } else {
          toast.error("Only ZIP archive extraction is currently supported.");
        }
      }
      e.target.value = "";
    },
    [isAnyLoading, isVfsReady, loadEntries, currentPath, uploadAndExtractZip],
  );

  const handleDownloadAll = useCallback(async () => {
    if (isAnyLoading) return;
    if (!isVfsReady) {
      toast.error("Filesystem not ready for export.");
      return;
    }
    try {
      const filename = `vfs_${basename(currentPath) || "root"}_export.zip`;
      await downloadAllAsZip(filename, currentPath);
    } catch (error) {
      console.error("FileManager Export Error (handled by store):", error);
    }
  }, [isAnyLoading, isVfsReady, currentPath, downloadAllAsZip]);

  const startEditing = useCallback(
    (entry: FileSystemEntry) => {
      if (isAnyLoading || creatingFolder) return;
      setEditingPath(entry.path);
      setNewName(entry.name);
      setCreatingFolder(false);
    },
    [isAnyLoading, creatingFolder],
  );

  const cancelEditing = useCallback(() => {
    setEditingPath(null);
    setNewName("");
  }, []);

  const handleRename = useCallback(async () => {
    if (isCombinedOperationLoading) return;
    if (!isVfsReady) {
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
      await renameVfsItem(editingPath, newPath);
      cancelEditing();
      loadEntries(currentPath, true); // Force refresh
    } catch (error) {
      console.error("FileManager Rename Error (handled by store):", error);
    }
  }, [
    isCombinedOperationLoading,
    isVfsReady,
    editingPath,
    newName,
    currentPath,
    cancelEditing,
    loadEntries,
    renameVfsItem,
  ]);

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
    if (isCombinedOperationLoading) return;
    if (!isVfsReady) {
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
      await createDirectory(newPath);
      toast.success(`Folder "${trimmedName}" created.`);
      cancelCreatingFolder();
      loadEntries(currentPath, true); // Force refresh even though we're on the same path
    } catch (error) {
      console.error(
        "FileManager Create Folder Error (handled by store):",
        error,
      );
    }
  };
  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);

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
        loadEntries(currentPath);
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
      await git.pushChanges(path);
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
      if (result.success) {
        console.log(`Git Status for ${path}:`, result.data);
        const branch = result.data.branch ?? "Unknown";
        const commitMsg = result.data.lastCommit?.message ?? "No commits yet";
        toast.info(
          `Git Status for ${basename(path)}: Branch: ${branch}, Last Commit: ${commitMsg.substring(0, 50)}...`,
        );
      } else {
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
      setIsCommitDialogOpen(false);
      setCommitPath(null);
    }
  }, [commitPath, commitMessage, git]);

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
      const currentEntriesInPath = await listFiles(currentPath);
      const conflict = currentEntriesInPath.find(
        (entry: FileSystemEntry) => entry.name === repoName,
      );

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
  if (!isVfsReady) {
    console.log(
      `[FileManager] Not ready. isVfsReady=${isVfsReady}, isVfsLoading=${isVfsLoading}, vfsError=${vfsError}`,
    );
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        {isVfsLoading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2Icon className="h-4 w-4 animate-spin" />
            <span>Initializing Virtual Filesystem...</span>
          </div>
        ) : (
          <span>
            Virtual Filesystem not available or not enabled for this item.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-[400px]", className)}>
      <FileManagerBanner vfsKey={vfsKey} selectedItemType={selectedItemType} />
      <FileManagerToolbar
        currentPath={currentPath}
        isAnyLoading={isAnyLoading}
        isOperationLoading={isCombinedOperationLoading}
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
      {isCombinedOperationLoading ? (
        // Use a simple loading indicator during operations
        <div className="flex-1 flex items-center justify-center">
          <Loader2Icon className="h-5 w-5 mr-2 animate-spin" />
          <span>Loading files...</span>
        </div>
      ) : (
        // Only render the table when not loading
        <FileManagerTable
          entries={entries}
          editingPath={editingPath}
          newName={newName}
          creatingFolder={creatingFolder}
          newFolderName={newFolderName}
          checkedPaths={checkedPaths}
          isOperationLoading={false} // IMPORTANT: force this to false to prevent ScrollArea issues
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
      )}

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
export const FileManager = memo(FileManagerComponent);
