// src/store/vfs.store.ts
// FULL FILE
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  VfsNode,
  VfsFile,
  VfsDirectory,
  FileSystemEntry,
} from "@/types/litechat/vfs";
import { normalizePath, buildPath } from "@/lib/litechat/file-manager-utils";
import { toast } from "sonner";
import { fs } from "@zenfs/core";
import { VfsService } from "@/services/vfs.service";
import { nanoid } from "nanoid";
import { emitter } from "@/lib/litechat/event-emitter";
import { vfsEvent, VfsEventPayloads } from "@/types/litechat/events/vfs.events";
import type {
  RegisteredActionHandler,
  ActionHandler,
} from "@/types/litechat/control";

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
  vfsKey: string | null;
  configuredVfsKey: string | null;
  initializingKey: string | null;
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
  setVfsKey: (key: string | null) => void;
  _setConfiguredVfsKey: (key: string | null) => void;

  fetchNodes: (parentId?: string | null) => Promise<void>;
  setCurrentPath: (path: string) => Promise<void>;
  findNodeByPath: (path: string) => VfsNode | undefined;

  createDirectory: (parentId: string | null, name: string) => Promise<void>;
  uploadFiles: (parentId: string | null, files: FileList) => Promise<void>;
  deleteNodes: (ids: string[]) => Promise<void>;
  renameNode: (id: string, newName: string) => Promise<void>;
  downloadFile: (
    fileId: string
  ) => Promise<{ name: string; blob: Blob } | null>;

  selectFile: (fileId: string) => void;
  deselectFile: (fileId: string) => void;
  clearSelection: () => void;
  initializeVFS: (
    vfsKey: string,
    options?: { force?: boolean }
  ) => Promise<typeof fs>;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
  resetStuckInitialization: () => void;
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
    vfsKey: null,
    configuredVfsKey: null,
    initializingKey: null,

    // Internal Actions
    _setLoading: (loading) => {
      set((state) => {
        state.loading = loading;
        if (loading) state.error = null;
      });
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: get().loading,
        operationLoading: get().operationLoading,
        error: get().error,
      });
    },
    _setOperationLoading: (loading) => {
      set((state) => {
        state.operationLoading = loading;
      });
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: get().loading,
        operationLoading: get().operationLoading,
        error: get().error,
      });
    },
    _setError: (error) => {
      set((state) => {
        state.error = error;
        state.loading = false;
        state.operationLoading = false;
        state.initializingKey = null;
        if (error) {
          toast.error(`VFS Error: ${error}`);
        }
      });
      emitter.emit(vfsEvent.loadingStateChanged, {
        isLoading: get().loading,
        operationLoading: get().operationLoading,
        error: get().error,
      });
    },
    _addNodes: (nodesToAdd) => {
      set((state) => {
        const parentUpdates: Record<string, string[]> = {};

        nodesToAdd.forEach((node) => {
          state.nodes[node.id] = node;
          const parentIdKey = node.parentId ?? state.rootId ?? "";
          if (!parentUpdates[parentIdKey]) {
            parentUpdates[parentIdKey] = state.childrenMap[parentIdKey]
              ? [...state.childrenMap[parentIdKey]]
              : [];
          }
          if (!parentUpdates[parentIdKey].includes(node.id)) {
            parentUpdates[parentIdKey].push(node.id);
          }
        });

        for (const parentIdKey in parentUpdates) {
          if (
            !state.childrenMap[parentIdKey] ||
            JSON.stringify(state.childrenMap[parentIdKey].sort()) !==
              JSON.stringify(parentUpdates[parentIdKey].sort())
          ) {
            state.childrenMap[parentIdKey] = parentUpdates[parentIdKey];
          }
        }
      });
      emitter.emit(vfsEvent.nodesUpdated, {
        vfsKey: get().vfsKey,
        nodes: get().nodes,
        childrenMap: get().childrenMap,
      });
    },
    _updateNode: (id, changes) => {
      set((state) => {
        if (state.nodes[id]) {
          Object.assign(state.nodes[id], changes);
        }
      });
      emitter.emit(vfsEvent.nodesUpdated, {
        vfsKey: get().vfsKey,
        nodes: get().nodes,
        childrenMap: get().childrenMap,
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
                get()._removeNodes(childIdsToRemove); // Recursive call, careful with event emission
              }
              delete state.childrenMap[id];
            }
          }
        });
      });
      emitter.emit(vfsEvent.nodesUpdated, {
        vfsKey: get().vfsKey,
        nodes: get().nodes,
        childrenMap: get().childrenMap,
      });
      emitter.emit(vfsEvent.selectionChanged, {
        selectedFileIds: Array.from(get().selectedFileIds),
      });
    },
    _setFsInstance: (fsInstance) => {
      set({ fs: fsInstance });
      emitter.emit(vfsEvent.fsInstanceChanged, { fsInstance });
    },
    _setEnableVfs: (enabled) => {
      console.log(`[VfsStore] Setting global enableVfs to: ${enabled}`);
      set({ enableVfs: enabled });
      emitter.emit(vfsEvent.vfsEnabledChanged, { enabled });
      if (!enabled) {
        set({
          fs: null,
          configuredVfsKey: null,
          vfsKey: null,
          rootId: null,
          currentParentId: null,
          nodes: {},
          childrenMap: { "": [] },
          error: null,
          loading: false,
          operationLoading: false,
          initializingKey: null,
        });
        emitter.emit(vfsEvent.vfsKeyChanged, {
          vfsKey: null,
          configuredVfsKey: null,
        });
      // } else if (!get().vfsKey && !get().configuredVfsKey) {
      //   console.log(
      //     "[VfsStore] VFS globally enabled, waiting for vfsKey to be set."
      //   );
      }
    },
    _setConfiguredVfsKey: (key) => {
      set({ configuredVfsKey: key });
      emitter.emit(vfsEvent.vfsKeyChanged, {
        vfsKey: get().vfsKey,
        configuredVfsKey: key,
      });
    },

    setVfsKey: (key) => {
      if (key !== null) {
        const currentDesiredKey = get().vfsKey;
        const currentConfiguredKey = get().configuredVfsKey;

        if (key === currentDesiredKey) {
          // console.log(`[VfsStore] setVfsKey: Key ${key} is already desired.`);
          if (key && key !== currentConfiguredKey && !get().initializingKey) {
            // console.log(
            //   `[VfsStore] setVfsKey: Re-triggering initialization for desired key ${key} as it's not configured.`
            // );
            get()
              .initializeVFS(key)
              .catch((err) => {
                console.error(
                  `[VfsStore] Error during re-initialization trigger for ${key}:`,
                  err
                );
              });
          }
          return;
        }

        console.log(
          `[VfsStore] setVfsKey: Changing desired key from ${currentDesiredKey} to ${key}. Configured: ${currentConfiguredKey}`
        );
        set({ vfsKey: key });

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
          selectedFileIds: new Set(),
          initializingKey: null,
        });
        emitter.emit(vfsEvent.vfsKeyChanged, {
          vfsKey: key,
          configuredVfsKey: null,
        });

        if (key !== null) {
          get()
            .initializeVFS(key)
            .catch((err) => {
              console.error(
                `[VfsStore] Error during initialization trigger for ${key}:`,
                err
              );
            });
        // } else {
        //   console.log(
        //     "[VfsStore] setVfsKey: Desired key is null. State cleared."
        //   );
        }
      }
    },

    initializeVFS: async (vfsKeyParam: any, optionsParam?: { force?: boolean }) => {
      // console.log('[VfsStore DEBUG] initializeVFS called with:', 
      //   {
      //     vfsKeyParam: typeof vfsKeyParam === 'object' ? JSON.parse(JSON.stringify(vfsKeyParam)) : vfsKeyParam, 
      //     optionsParam: typeof optionsParam === 'object' ? JSON.parse(JSON.stringify(optionsParam)) : optionsParam
      //   }
      // );

      let vfsKey: string;
      let options: { force?: boolean } | undefined;

      // Argument grooming: Handle various ways initializeVFS might be called.
      if (typeof vfsKeyParam === 'object' && vfsKeyParam !== null && 'vfsKey' in vfsKeyParam) {
        // Case 1: Called with a single object argument like { vfsKey: 'key', options: { force: true } }
        // This is likely from an incorrectly wired event handler.
        console.warn(
          `[VfsStore] initializeVFS called with a single object payload. Correcting. Input:`, 
          JSON.parse(JSON.stringify(vfsKeyParam)) // Deep clone for logging complex objects
        );
        vfsKey = String(vfsKeyParam.vfsKey);
        options = vfsKeyParam.options as { force?: boolean } | undefined;
      } else if (typeof vfsKeyParam === 'string') {
        // Case 2: Called correctly as initializeVFS('key', { force: true })
        vfsKey = vfsKeyParam;
        options = optionsParam;
      } else {
        // Case 3: Invalid first argument type
        const errorMessage = `[VfsStore] initializeVFS called with invalid vfsKey type. Type: ${typeof vfsKeyParam}, Value: "${String(vfsKeyParam)}". Aborting.`;
        console.error(errorMessage, vfsKeyParam);
        throw new Error("VFS key must be a string and cannot be empty.");
      }

      if (!vfsKey || vfsKey.trim() === "") {
         const errorMessage = `[VfsStore] initializeVFS: Derived vfsKey is empty or invalid. Original param: ${String(vfsKeyParam)}, Derived key: "${vfsKey}". Aborting.`;
         console.error(errorMessage, {originalVfsKeyParam: vfsKeyParam, originalOptionsParam: optionsParam});
         throw new Error("VFS key cannot be empty after processing.");
      }

      const isForced = options?.force === true;
      // console.log(`[VfsStore DEBUG] initializeVFS derived: vfsKey="${vfsKey}", isForced=${isForced}`);

      // Check if already initializing THIS key (applies to both forced and non-forced)
      if (get().initializingKey === vfsKey) {
        const message = `Initialization skipped for "${vfsKey}". Already actively initializing this exact key.`;
        console.warn(`[VfsStore] ${message}`);
        // Instead of throwing an error, wait for the current initialization to complete
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            const currentState = get();
            if (currentState.initializingKey !== vfsKey) {
              clearInterval(checkInterval);
              if (currentState.configuredVfsKey === vfsKey && currentState.fs) {
                resolve(currentState.fs);
              } else {
                reject(new Error(`VFS initialization for "${vfsKey}" failed or was interrupted`));
              }
            }
          }, 100);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error(`Timeout waiting for VFS "${vfsKey}" initialization to complete`));
          }, 10000);
        });
      }

      // Check if already configured and ready (applies to both forced and non-forced)
      if (get().configuredVfsKey === vfsKey && get().fs) {
        // console.log(`[VfsStore] Initialization skipped for key "${vfsKey}" (already configured).`);
        if (!isForced) {
          set({ loading: false }); // Ensure loading is false if skipped
        }
        return get().fs!;
      }

      if (!isForced) {
        if (get().vfsKey !== vfsKey) {
          const message = `UI Initialization aborted for "${vfsKey}". Desired key is now "${get().vfsKey}".`;
          console.warn(`[VfsStore] ${message}`);
          throw new Error(message);
        }
        if (get().initializingKey !== null && get().initializingKey !== vfsKey) { // Check if initializing a DIFFERENT key
          const message = `UI Initialization skipped for "${vfsKey}". Already initializing a different key "${get().initializingKey}".`;
          console.warn(`[VfsStore] ${message}`);
          throw new Error(message);
        }
      }

      const {
        _setLoading,
        _setError,
        _addNodes,
        _setFsInstance,
        _setConfiguredVfsKey,
      } = get();

      console.log(
        `[VfsStore] Initializing VFS with key: ${vfsKey} (Forced: ${isForced})`
      );
      set({ initializingKey: vfsKey });
      if (!isForced) {
        _setLoading(true);
        _setError(null);
      }

      try {
        // console.log(`[VfsStore DEBUG] About to call VfsService.initializeFsOp with key: "${vfsKey}"`);
        const initSuccess = await VfsService.initializeFsOp(vfsKey);
        // console.log(`[VfsStore DEBUG] VfsService.initializeFsOp returned. Success: ${initSuccess}`);

        if (!initSuccess) {
          throw new Error("Filesystem backend initialization failed.");
        }

        if (!isForced) {
          if (get().vfsKey !== vfsKey) {
            const message = `UI Initialization for key "${vfsKey}" completed, but desired key changed to "${
              get().vfsKey
            }". Discarding result.`;
            console.warn(`[VfsStore] ${message}`);
            set({ initializingKey: null, loading: false });
            throw new Error(message);
          }
        }

        if (isForced) {
          // console.log(
          //   `[VfsStore] Forced initialization complete for key: ${vfsKey}. Updating state and returning instance.`
          // );
          // Still update the VFS state even with force=true so events fire properly
          // Set a dummy filesystem instance since some code expects it
          _setFsInstance({} as any);
          _setConfiguredVfsKey(vfsKey);
          set({ initializingKey: null });
          // Emit loading state changed event for forced initialization
          emitter.emit(vfsEvent.loadingStateChanged, {
            isLoading: false,
            operationLoading: false,
            error: null,
          });
          return {} as any;
        }

        // Set a dummy filesystem instance since some code expects it, but all operations go through VfsService
        _setFsInstance({} as any);
        _setConfiguredVfsKey(vfsKey);
        console.log(`[VfsStore] UI VFS instance configured for key: ${vfsKey}`);

        const stableRootId = "vfs-root";
        let rootNode = get().nodes[stableRootId];

        // Check if root directory exists using VFS service instead of direct filesystem
        try {
          // Try to list the root directory to verify it exists and is accessible
          await VfsService.listFilesOp(vfsKey, "/");
          // console.log("[VfsStore] Root directory '/' exists and accessible.");
        } catch (statErr: any) {
          if (statErr.message && statErr.message.includes("ENOENT")) {
            console.warn(
              "[VfsStore] Root directory '/' not found, will be created implicitly."
            );
          } else {
            throw statErr;
          }
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
          // console.log("[VfsStore] Root node added/updated in state.");
        }

        set((s) => {
          s.rootId = rootNode!.id;
          s.currentParentId = rootNode!.id;
        });
        // console.log(
        //   `[VfsStore] Set rootId and currentParentId to: ${rootNode!.id}`
        // );

        await get().fetchNodes(rootNode.id);
        return {} as any;
      } catch (err) {
        const errorMessage = `Failed to initialize VFS (${vfsKey}): ${
          err instanceof Error ? err.message : String(err)
        }`;
        console.error(`[VfsStore DEBUG] Error in initializeVFS catch block: ${errorMessage}`, err);
        if (get().initializingKey === vfsKey) {
          _setError(errorMessage);
          if (!isForced) {
            _setFsInstance(null);
            _setConfiguredVfsKey(null);
          }
        }
        throw new Error(errorMessage);
      } finally {
        // console.log(`[VfsStore DEBUG] initializeVFS finally block for key: "${vfsKey}". InitializingKey: ${get().initializingKey}`);
        if (get().initializingKey === vfsKey) {
          set({ initializingKey: null });
          if (!isForced) {
            set({ loading: false });
          }
        }
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
        configuredVfsKey,
        vfsKey,
        initializingKey,
      } = get();

      if (!fsInstance || configuredVfsKey !== vfsKey || initializingKey) {
        console.warn(
          `[VfsStore] fetchNodes skipped. Ready: ${!!fsInstance}, Match: ${
            configuredVfsKey === vfsKey
          }, Init: ${initializingKey}`
        );
        return;
      }

      _setLoading(true);
      try {
        const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
        const pathToFetch = parentNode ? parentNode.path : "/";
        // console.log(
        //   `[VfsStore] Fetching nodes for path: ${pathToFetch} (Key: ${configuredVfsKey})`
        // );
        // Use the optimized batch operation from VFS worker - ONE call gets everything!
        const fetchedEntries = await VfsService.listFilesOp(configuredVfsKey!, pathToFetch);
        // console.log(
        //   `[VfsStore] Fetched ${fetchedEntries.length} entries for ${pathToFetch}`
        // );

        const parentKey = parentId ?? rootId ?? "";
        const fetchedPaths = new Set(fetchedEntries.map((e) => e.path));

        const currentChildrenIds = get().childrenMap[parentKey] || [];
        const currentChildrenNodes = currentChildrenIds
          .map((id) => get().nodes[id])
          .filter(Boolean);

        const idsToRemove = currentChildrenNodes
          .filter((n) => !fetchedPaths.has(n.path))
          .map((n) => n.id);

        if (idsToRemove.length > 0) {
          // console.log(`[VfsStore] Removing ${idsToRemove.length} nodes.`);
          get()._removeNodes(idsToRemove);
        }

        const nodesToAddOrUpdate: VfsNode[] = fetchedEntries.map(
          (entry: FileSystemEntry): VfsNode => {
            const existingNode = Object.values(get().nodes).find(
              (n) => n.path === entry.path
            );
            const now = Date.now();
            return {
              id: existingNode?.id || nanoid(),
              parentId: parentId,
              name: entry.name,
              path: entry.path,
              type: entry.isDirectory ? "folder" : "file",
              size: entry.size,
              createdAt: existingNode?.createdAt ?? now,
              lastModified: entry.lastModified.getTime(),
              mimeType: entry.isDirectory ? undefined : (entry as any).mimeType,
            };
          }
        );

        if (nodesToAddOrUpdate.length > 0) {
          // console.log(
          //   `[VfsStore] Adding/Updating ${nodesToAddOrUpdate.length} nodes.`
          // );
          _addNodes(nodesToAddOrUpdate);
        }

        set((state) => {
          const finalChildIds = nodesToAddOrUpdate.map((n) => n.id);
          if (
            !state.childrenMap[parentKey] ||
            JSON.stringify(state.childrenMap[parentKey].sort()) !==
              JSON.stringify(finalChildIds.sort())
          ) {
            state.childrenMap[parentKey] = finalChildIds;
            // console.log(
            //   `[VfsStore] Updated childrenMap for parent: ${parentKey}`
            // );
          }
        });
      } catch (err) {
        console.error("Failed to fetch VFS nodes:", err);
        _setError("Failed to load directory contents.");
      } finally {
        _setLoading(false);
      }
    },

    findNodeByPath: (path) => {
      const normalized = normalizePath(path);
      if (get().vfsKey !== get().configuredVfsKey) return undefined;

      if (normalized === "/") {
        const rootNodeId = get().rootId;
        return rootNodeId ? get().nodes[rootNodeId] : undefined;
      }
      return Object.values(get().nodes).find((n) => n.path === normalized);
    },

    setCurrentPath: async (path) => {
      const { findNodeByPath, fetchNodes, rootId, fs: fsInstance } = get();
      if (!fsInstance || get().vfsKey !== get().configuredVfsKey) return;

      const normalizedPath = normalizePath(path);
      const targetNode = findNodeByPath(normalizedPath);

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
        configuredVfsKey,
        vfsKey,
      } = get();
      if (!fsInstance || configuredVfsKey !== vfsKey) {
        _setError("Filesystem not ready.");
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

        await VfsService.createDirectoryOp(configuredVfsKey!, newPath);

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
        configuredVfsKey,
        vfsKey,
      } = get();
      if (!fsInstance || configuredVfsKey !== vfsKey) {
        _setError("Filesystem not ready.");
        return;
      }
      _setOperationLoading(true);
      try {
        const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
        const parentPath = parentNode ? parentNode.path : "/";
        // Upload files through VfsService to use worker
        await VfsService.uploadFilesOp(configuredVfsKey!, Array.from(files), parentPath);
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
        configuredVfsKey,
        vfsKey,
      } = get();
      if (!fsInstance || configuredVfsKey !== vfsKey) {
        _setError("Filesystem not ready.");
        return;
      }
      _setOperationLoading(true);
      try {
        const nodesToDelete = ids.map((id) => get().nodes[id]).filter(Boolean);
        for (const node of nodesToDelete) {
          await VfsService.deleteItemOp(configuredVfsKey!, node.path, node.type === "folder");
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
        configuredVfsKey,
        vfsKey,
      } = get();
      if (!fsInstance || configuredVfsKey !== vfsKey) {
        _setError("Filesystem not ready.");
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

        await VfsService.renameOp(configuredVfsKey!, node.path, newPath);

        const changes = {
          name: newName.trim(),
          path: newPath,
          lastModified: Date.now(),
        };
        _updateNode(id, changes);
      } catch (err: any) {
        console.error("Failed to rename item:", err);
        _setError(err.message || "Failed to rename item.");
      } finally {
        _setOperationLoading(false);
      }
    },

    downloadFile: async (fileId) => {
      const {
        nodes,
        fs: fsInstance,
        _setError,
        configuredVfsKey,
        vfsKey,
      } = get();
      if (!fsInstance || configuredVfsKey !== vfsKey) {
        _setError("Filesystem not ready.");
        return null;
      }
      const node = nodes[fileId];
      if (!node || node.type !== "file") {
        _setError("File not found.");
        return null;
      }

      try {
        const content = await VfsService.readFileOp(configuredVfsKey!, node.path);
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

    selectFile: (fileId) => {
      set((state) => {
        state.selectedFileIds.add(fileId);
      });
      emitter.emit(vfsEvent.selectionChanged, {
        selectedFileIds: Array.from(get().selectedFileIds),
      });
    },
    deselectFile: (fileId) => {
      set((state) => {
        state.selectedFileIds.delete(fileId);
      });
      emitter.emit(vfsEvent.selectionChanged, {
        selectedFileIds: Array.from(get().selectedFileIds),
      });
    },
    clearSelection: () => {
      set((state) => {
        state.selectedFileIds.clear();
      });
      emitter.emit(vfsEvent.selectionChanged, {
        selectedFileIds: [],
      });
    },
    resetStuckInitialization: () => {
      console.warn("[VfsStore] Force resetting stuck initialization state");
      set({ 
        initializingKey: null, 
        loading: false, 
        operationLoading: false,
        error: null 
      });
    },

    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const storeId = "vfsStore";
      const actions = get();
      const wrapPromiseBlob =
        <P>(
          fn: (payload: P) => Promise<{ name: string; blob: Blob } | null>
        ): ActionHandler<P> =>
        async (payload: P) => {
          await fn(payload);
        };

      return [
        {
          eventName: vfsEvent.setVfsKeyRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.setVfsKeyRequest]) =>
            actions.setVfsKey(p.key),
          storeId,
        },
        {
          eventName: vfsEvent.initializeVFSRequest,
          handler: async (payload: VfsEventPayloads[typeof vfsEvent.initializeVFSRequest]) => {
            await actions.initializeVFS(payload.vfsKey, payload.options);
          },
          storeId,
        },
        {
          eventName: vfsEvent.fetchNodesRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.fetchNodesRequest]) =>
            actions.fetchNodes(p.parentId),
          storeId,
        },
        {
          eventName: vfsEvent.setCurrentPathRequest,
          handler: (
            p: VfsEventPayloads[typeof vfsEvent.setCurrentPathRequest]
          ) => actions.setCurrentPath(p.path),
          storeId,
        },
        {
          eventName: vfsEvent.createDirectoryRequest,
          handler: (
            p: VfsEventPayloads[typeof vfsEvent.createDirectoryRequest]
          ) => actions.createDirectory(p.parentId, p.name),
          storeId,
        },
        {
          eventName: vfsEvent.uploadFilesRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.uploadFilesRequest]) =>
            actions.uploadFiles(p.parentId, p.files),
          storeId,
        },
        {
          eventName: vfsEvent.deleteNodesRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.deleteNodesRequest]) =>
            actions.deleteNodes(p.ids),
          storeId,
        },
        {
          eventName: vfsEvent.renameNodeRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.renameNodeRequest]) =>
            actions.renameNode(p.id, p.newName),
          storeId,
        },
        {
          eventName: vfsEvent.downloadFileRequest,
          handler: wrapPromiseBlob(actions.downloadFile),
          storeId,
        },
        {
          eventName: vfsEvent.selectFileRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.selectFileRequest]) =>
            actions.selectFile(p.fileId),
          storeId,
        },
        {
          eventName: vfsEvent.deselectFileRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.deselectFileRequest]) =>
            actions.deselectFile(p.fileId),
          storeId,
        },
        {
          eventName: vfsEvent.clearSelectionRequest,
          handler: actions.clearSelection,
          storeId,
        },
        {
          eventName: vfsEvent.setEnableVfsRequest,
          handler: (p: VfsEventPayloads[typeof vfsEvent.setEnableVfsRequest]) =>
            actions._setEnableVfs(p.enabled),
          storeId,
        },
      ];
    },
  }))
);
