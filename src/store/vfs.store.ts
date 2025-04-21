// src/store/vfs.store.ts
import { create } from "zustand";
import type { FileSystemEntry } from "@/lib/types";
// Import VFS operations - These will be called by the actions below
// We need a way to access the configured fs instance (maybe pass it?)
// Or, the hook calls these directly and updates store state. Let's assume the latter for now.
import * as VfsOps from "@/lib/vfs-operations";
import { toast } from "sonner";
import { fs } from "@zenfs/core"; // Import fs for type

export interface VfsState {
  enableVfs: boolean; // Global VFS toggle (Set via config)
  isVfsEnabledForItem: boolean; // Is VFS active for the *currently selected* item? (Set by sidebar store)
  selectedVfsPaths: string[]; // Paths selected in the VFS browser for context
  // VFS Operational State (Managed by useVirtualFileSystem hook via actions)
  isVfsReady: boolean;
  isVfsLoading: boolean; // Initial loading/mounting of the FS instance
  isVfsOperationLoading: boolean; // Loading during file ops (write, delete, zip etc.)
  vfsError: string | null;
  configuredVfsKey: string | null; // Identifier for the *type* of backend (e.g., 'indexeddb') - might not be needed if always the same
  vfsKey: string | null; // Unique key for the current FS instance (e.g., item ID or 'orphan') (Set by sidebar store)
  fs: typeof fs | null; // Add the fs instance to the state
}

export interface VfsActions {
  // Configuration / Selection State Actions
  _setEnableVfs: (enabled: boolean) => void; // Internal setter, usually from initial config
  setIsVfsEnabledForItem: (enabled: boolean) => void; // Called by sidebar store's selectItem/toggleVfs
  setVfsKey: (key: string | null) => void; // Called by sidebar store's selectItem
  setSelectedVfsPaths: (paths: string[]) => void;
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;

  // VFS Operational State Actions (Called by useVirtualFileSystem hook)
  setVfsReady: (isReady: boolean) => void;
  setVfsLoading: (isLoading: boolean) => void;
  setVfsOperationLoading: (isLoading: boolean) => void;
  setVfsError: (error: string | null) => void;
  setConfiguredVfsKey: (key: string | null) => void; // Potentially set by hook on init
  _setFsInstance: (fsInstance: typeof fs | null) => void; // Internal action to set fs

  // Actual FS operations - These actions will trigger the operations
  // They manage the operation loading state and call the VfsOps functions.
  // Note: These assume the FS is already configured and ready (checked by the hook).
  // The hook should ensure readiness before these are effectively called.
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteVfsItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  // FIX: Accept FileList | File[]
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string, rootPath?: string) => Promise<void>;
  renameVfsItem: (oldPath: string, newPath: string) => Promise<void>;
}

