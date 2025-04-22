// src/store/vfs.store.ts
import { create } from "zustand";
import type { FileSystemEntry } from "@/lib/types";
import * as VfsOps from "@/lib/vfs-operations";
import { toast } from "sonner";
import { fs } from "@zenfs/core";
import { configureSingle } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";

export interface VfsState {
  enableVfs: boolean;
  isVfsEnabledForItem: boolean;
  selectedVfsPaths: string[];
  isVfsReady: boolean;
  isVfsLoading: boolean;
  isVfsOperationLoading: boolean;
  vfsError: string | null;
  configuredVfsKey: string | null;
  vfsKey: string | null;
  fs: typeof fs | null;
}

export interface VfsActions {
  _setEnableVfs: (enabled: boolean) => void;
  setIsVfsEnabledForItem: (enabled: boolean) => void;
  setVfsKey: (key: string | null) => void;
  setSelectedVfsPaths: (paths: string[]) => void;
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
  setVfsReady: (isReady: boolean) => void;
  setVfsLoading: (isLoading: boolean) => void;
  setVfsOperationLoading: (isLoading: boolean) => void;
  setVfsError: (error: string | null) => void;
  setConfiguredVfsKey: (key: string | null) => void;
  _setFsInstance: (fsInstance: typeof fs | null) => void;
  initializeVfs: () => Promise<void>;
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteVfsItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string, rootPath?: string) => Promise<void>;
  renameVfsItem: (oldPath: string, newPath: string) => Promise<void>;
}

export const useVfsStore = create<VfsState & VfsActions>()((set, get) => ({
  // Initial State
  enableVfs: true,
  isVfsEnabledForItem: false,
  selectedVfsPaths: [],
  isVfsReady: false,
  isVfsLoading: false,
  isVfsOperationLoading: false,
  vfsError: null,
  configuredVfsKey: null,
  vfsKey: null,
  fs: null,

  // Configuration / Selection State Actions
  _setEnableVfs: (enableVfs) => set({ enableVfs }),
  setIsVfsEnabledForItem: (isVfsEnabledForItem) => {
    set({ isVfsEnabledForItem });
    if (!isVfsEnabledForItem) {
      get().clearSelectedVfsPaths();
    }

    // Trigger VFS initialization if enabled
    if (isVfsEnabledForItem && get().vfsKey) {
      console.log("[VfsStore] VFS enabled for item, triggering initialization");
      get().initializeVfs();
    }
  },
  setVfsKey: (vfsKey) => {
    set({ vfsKey });

    // If key changed and VFS is enabled, initialize
    if (vfsKey !== get().configuredVfsKey && get().isVfsEnabledForItem) {
      console.log("[VfsStore] VFS key changed, triggering initialization");
      get().initializeVfs();
    }
  },
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

  // VFS Operational State Actions
  setVfsReady: (isVfsReady) => set({ isVfsReady }),
  setVfsLoading: (isVfsLoading) => set({ isVfsLoading }),
  setVfsOperationLoading: (isVfsOperationLoading) =>
    set({ isVfsOperationLoading }),
  setVfsError: (vfsError) => set({ vfsError }),
  setConfiguredVfsKey: (configuredVfsKey) => set({ configuredVfsKey }),
  _setFsInstance: (fsInstance) => set({ fs: fsInstance }),

  // New direct initialization function
  initializeVfs: async () => {
    const state = get();
    const { vfsKey, isVfsEnabledForItem, enableVfs, isVfsLoading } = state;

    // Skip if already loading or not enabled or no key
    if (isVfsLoading || !vfsKey || !isVfsEnabledForItem || !enableVfs) {
      console.log("[VfsStore] initializeVfs skipped", {
        isVfsLoading,
        vfsKey,
        isVfsEnabledForItem,
        enableVfs,
      });
      return;
    }

    // Skip if already configured with this key
    if (state.configuredVfsKey === vfsKey && state.isVfsReady) {
      console.log(
        "[VfsStore] initializeVfs skipped - already configured with this key",
      );
      return;
    }

    console.log("[VfsStore] Starting VFS initialization for key:", vfsKey);

    // Reset state
    set({
      isVfsLoading: true,
      isVfsOperationLoading: false,
      vfsError: null,
      isVfsReady: false,
    });

    try {
      const vfsConf = {
        backend: IndexedDB,
        name: `litechat_vfs_${vfsKey}`,
      };

      console.log("[VfsStore] Configuring ZenFS with:", vfsConf);
      await configureSingle(vfsConf);

      // Check if state is still valid after async operation
      if (get().vfsKey !== vfsKey) {
        console.log(
          "[VfsStore] VFS key changed during initialization, aborting",
        );
        set({ isVfsLoading: false });
        return;
      }

      console.log("[VfsStore] ZenFS configured successfully, updating state");
      set({
        fs: fs,
        configuredVfsKey: vfsKey,
        isVfsReady: true,
        isVfsLoading: false,
        vfsError: null,
      });
    } catch (error) {
      console.error("[VfsStore] Failed to initialize VFS:", error);
      set({
        isVfsLoading: false,
        isVfsReady: false,
        vfsError: `Failed to initialize filesystem: ${error instanceof Error ? error.message : String(error)}`,
      });
      toast.error(
        `VFS initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  // VFS Operation Actions (Called by UI/Components)
  listFiles: async (path) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] listFiles called when VFS not ready.");
      return [];
    }
    try {
      return await VfsOps.listFilesOp(path);
    } catch (error) {
      return [];
    }
  },
  readFile: async (path) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] readFile called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    try {
      return await VfsOps.readFileOp(path);
    } catch (error) {
      throw error;
    }
  },
  writeFile: async (path, data) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] writeFile called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.writeFileOp(setLoading, path, data);
    } catch (error) {
      throw error;
    }
  },
  deleteVfsItem: async (path, recursive = false) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] deleteVfsItem called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.deleteItemOp(setLoading, path, recursive);
      set((state) => ({
        selectedVfsPaths: state.selectedVfsPaths.filter(
          (p) => p !== path && !p.startsWith(path + "/"),
        ),
      }));
    } catch (error) {
      throw error;
    }
  },
  createDirectory: async (path) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] createDirectory called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.createDirectoryOp(setLoading, path);
    } catch (error) {
      throw error;
    }
  },
  downloadFile: async (path, filename) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] downloadFile called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    try {
      await VfsOps.downloadFileOp(path, filename);
    } catch (error) {
      // Error handled by VfsOps
    }
  },
  uploadFiles: async (files, targetPath) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] uploadFiles called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.uploadFilesOp(setLoading, files, targetPath);
    } catch (error) {
      throw error;
    }
  },
  uploadAndExtractZip: async (file, targetPath) => {
    if (!get().isVfsReady || !get().fs) {
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
      throw error;
    }
  },
  downloadAllAsZip: async (filename, rootPath = "/") => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] downloadAllAsZip called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.downloadAllAsZipOp(setLoading, filename, rootPath);
    } catch (error) {
      // Error handled by VfsOps
    }
  },
  renameVfsItem: async (oldPath, newPath) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] renameVfsItem called when VFS not ready.");
      throw new Error("Filesystem not ready.");
    }
    const setLoading = get().setVfsOperationLoading;
    try {
      await VfsOps.renameOp(setLoading, oldPath, newPath);
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
      throw error;
    }
  },
}));
