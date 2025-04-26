// src/store/vfs.store.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
// Corrected import path for VFS types
import {
  VfsNode,
  VfsFile,
  VfsDirectory,
  FileSystemEntry,
} from "@/types/litechat/vfs";
// Corrected import path for utils
import { normalizePath, buildPath } from "@/lib/litechat/file-manager-utils"; // Add missing imports
import { toast } from "sonner";
// Import fs from core
import { fs } from "@zenfs/core"; // Keep Stats
// Corrected import path for operations
import * as VfsOps from "@/lib/litechat/vfs-operations"; // Correct path
import { nanoid } from "nanoid";
// Removed unused modEvents import

interface VfsState {
  nodes: Record<string, VfsNode>;
  childrenMap: Record<string, string[]>;
  rootId: string | null;
  currentParentId: string | null;
  selectedFileIds: Set<string>;
  loading: boolean;
  operationLoading: boolean;
  error: string | null;
  fs: typeof fs | null;
  enableVfs: boolean;
  isVfsEnabledForItem: boolean;
  vfsKey: string | null;
  configuredVfsKey: string | null;
}

interface VfsActions {
  _setLoading: (loading: boolean) => void;
  _setOperationLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
  _addNodes: (nodes: VfsNode[]) => void;
  _updateNode: (id: string, changes: Partial<VfsNode>) => void;
  _removeNodes: (ids: string[]) => void;
  _setFsInstance: (fsInstance: typeof fs | null) => void;
  _setEnableVfs: (enabled: boolean) => void;
  setIsVfsEnabledForItem: (enabled: boolean) => void;
  setVfsKey: (key: string | null) => void;
  setConfiguredVfsKey: (key: string | null) => void;

  fetchNodes: (parentId?: string | null) => Promise<void>;
  setCurrentPath: (path: string) => Promise<void>;
  findNodeByPath: (path: string) => VfsNode | undefined;

  createDirectory: (parentId: string | null, name: string) => Promise<void>;
  uploadFiles: (parentId: string | null, files: FileList) => Promise<void>;
  deleteNodes: (ids: string[]) => Promise<void>;
  renameNode: (id: string, newName: string) => Promise<void>;
  downloadFile: (
    fileId: string,
  ) => Promise<{ name: string; blob: Blob } | null>;

  selectFile: (fileId: string) => void;
  deselectFile: (fileId: string) => void;
  clearSelection: () => void;
  initializeVFS: (vfsKey: string) => Promise<void>;
}

