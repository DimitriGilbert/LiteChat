// src/components/LiteChat/file-manager/FileManager.tsx
// FULL FILE - Added mobile view logic
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
import { FileManagerList } from "./FileManagerList"; // Import mobile list view

export const FileManager = memo(() => {
  // --- VFS Store State & Actions ---
  const {
    nodes,
    childrenMap,
    currentParentId,
    loading,
    operationLoading: fsOperationLoading,
    error,
    fetchNodes,
    createDirectory,
    uploadFiles,
    deleteNodes,
    renameNode,
    setCurrentPath,
    rootId,
    selectFile,
    deselectFile,
    selectedFileIds,
    vfsKey,
    configuredVfsKey,
    initializingKey,
    _setError,
    _setOperationLoading,
    findNodeByPath,
    initializeVFS,
  } = useVfsStore(
    useShallow((state) => ({
      nodes: state.nodes,
      childrenMap: state.childrenMap,
      currentParentId: state.currentParentId,
      selectedFileIds: state.selectedFileIds,
      loading: state.loading,
      operationLoading: state.operationLoading,
      error: state.error,
      fetchNodes: state.fetchNodes,
      createDirectory: state.createDirectory,
      uploadFiles: state.uploadFiles,
      deleteNodes: state.deleteNodes,
      renameNode: state.renameNode,
      selectFile: state.selectFile,
      deselectFile: state.deselectFile,
      setCurrentPath: state.setCurrentPath,
      rootId: state.rootId,
      vfsKey: state.vfsKey,
      configuredVfsKey: state.configuredVfsKey,
      initializingKey: state.initializingKey,
      // Destructure actions
      _setError: state._setError,
      _setOperationLoading: state._setOperationLoading,
      findNodeByPath: state.findNodeByPath,
      initializeVFS: state.initializeVFS,
    })),
  );

  // --- Local UI State ---
  const [newName, setNewName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [gitRepoStatus, setGitRepoStatus] = useState<Record<string, boolean>>(
    {},
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
    {},
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement | null>(null);

  // --- Derived State ---
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

  // --- Effects ---
  useEffect(() => {
    if (
      currentParentId !== null &&
      !childrenMap[currentParentId] &&
      !isVfsLoading &&
      configuredVfsKey === vfsKey
    ) {
      fetchNodes(currentParentId);
    } else if (
      currentParentId === null &&
      rootId &&
      !childrenMap[rootId] &&
      !isVfsLoading &&
      configuredVfsKey === vfsKey
    ) {
      fetchNodes(rootId);
    }
  }, [
    currentParentId,
    childrenMap,
    rootId,
    isVfsLoading,
    fetchNodes,
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

  // --- Handlers ---

  // Use actions directly from the hook destructuring
  const runOperation = useCallback(
    async (op: () => Promise<any>, setLoadingState?: boolean) => {
      if (isAnyOperationLoading || isVfsLoading) return;
      if (setLoadingState !== false) _setOperationLoading(true);
      _setError(null);
      try {
        await op();
      } catch (err) {
        console.error("[FileManager Operation Error]:", err);
      } finally {
        if (setLoadingState !== false) _setOperationLoading(false);
      }
    },
    [isAnyOperationLoading, isVfsLoading, _setError, _setOperationLoading],
  );

  const handleNavigate = useCallback(
    (entry: VfsNode) => {
      if (isAnyOperationLoading || isVfsLoading || editingPath) return;
      if (entry.type === "folder") {
        runOperation(() => setCurrentPath(entry.path), false);
      }
    },
    [
      isAnyOperationLoading,
      isVfsLoading,
      editingPath,
      setCurrentPath,
      runOperation,
    ],
  );

  const handleNavigateUp = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || currentPath === "/") return;
    const parentPath = dirname(currentPath);
    runOperation(() => setCurrentPath(parentPath), false);
  }, [
    isAnyOperationLoading,
    isVfsLoading,
    currentPath,
    setCurrentPath,
    runOperation,
  ]);

  const handleNavigateHome = useCallback(() => {
    if (isAnyOperationLoading || isVfsLoading || currentPath === "/") return;
    runOperation(() => setCurrentPath("/"), false);
  }, [
    isAnyOperationLoading,
    isVfsLoading,
    currentPath,
    setCurrentPath,
    runOperation,
  ]);

  const handleRefresh = useCallback(() => {
    if (isVfsLoading) return;
    runOperation(() => fetchNodes(currentParentId), false);
  }, [runOperation, fetchNodes, currentParentId, isVfsLoading]);

  const handleCheckboxChange = useCallback(
    (checked: boolean, nodeId: string) => {
      const node = nodes[nodeId];
      if (node && node.type === "file") {
        if (checked) {
          selectFile(nodeId);
        } else {
          deselectFile(nodeId);
        }
      } else if (node && node.type === "folder") {
        toast.info("Folders cannot be attached to the prompt.");
      }
    },
    [selectFile, deselectFile, nodes],
  );

  const startEditing = useCallback(
    (entry: VfsNode) => {
      if (isAnyOperationLoading || isVfsLoading || creatingFolder) return;
      setEditingPath(entry.path);
      setNewName(entry.name);
      setCreatingFolder(false);
    },
    [isAnyOperationLoading, isVfsLoading, creatingFolder],
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
    const node = findNodeByPath(editingPath);
    if (node && node.name !== newName.trim()) {
      await runOperation(() => renameNode(node.id, newName.trim()));
    }
    cancelEditing();
  }, [
    editingPath,
    newName,
    renameNode,
    cancelEditing,
    findNodeByPath,
    runOperation,
  ]);

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
    await runOperation(() =>
      createDirectory(currentParentId, newFolderName.trim()),
    );
    cancelCreatingFolder();
  }, [
    newFolderName,
    createDirectory,
    currentParentId,
    cancelCreatingFolder,
    runOperation,
  ]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFolderUploadClick = () => folderInputRef.current?.click();
  const handleArchiveUploadClick = () => archiveInputRef.current?.click();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await runOperation(() => uploadFiles(currentParentId, files));
        if (e.target) e.target.value = "";
      }
    },
    [uploadFiles, currentParentId, runOperation],
  );

  const handleArchiveChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        await runOperation(async () => {
          await VfsOps.uploadAndExtractZipOp(file, currentPath);
          await fetchNodes(currentParentId);
        });
        if (e.target) e.target.value = "";
      }
    },
    [currentPath, fetchNodes, currentParentId, runOperation],
  );

  const handleDelete = useCallback(
    async (entry: VfsNode) => {
      const confirmation = window.confirm(
        `Delete ${entry.type} "${entry.name}"?${
          entry.type === "folder"
            ? `

WARNING: This will delete all contents inside`
            : ""
        }`,
      );
      if (confirmation) {
        await runOperation(() => deleteNodes([entry.id]));
      }
    },
    [deleteNodes, runOperation],
  );

  const handleDownload = useCallback(
    async (entry: VfsNode) => {
      await runOperation(async () => {
        if (entry.type === "file") {
          await VfsOps.downloadFileOp(entry.path);
        } else {
          await VfsOps.downloadAllAsZipOp(`${entry.name}.zip`, entry.path);
        }
      });
    },
    [runOperation],
  );

  const handleDownloadAll = useCallback(async () => {
    if (currentNodes.length === 0) return;
    await runOperation(async () => {
      const dirName = basename(currentPath) || "root";
      await VfsOps.downloadAllAsZipOp(`${dirName}_export.zip`, currentPath);
    });
  }, [currentPath, currentNodes.length, runOperation]);

  // --- Git Action Handlers ---
  // Use actions directly from the hook destructuring
  const runGitOperation = useCallback(
    async (path: string, op: () => Promise<any>) => {
      if (isGitOpLoading[path] || isVfsLoading || fsOperationLoading) return;
      setIsGitOpLoading((prev) => ({ ...prev, [path]: true }));
      _setError(null);
      try {
        await op();
      } catch (err) {
        console.error(`[FileManager Git Op Error @ ${path}]:`, err);
      } finally {
        setIsGitOpLoading((prev) => ({ ...prev, [path]: false }));
      }
    },
    [_setError, isGitOpLoading, isVfsLoading, fsOperationLoading],
  );

  const handleGitInit = useCallback(
    (path: string) => {
      runGitOperation(path, async () => {
        await VfsOps.gitInitOp(path);
        setGitRepoStatus((prev) => ({ ...prev, [path]: true }));
      });
    },
    [runGitOperation],
  );

  const handleGitPull = useCallback(
    (path: string) => {
      toast.info("Pulling default branch (auth not implemented yet)...");
      runGitOperation(path, () => VfsOps.gitPullOp(path, "main"));
    },
    [runGitOperation],
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
    [runGitOperation],
  );

  const handleGitStatus = useCallback(
    (path: string) => {
      runGitOperation(path, () => VfsOps.gitStatusOp(path));
    },
    [runGitOperation],
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
    _setError(null);
    try {
      const repoName =
        basename(cloneRepoUrl.trim().replace(/\.git$/, "")) || "cloned_repo";
      const cloneTargetPath = buildPath(currentPath, repoName);

      await VfsOps.gitCloneOp(
        cloneTargetPath,
        cloneRepoUrl.trim(),
        cloneBranch.trim() || undefined,
      );
      setIsCloneDialogOpen(false);
      await handleRefresh();
    } catch (_err) {
      // Error handled by gitCloneOp
    } finally {
      setIsCloning(false);
    }
  }, [cloneRepoUrl, cloneBranch, currentPath, _setError, handleRefresh]);

  const onSubmitCommit = useCallback(async () => {
    if (!commitPath || !commitMessage.trim()) {
      toast.error("Commit message cannot be empty.");
      return;
    }
    setIsCommitting(true);
    _setError(null);
    try {
      await VfsOps.gitCommitOp(commitPath, commitMessage.trim());
      setIsCommitDialogOpen(false);
    } catch (_err) {
      // Error handled by gitCommitOp
    } finally {
      setIsCommitting(false);
    }
  }, [commitPath, commitMessage, _setError]);

  // --- Render Logic ---

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
          onClick={() => initializeVFS(vfsKey || "default_fallback_key")} // Use action
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    // Ensure this top-level div allows flex children to grow/shrink
    <div className={cn("flex h-full flex-col bg-card text-card-foreground")}>
      {/* Toolbar remains flex-shrink-0 */}
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

      {/* Table container (Desktop) */}
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

      {/* List container (Mobile) */}
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

      {/* Dialogs */}
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