export const useVfsStore = create<VfsState & VfsActions>()((set, get) => ({
  // Initial State
  enableVfs: true, // Default, can be overridden by config
  isVfsEnabledForItem: false,
  selectedVfsPaths: [],
  isVfsReady: false,
  isVfsLoading: false,
  isVfsOperationLoading: false,
  vfsError: null,
  configuredVfsKey: null, // e.g., 'indexeddb' - set by hook maybe
  vfsKey: null, // e.g., item ID - set by sidebar store
  fs: null, // Initialize fs as null

  // --- Configuration / Selection State Actions ---
  _setEnableVfs: (enableVfs) => set({ enableVfs }), // Internal setter
  setIsVfsEnabledForItem: (isVfsEnabledForItem) => {
    set({ isVfsEnabledForItem });
    // If VFS is disabled for the item, clear selections
    if (!isVfsEnabledForItem) {
      get().clearSelectedVfsPaths();
    }
  },
  setVfsKey: (vfsKey) => set({ vfsKey }),
  setSelectedVfsPaths: (selectedVfsPaths) => set({ selectedVfsPaths }),
  addSelectedVfsPath: (path) =>
    set((state) => ({
      selectedVfsPaths: state.selectedVfsPaths.includes(path)
        ? state.selectedVfsPaths
        : [...state.selectedVfsPaths, path].sort(),
    })),
  removeSelectedVfsPath: (path) =>
    set((state) => ({
      selectedVfsPaths: state.selectedVfsPaths.filter((p) => p !== path),
    })),
  clearSelectedVfsPaths: () => set({ selectedVfsPaths: [] }),

  // --- VFS Operational State Actions (Called by Hook) ---
  setVfsReady: (isVfsReady) => set({ isVfsReady }),
  setVfsLoading: (isVfsLoading) => set({ isVfsLoading }),
  setVfsOperationLoading: (isVfsOperationLoading) =>
    set({ isVfsOperationLoading }),
  setVfsError: (vfsError) => set({ vfsError }),
  setConfiguredVfsKey: (configuredVfsKey) => set({ configuredVfsKey }),
  _setFsInstance: (fsInstance) => set({ fs: fsInstance }), // Internal action

  // --- VFS Operation Actions (Called by UI/Components) ---
  // These actions wrap the VfsOps calls and manage loading state.
  // They rely on the hook having already configured the FS.
  listFiles: async (path) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] listFiles called when VFS not ready.");
      return [];
    }
    // No operation loading for listFiles usually
    try {
      return await VfsOps.listFilesOp(path);
    } catch (error) {
      // Error handled by VfsOps (toast)
      return [];
    }
  },
  readFile: async (path) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] readFile called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    // No operation loading for readFile usually
    try {
      return await VfsOps.readFileOp(path);
    } catch (error) {
      // Error handled by VfsOps (toast)
      throw error; // Re-throw
    }
  },
  writeFile: async (path, data) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] writeFile called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    // Use the store's setter for loading state
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.writeFileOp(setLoading, path, data);
    } catch (error) {
      // Error handled by VfsOps (toast)
      throw error; // Re-throw
    }
  },
  deleteVfsItem: async (path, recursive = false) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] deleteVfsItem called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.deleteItemOp(setLoading, path, recursive);
      // Clear selection if the deleted item was selected
      set((state) => ({
        selectedVfsPaths: state.selectedVfsPaths.filter(
          (p) => p !== path && !p.startsWith(path + "/"),
        ),
      }));
    } catch (error) {
      // Error handled by VfsOps (toast)
      throw error; // Re-throw
    }
  },
  createDirectory: async (path) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] createDirectory called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.createDirectoryOp(setLoading, path);
    } catch (error) {
      // Error handled by VfsOps (toast)
      throw error; // Re-throw
    }
  },
  downloadFile: async (path, filename) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] downloadFile called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    // Download doesn't usually have a loading spinner state in the UI
    try {
      await VfsOps.downloadFileOp(path, filename);
    } catch (error) {
      // Error handled by VfsOps (toast)
      // Don't re-throw, as it's usually just a UI action
    }
  },
  // FIX: Accept FileList | File[]
  uploadFiles: async (files, targetPath) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] uploadFiles called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      // VfsOps expects FileList | File[], pass it directly
      await VfsOps.uploadFilesOp(setLoading, files, targetPath);
    } catch (error) {
      // Error handled by VfsOps (toast)
      throw error; // Re-throw
    }
  },
  uploadAndExtractZip: async (file, targetPath) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error(
        "[VFS Store] uploadAndExtractZip called when VFS not ready.",
      );
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.uploadAndExtractZipOp(setLoading, file, targetPath);
    } catch (error) {
      // Error handled by VfsOps (toast)
      throw error; // Re-throw
    }
  },
  downloadAllAsZip: async (filename, rootPath = "/") => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] downloadAllAsZip called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.downloadAllAsZipOp(setLoading, filename, rootPath);
    } catch (error) {
      // Error handled by VfsOps (toast)
      // Don't re-throw
    }
  },
  renameVfsItem: async (oldPath, newPath) => {
    if (!get().isVfsReady) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] renameVfsItem called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.renameOp(setLoading, oldPath, newPath);
      // Update selected paths if the renamed item or its children were selected
      set((state) => ({
        selectedVfsPaths: state.selectedVfsPaths.map((p) => {
          if (p === oldPath) return newPath;
          if (p.startsWith(oldPath + "/")) {
            return newPath + p.substring(oldPath.length);
          }
          return p;
        }),
      }));
    } catch (error) {
      // Error handled by VfsOps (toast)
      throw error; // Re-throw
    }
  },
}));
