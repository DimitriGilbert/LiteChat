// src/components/LiteChat/file-manager/FileManager.tsx
import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { useVfsStore } from "@/store/vfs.store";
// Removed unused imports: Button, Input, ScrollArea, Table components, Tooltip components
// Removed unused imports: Checkbox, Lucide icons
import { useShallow } from "zustand/react/shallow";
// Removed unused import: VfsFile
import { VfsNode } from "@/types/litechat/vfs";
// Removed unused import: formatBytes
import {
  dirname,
  basename,
  // Removed unused import: buildPath
  // Removed unused import: normalizePath
} from "@/lib/litechat/file-manager-utils";
// Removed unused import: getFileIcon
// Removed unused import: cn
import { FileManagerTable } from "./FileManagerTable";
import { FileManagerToolbar } from "./FileManagerToolbar";
import { CloneDialog } from "./CloneDialog";
import { CommitDialog } from "./CommitDialog";
import * as VfsOps from "@/lib/litechat/vfs-operations"; // Import VFS Ops
import { toast } from "sonner";

// This component is now primarily responsible for state management and passing props
export const FileManager = memo(() => {
  // --- VFS Store State & Actions ---
  const {
    nodes,
    childrenMap,
    currentParentId,
    // Removed unused state: selectedFileIds
    loading, // Global VFS loading (init, major fetches)
    error,
    fetchNodes,
    createDirectory,
    uploadFiles,
    deleteNodes,
    renameNode,
    // Removed unused actions: selectFile, deselectFile
    setCurrentPath,
    initializeVFS,
    rootId,
    fs: fsInstance,
    // Removed unused action: _setOperationLoading
    _setError, // Action to set error state
  } = useVfsStore(
    useShallow((state) => ({
      nodes: state.nodes,
      childrenMap: state.childrenMap,
      currentParentId: state.currentParentId,
      selectedFileIds: state.selectedFileIds,
      loading: state.loading,
      error: state.error,
      fetchNodes: state.fetchNodes,
      createDirectory: state.createDirectory,
      uploadFiles: state.uploadFiles,
      deleteNodes: state.deleteNodes,
      renameNode: state.renameNode,
      selectFile: state.selectFile,
      deselectFile: state.deselectFile,
      setCurrentPath: state.setCurrentPath,
      initializeVFS: state.initializeVFS,
      rootId: state.rootId,
      fs: state.fs,
      _setOperationLoading: state._setOperationLoading,
      _setError: state._setError,
    })),
  );

  // --- Local UI State ---
  const [newName, setNewName] = useState("");
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [checkedPaths, setCheckedPaths] = useState<Set<string>>(new Set());
  const [isOperationLoading, setIsOperationLoading] = useState(false); // Local op loading
  const [gitRepoStatus] = useState<Record<string, boolean>>({});
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [cloneRepoUrl, setCloneRepoUrl] = useState("");
  const [cloneBranch, setCloneBranch] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitPath, setCommitPath] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

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

  // Combined loading state for disabling UI elements
  const isAnyLoading = loading || isOperationLoading;

  // --- Effects ---
  useEffect(() => {
    const keyToInit = "default_vfs_key"; // Replace with actual key logic later
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

  // --- Handlers ---

  // Wrap store actions with local loading state management
  const runOperation = useCallback(
    async (op: () => Promise<any>) => {
      if (isAnyLoading) return;
      setIsOperationLoading(true);
      _setError(null); // Clear previous errors
      try {
        await op();
      } catch (err) {
        // Errors should ideally be handled and toasted within the specific op or store action
        console.error("[FileManager Operation Error]:", err);
        // Optionally set a generic error here if needed: _setError("Operation failed");
      } finally {
        setIsOperationLoading(false);
      }
    },
    [isAnyLoading, _setError],
  );

  const handleNavigate = useCallback(
    (entry: VfsNode) => {
      if (isAnyLoading || editingPath) return;
      if (entry.type === "folder") {
        runOperation(() => setCurrentPath(entry.path));
        setCheckedPaths(new Set()); // Clear selection on navigation
      }
    },
    [isAnyLoading, editingPath, setCurrentPath, runOperation],
  );

  const handleNavigateUp = useCallback(() => {
    if (isAnyLoading || currentPath === "/") return;
    const parentPath = dirname(currentPath);
    runOperation(() => setCurrentPath(parentPath));
    setCheckedPaths(new Set());
  }, [isAnyLoading, currentPath, setCurrentPath, runOperation]);

  const handleNavigateHome = useCallback(() => {
    if (isAnyLoading || currentPath === "/") return;
    runOperation(() => setCurrentPath("/"));
    setCheckedPaths(new Set());
  }, [isAnyLoading, currentPath, setCurrentPath, runOperation]);

  const handleRefresh = useCallback(() => {
    runOperation(() => fetchNodes(currentParentId));
    setCheckedPaths(new Set());
  }, [runOperation, fetchNodes, currentParentId]);

  const handleCheckboxChange = useCallback((checked: boolean, path: string) => {
    setCheckedPaths((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

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
        if (e.target) e.target.value = ""; // Reset input
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
          await fetchNodes(currentParentId); // Refresh after extraction
        });
        if (e.target) e.target.value = ""; // Reset input
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
        setCheckedPaths((prev) => {
          const next = new Set(prev);
          next.delete(entry.path);
          return next;
        });
      }
    },
    [deleteNodes, runOperation],
  );

  // Use VFS Ops directly for download
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

  // --- Git Action Handlers (Placeholders) ---
  const handleGitInit = (path: string) => toast.info(`Git Init on ${path}`);
  const handleGitPull = (path: string) => toast.info(`Git Pull on ${path}`);
  const handleGitCommit = (path: string) => {
    setCommitPath(path);
    setCommitMessage("");
    setIsCommitDialogOpen(true);
  };
  const handleGitPush = (path: string) => toast.info(`Git Push on ${path}`);
  const handleGitStatus = (path: string) => toast.info(`Git Status on ${path}`);
  const handleCloneClick = () => {
    setCloneRepoUrl("");
    setCloneBranch("");
    setIsCloneDialogOpen(true);
  };
  const onSubmitClone = async () => {
    setIsCloning(true);
    toast.info(`Cloning ${cloneRepoUrl}... (Placeholder)`);
    await new Promise((res) => setTimeout(res, 1500)); // Simulate delay
    setIsCloning(false);
    setIsCloneDialogOpen(false);
    handleRefresh(); // Refresh after clone attempt
  };
  const onSubmitCommit = async () => {
    setIsCommitting(true);
    toast.info(
      `Committing ${commitPath} with "${commitMessage}"... (Placeholder)`,
    );
    await new Promise((res) => setTimeout(res, 1500)); // Simulate delay
    setIsCommitting(false);
    setIsCommitDialogOpen(false);
  };

  // --- Render Logic ---
  return (
    <div className="flex h-full flex-col bg-card text-card-foreground rounded-lg border border-border shadow-sm overflow-hidden">
      <FileManagerToolbar
        currentPath={currentPath}
        isAnyLoading={isAnyLoading}
        isOperationLoading={isOperationLoading} // Pass local operation loading
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
        checkedPaths={checkedPaths}
        isOperationLoading={isOperationLoading} // Pass local operation loading
        handleNavigate={handleNavigate}
        handleCheckboxChange={handleCheckboxChange}
        startEditing={startEditing}
        cancelEditing={cancelEditing}
        handleRename={handleRename}
        cancelCreatingFolder={cancelCreatingFolder}
        handleCreateFolder={handleCreateFolder}
        handleDownload={handleDownload} // Pass the correct handler
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