export const useVfsStore = create(
  immer<VfsState & VfsActions>((set, get) => ({
    // State
    nodes: {},
    childrenMap: { "": [] },
    rootId: null,
    currentParentId: null,
    selectedFileIds: new Set(),
    loading: false,
    operationLoading: false,
    error: null,
    fs: null,
    enableVfs: true,
    isVfsEnabledForItem: false,
    vfsKey: null,
    configuredVfsKey: null,

    // Internal Actions
    _setLoading: (loading) => {
      set((state) => {
        state.loading = loading;
        if (loading) state.error = null;
      });
    },
    _setOperationLoading: (loading) => {
      set((state) => {
        state.operationLoading = loading;
      });
    },
    _setError: (error) => {
      set((state) => {
        state.error = error;
        state.loading = false;
        state.operationLoading = false;
        if (error) {
          toast.error(`VFS Error: ${error}`);
        }
      });
    },
    _addNodes: (nodes) => {
      set((state) => {
        nodes.forEach((node) => {
          state.nodes[node.id] = node;
          const parentIdKey = node.parentId ?? state.rootId ?? "";
          if (!state.childrenMap[parentIdKey]) {
            state.childrenMap[parentIdKey] = [];
          }
          if (!state.childrenMap[parentIdKey].includes(node.id)) {
            state.childrenMap[parentIdKey].push(node.id);
          }
        });
      });
    },
    _updateNode: (id, changes) => {
      set((state) => {
        if (state.nodes[id]) {
          Object.assign(state.nodes[id], changes);
        }
      });
    },
    _removeNodes: (ids) => {
      set((state) => {
        ids.forEach((id) => {
          const node = state.nodes[id];
          if (node) {
            const parentIdKey = node.parentId ?? state.rootId ?? "";
            if (state.childrenMap[parentIdKey]) {
              state.childrenMap[parentIdKey] = state.childrenMap[
                parentIdKey
              ].filter((childId) => childId !== id);
            }
            delete state.nodes[id];
            state.selectedFileIds.delete(id);

            if (node.type === "folder") {
              const childIdsToRemove = Object.values(state.nodes)
                .filter((n: VfsNode) => n.parentId === id)
                .map((n) => n.id);
              if (childIdsToRemove.length > 0) {
                get()._removeNodes(childIdsToRemove);
              }
              delete state.childrenMap[id];
            }
          }
        });
      });
    },
    _setFsInstance: (fsInstance) => {
      set({ fs: fsInstance });
    },
    _setEnableVfs: (enabled) => {
      console.log(`[VfsStore] Setting global enableVfs to: ${enabled}`);
      set({ enableVfs: enabled });
      if (!enabled) {
        set({
          fs: null,
          configuredVfsKey: null,
          rootId: null,
          currentParentId: null,
          nodes: {},
          childrenMap: { "": [] },
          error: null,
          loading: false,
          operationLoading: false,
        });
      } else {
        get().initializeVFS(get().vfsKey || "default_fallback_key");
      }
    },
    setIsVfsEnabledForItem: (enabled) => {
      console.log(`[VfsStore] Setting isVfsEnabledForItem to: ${enabled}`);
      set({ isVfsEnabledForItem: enabled });
      if (!enabled) {
        get().clearSelection();
        if (get().vfsKey === get().configuredVfsKey) {
          set({
            fs: null,
            configuredVfsKey: null,
            rootId: null,
            currentParentId: null,
            nodes: {},
            childrenMap: { "": [] },
            error: null,
            loading: false,
            operationLoading: false,
          });
        }
      } else {
        get().initializeVFS(get().vfsKey || "default_fallback_key");
      }
    },
    setVfsKey: (key) => {
      const currentConfiguredKey = get().configuredVfsKey;
      console.log(
        `[VfsStore] Setting vfsKey to: ${key} (Current configured: ${currentConfiguredKey})`,
      );
      set({ vfsKey: key });

      if (key !== currentConfiguredKey) {
        console.log(`[VfsStore] vfsKey changed. Resetting VFS state.`);
        set({
          fs: null,
          configuredVfsKey: null,
          rootId: null,
          currentParentId: null,
          nodes: {},
          childrenMap: { "": [] },
          error: null,
          loading: false,
          operationLoading: false,
        });
        get().initializeVFS(key || "default_fallback_key");
      } else if (key === currentConfiguredKey && !get().fs) {
        console.log(
          `[VfsStore] vfsKey matches configured key, but fs not ready. Retrying initialization.`,
        );
        get().initializeVFS(key || "default_fallback_key");
      }
    },
    setConfiguredVfsKey: (key) => {
      set({ configuredVfsKey: key });
    },

    // Public Actions
    initializeVFS: async (
      vfsKey: string = get().vfsKey || "default_fallback_key",
    ) => {
      if (!vfsKey) {
        console.warn("[VfsStore] initializeVFS called without a valid vfsKey.");
        return;
      }
      if ((get().configuredVfsKey === vfsKey && get().fs) || get().loading) {
        console.log(
          `[VfsStore] Initialization skipped for key "${vfsKey}" (already initialized or loading).`,
        );
        return;
      }

      const {
        _setLoading,
        _setError,
        _addNodes,
        _setFsInstance,
        setConfiguredVfsKey,
      } = get();
      _setLoading(true);
      _setError(null);
      _setFsInstance(null);

      try {
        const fsInstance = await VfsOps.initializeFsOp(vfsKey);
        if (!fsInstance) {
          throw new Error("Filesystem backend initialization failed.");
        }
        _setFsInstance(fsInstance);
        setConfiguredVfsKey(vfsKey);

        const stableRootId = "vfs-root";
        let rootNode = get().nodes[stableRootId];

        try {
          await fsInstance.promises.stat("/");
        } catch (statErr: any) {
          if (statErr.code !== "ENOENT") throw statErr;
        }

        if (!rootNode || rootNode.path !== "/") {
          const now = Date.now();
          rootNode = {
            id: stableRootId,
            parentId: null,
            name: "",
            path: "/",
            type: "folder",
            createdAt: now,
            lastModified: now,
          };
          _addNodes([rootNode]);
        }

        set((s) => {
          s.rootId = rootNode!.id;
          s.currentParentId = rootNode!.id;
        });

        await get().fetchNodes(rootNode.id);
        // Toast handled by VfsOps
      } catch (err) {
        console.error("Failed to initialize VFS:", err);
        _setError("Failed to initialize VFS.");
        _setFsInstance(null);
        setConfiguredVfsKey(null);
      } finally {
        _setLoading(false);
      }
    },

    fetchNodes: async (parentId = null) => {
      const {
        _setLoading,
        _setError,
        _addNodes,
        fs: fsInstance,
        nodes,
        rootId,
      } = get();
      if (!fsInstance) {
        _setError("Filesystem not initialized.");
        return;
      }
      _setLoading(true);
      try {
        const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
        const pathToFetch = parentNode ? parentNode.path : "/";
        const fetchedEntries = await VfsOps.listFilesOp(pathToFetch);

        // Add type FileSystemEntry to entry
        const vfsNodes = fetchedEntries.map(
          (entry: FileSystemEntry): VfsNode => ({
            id: nanoid(),
            parentId: parentId,
            name: entry.name,
            path: entry.path,
            type: entry.isDirectory ? "folder" : "file",
            size: entry.size,
            createdAt: entry.lastModified.getTime(),
            lastModified: entry.lastModified.getTime(),
            mimeType: entry.isDirectory ? undefined : (entry as any).mimeType,
          }),
        );

        const parentKey = parentId ?? rootId ?? "";
        set((state) => {
          state.childrenMap[parentKey] = [];
        });
        const oldChildIds = Object.values(nodes)
          .filter((n: VfsNode) => n.parentId === parentId)
          .map((n) => n.id);
        get()._removeNodes(oldChildIds);

        _addNodes(vfsNodes);
      } catch (err) {
        console.error("Failed to fetch VFS nodes:", err);
        _setError("Failed to load directory contents.");
      } finally {
        _setLoading(false);
      }
    },

    findNodeByPath: (path) => {
      const normalized = normalizePath(path);
      if (normalized === "/") {
        const rootNodeId = get().rootId;
        return rootNodeId ? get().nodes[rootNodeId] : undefined;
      }
      return Object.values(get().nodes).find((n) => n.path === normalized);
    },

    setCurrentPath: async (path) => {
      const { findNodeByPath, fetchNodes, rootId } = get();
      const normalizedPath = normalizePath(path);
      let targetNode = findNodeByPath(normalizedPath);

      if (targetNode && targetNode.type === "folder") {
        set((state) => {
          state.currentParentId = targetNode!.id;
        });
        if (!get().childrenMap[targetNode.id]) {
          await fetchNodes(targetNode.id);
        }
      } else if (normalizedPath === "/" && rootId) {
        set((state) => {
          state.currentParentId = rootId;
        });
        if (!get().childrenMap[rootId]) {
          await fetchNodes(rootId);
        }
      } else {
        console.warn(`Path not found or not a directory: ${path}`);
      }
    },

    createDirectory: async (parentId, name) => {
      const {
        _setOperationLoading,
        _setError,
        fs: fsInstance,
        nodes,
        rootId,
        _addNodes,
      } = get();
      if (!fsInstance) {
        _setError("Filesystem not initialized.");
        return;
      }
      if (!name.trim()) {
        _setError("Directory name cannot be empty.");
        return;
      }
      _setOperationLoading(true);
      try {
        const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
        const parentPath = parentNode ? parentNode.path : "/";
        const newPath = buildPath(parentPath, name.trim());

        try {
          await fsInstance.promises.stat(newPath);
          throw new Error(`"${name.trim()}" already exists.`);
        } catch (statErr: any) {
          if (statErr.code !== "ENOENT") throw statErr;
        }

        await VfsOps.createDirectoryOp(newPath);

        const now = Date.now();
        const newNodeId = nanoid();
        const newDirNode: VfsDirectory = {
          id: newNodeId,
          parentId: parentId,
          name: name.trim(),
          path: newPath,
          type: "folder",
          createdAt: now,
          lastModified: now,
        };
        _addNodes([newDirNode]);

        // Toast handled by VfsOps
      } catch (err: any) {
        console.error("Failed to create directory:", err);
        _setError(err.message || "Failed to create directory.");
      } finally {
        _setOperationLoading(false);
      }
    },

    uploadFiles: async (parentId, files) => {
      const {
        _setOperationLoading,
        _setError,
        fs: fsInstance,
        nodes,
        rootId,
      } = get();
      if (!fsInstance) {
        _setError("Filesystem not initialized.");
        return;
      }
      _setOperationLoading(true);
      try {
        const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
        const parentPath = parentNode ? parentNode.path : "/";
        await VfsOps.uploadFilesOp(Array.from(files), parentPath);
        await get().fetchNodes(parentId);
      } catch (err) {
        console.error("Failed to upload files:", err);
        _setError("Failed to upload one or more files.");
      } finally {
        _setOperationLoading(false);
      }
    },

    deleteNodes: async (ids) => {
      const {
        _setOperationLoading,
        _setError,
        _removeNodes,
        fs: fsInstance,
      } = get();
      if (!fsInstance) {
        _setError("Filesystem not initialized.");
        return;
      }
      _setOperationLoading(true);
      try {
        for (const id of ids) {
          const node = get().nodes[id];
          if (node) {
            await VfsOps.deleteItemOp(node.path, node.type === "folder");
          }
        }
        _removeNodes(ids);
      } catch (err) {
        console.error("Failed to delete nodes:", err);
        _setError("Failed to delete one or more items.");
        await get().fetchNodes(get().currentParentId);
      } finally {
        _setOperationLoading(false);
      }
    },

    renameNode: async (id, newName) => {
      const {
        _setOperationLoading,
        _setError,
        _updateNode,
        nodes,
        fs: fsInstance,
        rootId,
      } = get();
      if (!fsInstance) {
        _setError("Filesystem not initialized.");
        return;
      }
      if (!newName.trim()) {
        _setError("Name cannot be empty.");
        return;
      }
      const node = nodes[id];
      if (!node) {
        _setError("Item not found.");
        return;
      }
      if (node.name === newName.trim()) return;
      _setOperationLoading(true);
      try {
        const parentNode = node.parentId
          ? nodes[node.parentId]
          : nodes[rootId || ""];
        const parentPath = parentNode ? parentNode.path : "/";
        const newPath = buildPath(parentPath, newName.trim());

        try {
          await fsInstance.promises.stat(newPath);
          throw new Error(`"${newName.trim()}" already exists.`);
        } catch (statErr: any) {
          if (statErr.code !== "ENOENT") throw statErr;
        }

        await VfsOps.renameOp(node.path, newPath);

        const changes = {
          name: newName.trim(),
          path: newPath,
          lastModified: Date.now(),
        };
        _updateNode(id, changes);

        await get().fetchNodes(node.parentId);
      } catch (err: any) {
        console.error("Failed to rename item:", err);
        _setError(err.message || "Failed to rename item.");
      } finally {
        _setOperationLoading(false);
      }
    },

    downloadFile: async (fileId) => {
      const { nodes, fs: fsInstance, _setError } = get();
      if (!fsInstance) {
        _setError("Filesystem not initialized.");
        return null;
      }
      const node = nodes[fileId];
      if (!node || node.type !== "file") {
        _setError("File not found.");
        return null;
      }

      try {
        const content = await VfsOps.readFileOp(node.path);
        const mimeType =
          (node as VfsFile).mimeType || "application/octet-stream";
        const blob = new Blob([content], { type: mimeType });
        return { name: node.name, blob };
      } catch (err) {
        console.error("Failed to download file:", err);
        _setError("Failed to retrieve file content.");
        return null;
      }
    },

    // Selection Actions
    selectFile: (fileId) => {
      set((state) => {
        const node = state.nodes[fileId];
        if (node && node.type === "file") {
          state.selectedFileIds.add(fileId);
        }
      });
    },
    deselectFile: (fileId) => {
      set((state) => {
        state.selectedFileIds.delete(fileId);
      });
    },
    clearSelection: () => {
      set((state) => {
        state.selectedFileIds.clear();
      });
    },
  })),
);
