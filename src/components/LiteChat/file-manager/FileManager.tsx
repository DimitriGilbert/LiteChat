// src/components/LiteChat/file-manager/FileManager.tsx
import React, { useState, useEffect, useCallback, useRef, memo } from "react";
import { useVfsStore } from "@/store/vfs.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Trash2,
  Upload,
  FolderPlus,
  FolderUp,
  RefreshCw,
  Check,
  X,
  Edit2,
  Download,
  Loader2,
  HomeIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { VfsFile, VfsNode } from "@/types/litechat/vfs";
import { formatBytes } from "@/lib/litechat/file-manager-utils";
import { getFileIcon } from "./Utils";
// Removed unused Skeleton import
import { cn } from "@/lib/utils";

export const FileManager = memo(() => {
  // --- VFS Store State & Actions ---
  const {
    nodes,
    childrenMap,
    currentParentId,
    selectedFileIds,
    loading,
    error,
    fetchNodes,
    createDirectory,
    uploadFiles,
    deleteNodes,
    renameNode,
    selectFile,
    deselectFile,
    setCurrentPath,
    downloadFile,
    initializeVFS,
    rootId,
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
      downloadFile: state.downloadFile,
      initializeVFS: state.initializeVFS,
      rootId: state.rootId,
    })),
  );

  // --- Local UI State ---
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  // --- Effects ---
  useEffect(() => {
    const keyToInit = "default_vfs_key"; // Replace with actual key logic later
    if (!rootId) {
      initializeVFS(keyToInit);
    }
  }, [rootId, initializeVFS]);

  useEffect(() => {
    if (currentParentId !== null && !childrenMap[currentParentId]) {
      fetchNodes(currentParentId);
    } else if (currentParentId === null && rootId && !childrenMap[rootId]) {
      fetchNodes(rootId);
    }
  }, [currentParentId, fetchNodes, childrenMap, rootId]);

  useEffect(() => {
    if (renamingNodeId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingNodeId]);

  useEffect(() => {
    if (isCreatingFolder) {
      newFolderInputRef.current?.focus();
    }
  }, [isCreatingFolder]);

  // --- Handlers ---
  const handleCreateFolderClick = () => {
    if (loading) return;
    setIsCreatingFolder(true);
    setNewFolderName("");
    setRenamingNodeId(null);
  };

  const handleCreateFolderConfirm = async () => {
    if (!newFolderName.trim() || loading) return;
    await createDirectory(currentParentId, newFolderName);
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const handleCreateFolderCancel = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const handleUploadClick = () => {
    if (loading) return;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (loading) return;
    const files = event.target.files;
    if (files && files.length > 0) {
      await uploadFiles(currentParentId, files);
      event.target.value = "";
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (loading) return;
    const node = nodes[nodeId];
    if (!node) return;
    const itemType = node.type === "folder" ? "folder" : "file";
    const confirmation = window.confirm(
      `Delete ${itemType} "${node.name}"?${
        node.type === "folder"
          ? `

WARNING: This will delete all contents inside!`
          : ""
      }`,
    );
    if (confirmation) {
      await deleteNodes([nodeId]);
    }
  };

  const handleRenameStart = (node: VfsNode) => {
    if (loading || isCreatingFolder) return;
    setRenamingNodeId(node.id);
    setRenameValue(node.name);
    setIsCreatingFolder(false);
  };

  const handleRenameCancel = () => {
    setRenamingNodeId(null);
    setRenameValue("");
  };

  const handleRenameConfirm = async () => {
    if (loading || !renamingNodeId || !renameValue.trim()) {
      handleRenameCancel();
      return;
    }
    const node = nodes[renamingNodeId];
    if (node && node.name !== renameValue.trim()) {
      await renameNode(renamingNodeId, renameValue);
    }
    handleRenameCancel();
  };

  const handleNavigate = (node: VfsNode) => {
    if (loading || renamingNodeId || isCreatingFolder) return;
    if (node.type === "folder") {
      setCurrentPath(node.path);
    } else {
      handleFileCheckboxChange(node as VfsFile, !selectedFileIds.has(node.id));
    }
  };

  const handleNavigateUp = () => {
    if (loading || !currentDirectory) return;
    const parentNode = currentDirectory.parentId
      ? nodes[currentDirectory.parentId]
      : null;
    if (parentNode) {
      setCurrentPath(parentNode.path);
    } else if (currentPath !== "/") {
      setCurrentPath("/");
    }
  };

  const handleNavigateHome = () => {
    if (loading) return;
    setCurrentPath("/");
  };

  const handleRefresh = () => {
    if (loading) return;
    fetchNodes(currentParentId);
  };

  const handleFileCheckboxChange = useCallback(
    (file: VfsFile, checked: boolean) => {
      if (loading) return;
      if (checked) {
        selectFile(file.id);
      } else {
        deselectFile(file.id);
      }
    },
    [selectFile, deselectFile, loading],
  );

  const handleDownload = async (e: React.MouseEvent, fileId: string) => {
    if (loading) return;
    e.stopPropagation();
    const result = await downloadFile(fileId);
    if (result) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleRenameConfirm();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  const handleNewFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCreateFolderConfirm();
    } else if (e.key === "Escape") {
      handleCreateFolderCancel();
    }
  };

  // --- Breadcrumbs ---
  const breadcrumbs = React.useMemo(() => {
    const parts = [];
    let current: VfsNode | null = currentDirectory;
    while (current && current.parentId !== null) {
      parts.unshift({ id: current.id, name: current.name, path: current.path });
      current = current.parentId ? nodes[current.parentId] : null;
    }
    if (currentPath !== "/" || parts.length === 0) {
      parts.unshift({
        id: rootId || "root",
        name: "Root",
        path: "/",
      });
    }
    return parts;
  }, [currentDirectory, nodes, currentPath, rootId]);

  // --- Render Logic ---
  return (
    <div className="flex h-full flex-col p-1 bg-background">
      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNavigateHome}
                disabled={loading || currentPath === "/"}
                className="h-8 w-8"
              >
                <HomeIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go to root</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNavigateUp}
                disabled={loading || currentPath === "/"}
                className="h-8 w-8"
              >
                <FolderUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Go up</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={loading}
                className="h-8 w-8"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateFolderClick}
                disabled={loading || isCreatingFolder || !!renamingNodeId}
                className="h-8"
              >
                <FolderPlus className="mr-2 h-4 w-4" /> New Folder
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create new folder</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadClick}
                disabled={loading}
                className="h-8"
              >
                <Upload className="mr-2 h-4 w-4" /> Upload Files
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload files</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Path Breadcrumbs */}
      <div className="mb-2 flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.id}>
            {index > 0 && <span className="mx-1">/</span>}
            <button
              onClick={() => setCurrentPath(crumb.path)}
              className={cn(
                "hover:underline",
                index === breadcrumbs.length - 1
                  ? "font-semibold text-foreground"
                  : "",
                loading && "cursor-not-allowed opacity-70",
              )}
              disabled={loading}
            >
              {crumb.name || "Root"}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* File/Folder Table */}
      <ScrollArea className="flex-grow border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead> {/* Checkbox */}
              <TableHead className="w-[40px]"></TableHead> {/* Icon */}
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Size</TableHead>
              <TableHead className="w-[150px]">Modified</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* New Folder Row */}
            {isCreatingFolder && (
              <TableRow className="bg-muted/30">
                <TableCell className="py-1 px-2"></TableCell>
                <TableCell className="py-1 px-2">
                  {getFileIcon("folder", { className: "h-5 w-5" })}
                </TableCell>
                <TableCell className="py-1 px-2" colSpan={3}>
                  <Input
                    ref={newFolderInputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={handleNewFolderKeyDown}
                    onBlur={handleCreateFolderConfirm}
                    placeholder="New folder name"
                    className="h-7 text-xs"
                    disabled={loading}
                  />
                </TableCell>
                <TableCell className="py-1 px-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCreateFolderConfirm}
                      disabled={loading || !newFolderName.trim()}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCreateFolderCancel}
                      disabled={loading}
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Existing Nodes */}
            {loading && currentNodes.length === 0 && !isCreatingFolder && (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin inline mr-2" />{" "}
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!loading && error && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive">
                  Error: {error}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              !error &&
              currentNodes.length === 0 &&
              !isCreatingFolder && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">
                    Folder is empty.
                  </TableCell>
                </TableRow>
              )}
            {!loading &&
              !error &&
              currentNodes.map((node) => (
                <TableRow
                  key={node.id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 group",
                    renamingNodeId === node.id &&
                      "bg-muted ring-1 ring-primary",
                  )}
                  onDoubleClick={() => handleNavigate(node)}
                >
                  <TableCell className="py-1 px-2">
                    {node.type === "file" && (
                      <Checkbox
                        checked={selectedFileIds.has(node.id)}
                        onCheckedChange={(checked) =>
                          handleFileCheckboxChange(node as VfsFile, !!checked)
                        }
                        onClick={(e) => e.stopPropagation()}
                        disabled={loading}
                      />
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-2">
                    {getFileIcon(
                      node.type === "file" ? node.mimeType : "folder",
                      { className: "h-5 w-5" },
                    )}
                  </TableCell>
                  <TableCell
                    className="py-1 px-2 font-medium"
                    onClick={() => handleNavigate(node)}
                  >
                    {renamingNodeId === node.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          onBlur={handleRenameConfirm}
                          className="h-7 text-xs"
                          onClick={(e) => e.stopPropagation()}
                          disabled={loading}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameConfirm();
                          }}
                          disabled={loading || !renameValue.trim()}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameCancel();
                          }}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <span className="truncate block" title={node.name}>
                        {node.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-1 px-2 text-xs text-muted-foreground">
                    {node.type === "file" ? formatBytes(node.size) : "--"}
                  </TableCell>
                  <TableCell className="py-1 px-2 text-xs text-muted-foreground">
                    {new Date(node.lastModified).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-1 px-2 text-right">
                    {renamingNodeId !== node.id && (
                      <TooltipProvider delayDuration={300}>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {node.type === "file" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => handleDownload(e, node.id)}
                                  disabled={loading}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameStart(node);
                                }}
                                disabled={loading || isCreatingFolder}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Rename</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNode(node.id);
                                }}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Hidden file input */}
      <Input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={handleFileSelected}
        disabled={loading}
      />
    </div>
  );
});
FileManager.displayName = "FileManager";
