// src/components/LiteChat/file-manager/FileManager.tsx
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
import { dirname, basename } from "@/lib/litechat/file-manager-utils";
import { FileManagerTable } from "./FileManagerTable";
import { FileManagerToolbar } from "./FileManagerToolbar";
import { CloneDialog } from "./CloneDialog";
import { CommitDialog } from "./CommitDialog";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { toast } from "sonner";

export const FileManager = memo(() => {
  // --- VFS Store State & Actions ---
  const {
    nodes,
    childrenMap,
    currentParentId,
    loading,
    error,
    fetchNodes,
    createDirectory,
    uploadFiles,
    deleteNodes,
    renameNode,
    setCurrentPath,
    initializeVFS,
    rootId,
    fs: fsInstance,
    _setError,
    // Add selection actions
    selectFile,
    deselectFile,
    selectedFileIds, // Get selected IDs for table rows
  } = useVfsStore(
    useShallow((state) => ({
      nodes: state.nodes,
      childrenMap: state.childrenMap,
      currentParentId: state.currentParentId,
      selectedFileIds: state.selectedFileIds, // Select this
      loading: state.loading,
      error: state.error,
      fetchNodes: state.fetchNodes,
      createDirectory: state.createDirectory,
      uploadFiles: state.uploadFiles,
      deleteNodes: state.deleteNodes,
      renameNode: state.renameNode,
      selectFile: state.selectFile, // Select this
      deselectFile: state.deselectFile, // Select this
      setCurrentPath: state.setCurrentPath,
      initializeVFS: state.initializeVFS,
      rootId: state.rootId,
      fs: state.fs,
      _setOperationLoading: state._setOperationLoading,
      _setError: state._setError,
      _addNodes: state._addNodes,
      _removeNodes: state._removeNodes,
    })),
  );

  // --- Local UI State ---
  const [newName, setNewName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  // checkedPaths state removed - use selectedFileIds from store
  const [isOperationLoading, setIsOperationLoading] = useState(false);
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
  const folderInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
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

  const isAnyLoading =
    loading || isOperationLoading || isCloning || isCommitting;

  // --- Effects ---
  useEffect(() => {
    const keyToInit = "default_vfs_key";
    if (!rootId && !loading) {
      initializeVFS(keyToInit);
    }
  }, [rootId, initializeVFS, loading]);

  useEffect(() => {
    if (
      currentParentId !== null &&
      !childrenMap[currentParentId] &&
      !loading &&
      fsInstance
    ) {
      fetchNodes(currentParentId);
    } else if (
      currentParentId === null &&
      rootId &&
      !childrenMap[rootId] &&
      !loading &&
      fsInstance
    ) {
      fetchNodes(rootId);
    }
  }, [currentParentId, fetchNodes, childrenMap, rootId, loading, fsInstance]);

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
      if (!fsInstance || currentFolderPaths.length === 0) return;
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
  }, [currentFolderPaths, fsInstance, gitRepoStatus]);

  // --- Handlers ---

  const runOperation = useCallback(
    async (op: () => Promise<any>, setLoading: boolean = true) => {
      if (isAnyLoading) return;
      if (setLoading) setIsOperationLoading(true);
      _setError(null);
      try {
        await op();
      } catch (err) {
        console.error("[FileManager Operation Error]:", err);
      } finally {
        if (setLoading) setIsOperationLoading(false);
      }
    },
    [isAnyLoading, _setError],
  );

  const handleNavigate = useCallback(
    (entry: VfsNode) => {
      if (isAnyLoading || editingPath) return;
      if (entry.type === "folder") {
        runOperation(() => setCurrentPath(entry.path), false);
        // No need to clear checkedPaths, store handles selection
      }
    },
    [isAnyLoading, editingPath, setCurrentPath, runOperation],
  );

  const handleNavigateUp = useCallback(() => {
    if (isAnyLoading || currentPath === "/") return;
    const parentPath = dirname(currentPath);
    runOperation(() => setCurrentPath(parentPath), false);
  }, [isAnyLoading, currentPath, setCurrentPath, runOperation]);

  const handleNavigateHome = useCallback(() => {
    if (isAnyLoading || currentPath === "/") return;
    runOperation(() => setCurrentPath("/"), false);
  }, [isAnyLoading, currentPath, setCurrentPath, runOperation]);

  const handleRefresh = useCallback(() => {
    runOperation(() => fetchNodes(currentParentId));
  }, [runOperation, fetchNodes, currentParentId]);

  // Modified checkbox handler to use store actions
  const handleCheckboxChange = useCallback(
    (checked: boolean, nodeId: string) => {
      const node = nodes[nodeId];
      // Only allow selecting files
      if (node && node.type === "file") {
        if (checked) {
          selectFile(nodeId);
        } else {
          deselectFile(nodeId);
        }
      } else if (node && node.type === "folder") {
        // Optionally provide feedback that folders can't be selected
        toast.info("Folders cannot be attached to the prompt.");
      }
    },
    [selectFile, deselectFile, nodes], // Add store actions and nodes to dependencies
  );

  const startEditing = useCallback(
    (entry: VfsNode) => {
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
    if (!editingPath || !newName.trim()) {
      cancelEditing();
      return;
    }
    const node = Object.values(nodes).find((n) => n.path === editingPath);
    if (node && node.name !== newName.trim()) {
      await runOperation(() => renameNode(node.id, newName.trim()));
    }
    cancelEditing();
  }, [editingPath, newName, renameNode, cancelEditing, nodes, runOperation]);

  const startCreatingFolder = useCallback(() => {
    if (isAnyLoading || editingPath) return;
    setCreatingFolder(true);
    setNewFolderName("");
    setEditingPath(null);
  }, [isAnyLoading, editingPath]);

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
        // No need to manage checkedPaths locally
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
  const runGitOperation = useCallback(
    async (path: string, op: () => Promise<any>) => {
      if (isGitOpLoading[path]) return;
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
    [_setError, isGitOpLoading],
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
      runGitOperation(path, () => VfsOps.gitPullOp(path));
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
      runGitOperation(path, () => VfsOps.gitPushOp(path));
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
      await VfsOps.gitCloneOp(
        currentPath,
        cloneRepoUrl.trim(),
        cloneBranch.trim() || undefined,
      );
      setIsCloneDialogOpen(false);
      await handleRefresh();
    } catch (err) {
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
    } catch (err) {
      // Error handled by gitCommitOp
    } finally {
      setIsCommitting(false);
    }
  }, [commitPath, commitMessage, _setError]);

  // --- Render Logic ---
  return (
    <div className="flex h-full flex-col bg-card text-card-foreground rounded-lg border border-border shadow-sm overflow-hidden">
      <FileManagerToolbar
        currentPath={currentPath}
        isAnyLoading={isAnyLoading}
        isOperationLoading={isOperationLoading}
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

      {error && (
        <div className="p-2 bg-destructive text-destructive-foreground text-xs text-center flex-shrink-0">
          Error: {error}
        </div>
      )}

      <FileManagerTable
        entries={currentNodes}
        editingPath={editingPath}
        newName={newName}
        creatingFolder={creatingFolder}
        newFolderName={newFolderName}
        // Pass selectedFileIds from store instead of local checkedPaths
        selectedFileIds={selectedFileIds}
        isOperationLoading={
          isOperationLoading || Object.values(isGitOpLoading).some(Boolean)
        }
        handleNavigate={handleNavigate}
        handleCheckboxChange={handleCheckboxChange} // Pass the updated handler
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
