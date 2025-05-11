// src/components/LiteChat/file-manager/FileManager.tsx
// FULL FILE
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
} from "react";
import { useVfsStore } from "@/store/vfs.store";
import { useShallow } from "zustand/react/shallow";
import { VfsNode } from "@/types/litechat/vfs";
import {
  dirname,
  basename,
  buildPath,
} from "@/lib/litechat/file-manager-utils";
import { FileManagerTable } from "./FileManagerTable";
import { FileManagerToolbar } from "./FileManagerToolbar";
import { CloneDialog } from "./CloneDialog";
import { CommitDialog } from "./CommitDialog";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileManagerList } from "./FileManagerList";
import { emitter } from "@/lib/litechat/event-emitter";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import type { ModEventPayloadMap } from "@/types/litechat/modding";

export const FileManager = memo(() => {
  const {
    nodes,
    childrenMap,
    currentParentId,
    loading,
    operationLoading: fsOperationLoading,
    error,
    rootId,
    selectedFileIds,
    vfsKey,
    configuredVfsKey,
    initializingKey,
  } = useVfsStore(
    useShallow((state) => ({
      nodes: state.nodes,
      childrenMap: state.childrenMap,
      currentParentId: state.currentParentId,
      selectedFileIds: state.selectedFileIds,
      loading: state.loading,
      operationLoading: state.operationLoading,
      error: state.error,
      rootId: state.rootId,
      vfsKey: state.vfsKey,
      configuredVfsKey: state.configuredVfsKey,
      initializingKey: state.initializingKey,
    }))
  );

  const [newName, setNewName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [gitRepoStatus, setGitRepoStatus] = useState<Record<string, boolean>>(
    {}
  );
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [cloneRepoUrl, setCloneRepoUrl] = useState("");
  const [cloneBranch, setCloneBranch] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitPath, setCommitPath] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [isGitOpLoading, setIsGitOpLoading] = useState<Record<string, boolean>>(
    {}
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);

  const currentDirectory = currentParentId ? nodes[currentParentId] : null;
  const currentPath = currentDirectory ? currentDirectory.path : "/";
  const currentChildrenIds = childrenMap[currentParentId || rootId || ""] || [];
  const currentNodes: VfsNode[] = currentChildrenIds
    .map((id) => nodes[id])
    .filter((node): node is VfsNode => !!node)
    .sort((a, b) => {
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name);
    });

  const currentFolderPaths = useMemo(() => {
    return currentNodes.filter((n) => n.type === "folder").map((n) => n.path);
  }, [currentNodes]);

  const isVfsLoading =
    loading || initializingKey !== null || vfsKey !== configuredVfsKey;

  const isAnyOperationLoading =
    fsOperationLoading ||
    isCloning ||
    isCommitting ||
    Object.values(isGitOpLoading).some(Boolean);

  useEffect(() => {
    if (
      currentParentId !== null &&
      !childrenMap[currentParentId] &&
      !isVfsLoading &&
      configuredVfsKey === vfsKey
    ) {
      emitter.emit(vfsEvent.fetchNodesRequest, { parentId: currentParentId });
    } else if (
      currentParentId === null &&
      rootId &&
      !childrenMap[rootId] &&
      !isVfsLoading &&
      configuredVfsKey === vfsKey
    ) {
      emitter.emit(vfsEvent.fetchNodesRequest, { parentId: rootId });
    }
  }, [
    currentParentId,
    childrenMap,
    rootId,
    isVfsLoading,
    configuredVfsKey,
    vfsKey,
  ]);

  useEffect(() => {
    if (editingPath) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingPath]);

  useEffect(() => {
    if (creatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [creatingFolder]);

  useEffect(() => {
    const checkGitStatus = async () => {
      if (isVfsLoading || currentFolderPaths.length === 0) return;

      const statusUpdates: Record<string, boolean> = {};
      let changed = false;
      for (const path of currentFolderPaths) {
        try {
          const isRepo = await VfsOps.isGitRepoOp(path);
          if (gitRepoStatus[path] !== isRepo) {
            statusUpdates[path] = isRepo;
            changed = true;
          }
        } catch (e) {
          console.error(`Error checking git status for ${path}:`, e);
          if (gitRepoStatus[path] !== false) {
            statusUpdates[path] = false;
            changed = true;
          }
        }
      }
      if (changed) {
        setGitRepoStatus((prev) => ({ ...prev, ...statusUpdates }));
      }
    };
    checkGitStatus();
  }, [currentFolderPaths, isVfsLoading, gitRepoStatus]);

  const runOperation = useCallback(
    async <E extends keyof ModEventPayloadMap>(
      requestEvent: E,
      payload: ModEventPayloadMap[E],
      setLoadingState?: boolean
    ) => {
      if (isAnyOperationLoading || isVfsLoading) return;
      if (setLoadingState !== false)
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: true,
          error: null,
        });

      try {
        emitter.emit(requestEvent, payload);
      } catch (err) {
        console.error("[FileManager Operation Error]:", err);
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: fsOperationLoading,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (setLoadingState !== false)
          emitter.emit(vfsEvent.loadingStateChanged, {
            isLoading: loading,
            operationLoading: false,
            error: error,
          });
      }
    },
    [isAnyOperationLoading, isVfsLoading, loading, fsOperationLoading, error]
  );

  const handleNavigate = useCallback(
    (entry: VfsNode) => {
      if (isAnyOperationLoading || isVfsLoading || editingPath) return;
      if (entry.type === "folder") {
        runOperation(
          vfsEvent.setCurrentPathRequest,
          { path: entry.path },
          false
        );
      }
    },
    [isAnyOperationLoading, isVfsLoading, editingPath, runOperation]
  );

  const handleNavigateUp = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || currentPath === "/") return;
    const parentPath = dirname(currentPath);
    runOperation(vfsEvent.setCurrentPathRequest, { path: parentPath }, false);
  }, [isAnyOperationLoading, isVfsLoading, currentPath, runOperation]);

  const handleNavigateHome = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || currentPath === "/") return;
    runOperation(vfsEvent.setCurrentPathRequest, { path: "/" }, false);
  }, [isAnyOperationLoading, isVfsLoading, currentPath, runOperation]);

  const handleRefresh = useCallback(() => {
    if (isVfsLoading) return;
    runOperation(
      vfsEvent.fetchNodesRequest,
      { parentId: currentParentId },
      false
    );
  }, [runOperation, currentParentId, isVfsLoading]);

  const handleCheckboxChange = useCallback(
    (checked: boolean, nodeId: string) => {
      const node = nodes[nodeId];
      if (node && node.type === "file") {
        if (checked) {
          emitter.emit(vfsEvent.selectFileRequest, { fileId: nodeId });
        } else {
          emitter.emit(vfsEvent.deselectFileRequest, { fileId: nodeId });
        }
      } else if (node && node.type === "folder") {
        toast.info("Folders cannot be attached to the prompt.");
      }
    },
    [nodes]
  );

  const startEditing = useCallback(
    (entry: VfsNode) => {
      if (isAnyOperationLoading || isVfsLoading || creatingFolder) return;
      setEditingPath(entry.path);
      setNewName(entry.name);
      setCreatingFolder(false);
    },
    [isAnyOperationLoading, isVfsLoading, creatingFolder]
  );

  const cancelEditing = useCallback(() => {
    setEditingPath(null);
    setNewName("");
  }, []);

  const handleRename = useCallback(async () => {
    if (!editingPath || !newName.trim()) {
      cancelEditing();
      return;
    }
    const node = Object.values(nodes).find((n) => n.path === editingPath);
    if (node && node.name !== newName.trim()) {
      await runOperation(vfsEvent.renameNodeRequest, {
        id: node.id,
        newName: newName.trim(),
      });
    }
    cancelEditing();
  }, [editingPath, newName, nodes, cancelEditing, runOperation]);

  const startCreatingFolder = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || editingPath) return;
    setCreatingFolder(true);
    setNewFolderName("");
    setEditingPath(null);
  }, [isAnyOperationLoading, isVfsLoading, editingPath]);

  const cancelCreatingFolder = useCallback(() => {
    setCreatingFolder(false);
    setNewFolderName("");
  }, []);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) {
      cancelCreatingFolder();
      return;
    }
    await runOperation(vfsEvent.createDirectoryRequest, {
      parentId: currentParentId,
      name: newFolderName.trim(),
    });
    cancelCreatingFolder();
  }, [newFolderName, currentParentId, cancelCreatingFolder, runOperation]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFolderUploadClick = () => folderInputRef.current?.click();
  const handleArchiveUploadClick = () => archiveInputRef.current?.click();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await runOperation(vfsEvent.uploadFilesRequest, {
          parentId: currentParentId,
          files,
        });
        if (e.target) e.target.value = "";
      }
    },
    [currentParentId, runOperation]
  );

  const handleArchiveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: true,
          error: null,
        });
        try {
          await VfsOps.uploadAndExtractZipOp(file, currentPath);
          emitter.emit(vfsEvent.fetchNodesRequest, {
            parentId: currentParentId,
          });
        } catch (err) {
          console.error("Archive upload error:", err);
        } finally {
          emitter.emit(vfsEvent.loadingStateChanged, {
            isLoading: loading,
            operationLoading: false,
            error: error,
          });
          if (e.target) e.target.value = "";
        }
      }
    },
    [currentPath, currentParentId, loading, error]
  );

  const handleDelete = useCallback(
    async (entry: VfsNode) => {
      const confirmation = window.confirm(
        `Delete ${entry.type} "${entry.name}"?${
          entry.type === "folder"
            ? `

WARNING: This will delete all contents inside`
            : ""
        }`
      );
      if (confirmation) {
        await runOperation(vfsEvent.deleteNodesRequest, { ids: [entry.id] });
      }
    },
    [runOperation]
  );

  const handleDownload = useCallback(
    async (entry: VfsNode) => {
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: loading,
        operationLoading: true,
        error: null,
      });
      try {
        if (entry.type === "file") {
          await VfsOps.downloadFileOp(entry.path);
        } else {
          await VfsOps.downloadAllAsZipOp(`${entry.name}.zip`, entry.path);
        }
      } catch (err) {
        console.error("Download error:", err);
      } finally {
        emitter.emit(vfsEvent.loadingStateChanged, {
          isLoading: loading,
          operationLoading: false,
          error: error,
        });
      }
    },
    [loading, error]
  );

  const handleDownloadAll = useCallback(async () => {
    if (currentNodes.length === 0) return;
    emitter.emit(vfsEvent.loadingStateChanged, {
      isLoading: loading,
      operationLoading: true,
      error: null,
    });
    try {
      const dirName = basename(currentPath) || "root";
      await VfsOps.downloadAllAsZipOp(`${dirName}_export.zip`, currentPath);
    } catch (err) {
      console.error("Download all error:", err);
    } finally {
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: loading,
        operationLoading: false,
        error: error,
      });
    }
  }, [currentPath, currentNodes.length, loading, error]);

  const runGitOperation = useCallback(
    async (path: string, op: () => Promise<any>) => {
      if (isGitOpLoading[path] || isVfsLoading || fsOperationLoading) return;
      setIsGitOpLoading((prev) => ({ ...prev, [path]: true }));
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: loading,
        operationLoading: fsOperationLoading,
        error: null,
      });
      try {
        await op();
      } catch (err) {
        console.error(`[FileManager Git Op Error @ ${path}]:`, err);
      } finally {
        setIsGitOpLoading((prev) => ({ ...prev, [path]: false }));
      }
    },
    [isGitOpLoading, isVfsLoading, fsOperationLoading, loading]
  );

  const handleGitInit = useCallback(
    (path: string) => {
      runGitOperation(path, async () => {
        await VfsOps.gitInitOp(path);
        setGitRepoStatus((prev) => ({ ...prev, [path]: true }));
      });
    },
    [runGitOperation]
  );

  const handleGitPull = useCallback(
    (path: string) => {
      toast.info("Pulling default branch (auth not implemented yet)...");
      runGitOperation(path, () => VfsOps.gitPullOp(path, "main"));
    },
    [runGitOperation]
  );

  const handleGitCommit = useCallback((path: string) => {
    setCommitPath(path);
    setCommitMessage("");
    setIsCommitDialogOpen(true);
  }, []);

  const handleGitPush = useCallback(
    (path: string) => {
      toast.info("Pushing default branch (auth not implemented yet)...");
      runGitOperation(path, () => VfsOps.gitPushOp(path, "main"));
    },
    [runGitOperation]
  );

  const handleGitStatus = useCallback(
    (path: string) => {
      runGitOperation(path, () => VfsOps.gitStatusOp(path));
    },
    [runGitOperation]
  );

  const handleCloneClick = useCallback(() => {
    setCloneRepoUrl("");
    setCloneBranch("");
    setIsCloneDialogOpen(true);
  }, []);

  const onSubmitClone = useCallback(async () => {
    if (!cloneRepoUrl.trim()) {
      toast.error("Repository URL cannot be empty.");
      return;
    }
    setIsCloning(true);
    emitter.emit(vfsEvent.loadingStateChanged, {
      isLoading: loading,
      operationLoading: fsOperationLoading,
      error: null,
    });
    try {
      const repoName =
        basename(cloneRepoUrl.trim().replace(/\.git$/, "")) || "cloned_repo";
      const cloneTargetPath = buildPath(currentPath, repoName);

      await VfsOps.gitCloneOp(
        cloneTargetPath,
        cloneRepoUrl.trim(),
        cloneBranch.trim() || undefined
      );
      setIsCloneDialogOpen(false);
      emitter.emit(vfsEvent.fetchNodesRequest, { parentId: currentParentId });
    } catch (_err) {
      // Error handled by gitCloneOp
    } finally {
      setIsCloning(false);
    }
  }, [
    cloneRepoUrl,
    cloneBranch,
    currentPath,
    currentParentId,
    loading,
    fsOperationLoading,
  ]);

  const onSubmitCommit = useCallback(async () => {
    if (!commitPath || !commitMessage.trim()) {
      toast.error("Commit message cannot be empty.");
      return;
    }
    setIsCommitting(true);
    emitter.emit(vfsEvent.loadingStateChanged, {
      isLoading: loading,
      operationLoading: fsOperationLoading,
      error: null,
    });
    try {
      await VfsOps.gitCommitOp(commitPath, commitMessage.trim());
      setIsCommitDialogOpen(false);
    } catch (_err) {
      // Error handled by gitCommitOp
    } finally {
      setIsCommitting(false);
    }
  }, [commitPath, commitMessage, loading, fsOperationLoading]);

  if (isVfsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card text-muted-foreground p-4">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p>
          {initializingKey
            ? `Initializing filesystem: ${initializingKey}`
            : "Loading filesystem..."}
        </p>
        {error && <p className="text-destructive mt-2">Error: {error}</p>}
      </div>
    );
  }

  if (error && !isVfsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-card text-destructive p-4">
        <p>Error loading filesystem: {error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            emitter.emit(vfsEvent.initializeVFSRequest, {
              vfsKey: vfsKey || "default_fallback_key",
            })
          }
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col bg-card text-card-foreground")}>
      <FileManagerToolbar
        currentPath={currentPath}
        isAnyLoading={isAnyOperationLoading || isVfsLoading}
        isOperationLoading={fsOperationLoading}
        entries={currentNodes}
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
      <div className="flex-grow overflow-auto hidden md:block">
        <FileManagerTable
          entries={currentNodes}
          editingPath={editingPath}
          newName={newName}
          creatingFolder={creatingFolder}
          newFolderName={newFolderName}
          selectedFileIds={selectedFileIds}
          isOperationLoading={isAnyOperationLoading}
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
      </div>
      <div className="flex-grow overflow-auto block md:hidden">
        <FileManagerList
          entries={currentNodes}
          editingPath={editingPath}
          newName={newName}
          creatingFolder={creatingFolder}
          newFolderName={newFolderName}
          selectedFileIds={selectedFileIds}
          isOperationLoading={isAnyOperationLoading}
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
      </div>
      <CloneDialog
        isOpen={isCloneDialogOpen}
        onOpenChange={setIsCloneDialogOpen}
        cloneRepoUrl={cloneRepoUrl}
        setCloneRepoUrl={setCloneRepoUrl}
        cloneBranch={cloneBranch}
        setCloneBranch={setCloneBranch}
        isCloning={isCloning}
        onSubmitClone={onSubmitClone}
        currentPath={currentPath}
      />
      <CommitDialog
        isOpen={isCommitDialogOpen}
        onOpenChange={setIsCommitDialogOpen}
        commitPath={commitPath}
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        isCommitting={isCommitting}
        onSubmitCommit={onSubmitCommit}
      />
    </div>
  );
});
FileManager.displayName = "FileManager";
