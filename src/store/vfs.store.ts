// src/store/vfs.store.ts
import { create } from "zustand";
import type { FileSystemEntry } from "@/lib/types";
import * as VfsOps from "@/lib/vfs-operations";
import { toast } from "sonner";
import { fs } from "@zenfs/core";
import { configureSingle } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";

export interface VfsState {
  enableVfs: boolean; // Global toggle from config
  isVfsEnabledForItem: boolean; // Is VFS specifically enabled for the selected item?
  selectedVfsPaths: string[]; // Paths selected by user for context
  isVfsReady: boolean; // Is the fs instance configured and ready for the configuredVfsKey?
  isVfsLoading: boolean; // Is initializeVfs currently running?
  isVfsOperationLoading: boolean; // Is a file operation (read/write/list) running?
  vfsError: string | null; // Error during initialization
  configuredVfsKey: string | null; // The key the current fs instance is configured for
  vfsKey: string | null; // The key that *should* be active based on selection
  fs: typeof fs | null; // The actual ZenFS instance
}

export interface VfsActions {
  _setEnableVfs: (enabled: boolean) => void; // Set global enable flag
  setIsVfsEnabledForItem: (enabled: boolean) => void; // Set item-specific flag
  setVfsKey: (key: string | null) => void; // Set the target VFS key
  setSelectedVfsPaths: (paths: string[]) => void;
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
  setVfsReady: (isReady: boolean) => void; // Manually set ready state (used internally/by sidebar)
  setVfsLoading: (isLoading: boolean) => void; // Manually set loading state
  setVfsOperationLoading: (isLoading: boolean) => void;
  setVfsError: (error: string | null) => void;
  setConfiguredVfsKey: (key: string | null) => void; // Manually set configured key
  _setFsInstance: (fsInstance: typeof fs | null) => void; // Internal: set fs instance
  initializeVfs: () => Promise<void>; // Initialize based on current state
  // VFS Operations
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
  _setEnableVfs: (enableVfs) => {
    console.log(`[VfsStore] Setting global enableVfs to: ${enableVfs}`);
    set({ enableVfs });
    // If globally disabling, ensure VFS becomes not ready
    if (!enableVfs) {
      set({
        isVfsReady: false,
        configuredVfsKey: null,
        fs: null,
        vfsError: null,
      });
    } else {
      // If globally enabling, trigger init if conditions met
      get().initializeVfs();
    }
  },
  setIsVfsEnabledForItem: (isVfsEnabledForItem) => {
    console.log(
      `[VfsStore] Setting isVfsEnabledForItem to: ${isVfsEnabledForItem}`,
    );
    set({ isVfsEnabledForItem });
    if (!isVfsEnabledForItem) {
      get().clearSelectedVfsPaths();
      // If disabling for item, ensure VFS becomes not ready *if* this was the active key
      if (get().vfsKey === get().configuredVfsKey) {
        set({
          isVfsReady: false,
          configuredVfsKey: null,
          fs: null,
          vfsError: null,
        });
      }
    } else {
      // If enabling for item, trigger init
      get().initializeVfs();
    }
  },
  setVfsKey: (vfsKey) => {
    const currentConfiguredKey = get().configuredVfsKey;
    console.log(
      `[VfsStore] Setting vfsKey to: ${vfsKey} (Current configured: ${currentConfiguredKey})`,
    );
    set({ vfsKey });

    // If the target key is different from the currently configured one, reset readiness
    // and trigger initialization if VFS should be active for this key.
    if (vfsKey !== currentConfiguredKey) {
      console.log(
        `[VfsStore] vfsKey changed. Resetting readiness and configured key.`,
      );
      set({
        isVfsReady: false,
        configuredVfsKey: null,
        fs: null,
        vfsError: null,
      });
      // Trigger initialization if conditions are met for the new key
      if (get().isVfsEnabledForItem && get().enableVfs && vfsKey) {
        get().initializeVfs();
      }
    } else if (vfsKey === currentConfiguredKey && !get().isVfsReady) {
      // If key is the same but VFS isn't ready (e.g., after an error), try initializing again
      console.log(
        `[VfsStore] vfsKey matches configured key, but not ready. Retrying initialization.`,
      );
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

  // Initialization Function
  initializeVfs: async () => {
    const state = get();
    const {
      vfsKey,
      isVfsEnabledForItem,
      enableVfs,
      isVfsLoading,
      configuredVfsKey,
      isVfsReady,
    } = state;

    // --- Pre-conditions Check ---
    if (!enableVfs) {
      console.log("[VfsStore] initializeVfs skipped: Global VFS disabled.");
      return;
    }
    if (!isVfsEnabledForItem) {
      console.log(
        "[VfsStore] initializeVfs skipped: VFS not enabled for current item.",
      );
      return;
    }
    if (!vfsKey) {
      console.log("[VfsStore] initializeVfs skipped: No vfsKey set.");
      return;
    }
    if (isVfsLoading) {
      console.log("[VfsStore] initializeVfs skipped: Already loading.");
      return;
    }
    // Skip if already configured and ready for the *target* key
    if (configuredVfsKey === vfsKey && isVfsReady) {
      console.log(
        `[VfsStore] initializeVfs skipped: Already configured and ready for key "${vfsKey}".`,
      );
      return;
    }
    // --- End Pre-conditions Check ---

    console.log(`[VfsStore] Starting VFS initialization for key: "${vfsKey}"`);

    // Reset state before attempting initialization
    set({
      isVfsLoading: true,
      isVfsOperationLoading: false, // Reset operation loading as well
      vfsError: null,
      isVfsReady: false, // Ensure readiness is false during init
      // Keep configuredVfsKey as is for now, update on success
      fs: null, // Clear fs instance
    });

    try {
      const vfsConf = {
        backend: IndexedDB,
        name: `litechat_vfs_${vfsKey}`, // Use the target key
      };

      console.log("[VfsStore] Configuring ZenFS with:", vfsConf);
      // Use configureSingle to mount the specific backend
      await configureSingle(vfsConf);

      // --- Post-configuration Check ---
      // Verify that the vfsKey hasn't changed *again* while configureSingle was running
      if (get().vfsKey !== vfsKey) {
        console.warn(
          `[VfsStore] VFS key changed during initialization (now ${get().vfsKey}), aborting setup for ${vfsKey}.`,
        );
        // Reset loading state, but don't set ready/error for the *old* key
        set({ isVfsLoading: false });
        // Another initialization might be triggered by the key change effect
        return;
      }
      // --- End Post-configuration Check ---

      console.log(
        `[VfsStore] ZenFS configured successfully for key "${vfsKey}", updating state.`,
      );
      set({
        fs: fs, // Set the configured fs instance
        configuredVfsKey: vfsKey, // Mark this key as configured
        isVfsReady: true, // Mark as ready
        isVfsLoading: false, // Done loading
        vfsError: null, // Clear any previous error
      });
      toast.success(`Filesystem "${vfsKey}" ready.`);
    } catch (error) {
      console.error(
        `[VfsStore] Failed to initialize VFS for key "${vfsKey}":`,
        error,
      );
      // Check if the key changed during the failed attempt
      if (get().vfsKey !== vfsKey) {
        console.warn(
          `[VfsStore] VFS key changed during failed initialization (now ${get().vfsKey}). Error for ${vfsKey} suppressed.`,
        );
        set({ isVfsLoading: false }); // Still need to reset loading state
      } else {
        // Key didn't change, report the error for the intended key
        const errorMsg = `Failed to initialize filesystem "${vfsKey}": ${error instanceof Error ? error.message : String(error)}`;
        set({
          isVfsLoading: false,
          isVfsReady: false,
          vfsError: errorMsg,
          configuredVfsKey: null, // Ensure configured key is cleared on error
          fs: null, // Ensure fs instance is cleared on error
        });
        toast.error(errorMsg);
      }
    }
  },

  // --- VFS Operation Actions ---
  // These wrap the actual operations, adding readiness checks
  listFiles: async (path) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] listFiles called when VFS not ready.");
      return [];
    }
    try {
      return await VfsOps.listFilesOp(path);
    } catch (error) {
      // Error is toasted within VfsOps
      return []; // Return empty on error
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
      // Error is toasted within VfsOps
      throw error; // Re-throw
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
      // Error is toasted within VfsOps
      throw error; // Re-throw
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
      // Remove deleted path (and children) from selection
      set((state) => ({
        selectedVfsPaths: state.selectedVfsPaths.filter(
          (p) => p !== path && !(recursive && p.startsWith(path + "/")),
        ),
      }));
    } catch (error) {
      // Error is toasted within VfsOps
      throw error; // Re-throw
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
      // Error is toasted within VfsOps
      throw error; // Re-throw
    }
  },
  downloadFile: async (path, filename) => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] downloadFile called when VFS not ready.");
      return; // Don't throw, just notify
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
      // Error handled by VfsOps
      throw error; // Re-throw
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
      // Error handled by VfsOps
      throw error; // Re-throw
    }
  },
  downloadAllAsZip: async (filename, rootPath = "/") => {
    if (!get().isVfsReady || !get().fs) {
      toast.error("Filesystem not ready.");
      console.error("[VFS Store] downloadAllAsZip called when VFS not ready.");
      return; // Don't throw, just notify
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
      // Error handled by VfsOps
      throw error; // Re-throw
    }
  },
}));
