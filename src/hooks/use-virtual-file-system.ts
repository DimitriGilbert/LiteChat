// src/hooks/use-virtual-file-system.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { configureSingle, fs as zenfs_fs } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
// Removed JSZip import as it's now in vfs-operations
import type { FileSystemEntry, SidebarItemType } from "@/lib/types";
import * as VfsOps from "@/lib/vfs-operations"; // Import the operations module

interface UseVirtualFileSystemProps {
  itemId: string | null;
  itemType: SidebarItemType | null;
  isEnabled: boolean;
  vfsKey: string | null;
}

interface UseVirtualFileSystemReturn {
  isReady: boolean;
  isLoading: boolean;
  isOperationLoading: boolean;
  error: string | null;
  configuredVfsKey: string | null;
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string, rootPath?: string) => Promise<void>; // Added rootPath
  rename: (oldPath: string, newPath: string) => Promise<void>;
  vfsKey: string | null;
}

// Path utilities are now in vfs-operations.ts

export function useVirtualFileSystem({
  isEnabled,
  vfsKey,
}: UseVirtualFileSystemProps): UseVirtualFileSystemReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isMountedRef = useRef(false);
  const configuredVfsKeyRef = useRef<string | null>(null);
  const configuringForVfsKeyRef = useRef<string | null>(null);

  // --- Configuration Effect (Remains the same) ---
  useEffect(() => {
    isMountedRef.current = true;

    const configureNewFs = async (key: string) => {
      if (!isMountedRef.current) return;

      console.log(
        `[VFS Hook] Configuring global fs for VFS key: ${key} using configureSingle`,
      );
      configuringForVfsKeyRef.current = key;

      setIsLoading(true);
      setIsOperationLoading(false);
      setError(null);
      setIsReady(false);

      try {
        const vfsConf = {
          backend: IndexedDB,
          name: `litechat_vfs_${key}`,
        };
        await configureSingle(vfsConf);

        if (
          isMountedRef.current &&
          configuringForVfsKeyRef.current === key &&
          vfsKey === key
        ) {
          configuredVfsKeyRef.current = key;
          setIsReady(true);
          setError(null);
          console.log(
            `[VFS Hook] Global fs configured successfully for ${key}. Hook is ready.`,
          );
        } else {
          console.log(
            `[VFS Hook] Configuration for ${key} finished, but hook state changed (mounted: ${isMountedRef.current}, target: ${vfsKey}, configuredFor: ${configuringForVfsKeyRef.current}). State not updated for ready.`,
          );
          if (vfsKey !== key) {
            setIsReady(false);
            configuredVfsKeyRef.current = null;
          }
        }
      } catch (err) {
        console.error(`[VFS Hook] Configuration failed for ${key}:`, err);
        if (isMountedRef.current && vfsKey === key) {
          const errorMsg = `Failed to initialize filesystem: ${err instanceof Error ? err.message : String(err)}`;
          setError(errorMsg);
          setIsReady(false);
          configuredVfsKeyRef.current = null;
        }
      } finally {
        if (configuringForVfsKeyRef.current === key) {
          setIsLoading(false);
          configuringForVfsKeyRef.current = null;
        }
      }
    };

    if (vfsKey && isEnabled) {
      if (vfsKey !== configuredVfsKeyRef.current) {
        configureNewFs(vfsKey);
      } else {
        if (!isReady) setIsReady(true);
        if (isLoading) setIsLoading(false);
        if (error !== null) setError(null);
      }
    } else {
      if (isReady) setIsReady(false);
      if (configuredVfsKeyRef.current !== null) {
        configuredVfsKeyRef.current = null;
        console.log(
          "[VFS Hook] Cleared configured FS key and readiness due to disable/unselect.",
        );
      }
      if (isLoading) setIsLoading(false);
      if (isOperationLoading) setIsOperationLoading(false);
      if (error !== null) setError(null);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [vfsKey, isEnabled, isReady, isLoading, isOperationLoading, error]);

  // --- Readiness Check (Remains the same) ---
  const checkReadyInternal = useCallback(() => {
    if (!isReady || configuredVfsKeyRef.current !== vfsKey) {
      const message =
        "Filesystem is not ready or not configured for the current VFS key.";
      console.error(
        `[VFS Hook] Operation prevented: ${message} (isReady: ${isReady}, configuredVfsKey: ${configuredVfsKeyRef.current}, expectedVfsKey: ${vfsKey})`,
      );
      throw new Error(message);
    }
    return zenfs_fs;
  }, [isReady, vfsKey]);

  // --- API Wrappers ---
  // These wrappers check readiness and then call the corresponding operation function.

  const listFiles = useCallback(
    async (path: string): Promise<FileSystemEntry[]> => {
      try {
        const fs = checkReadyInternal();
        return await VfsOps.listFilesOp(fs, path);
      } catch (err) {
        // checkReadyInternal throws and toasts, listFilesOp handles its own errors/toasts
        // Return empty array as a fallback if readiness check fails or listFilesOp re-throws
        return [];
      }
    },
    [checkReadyInternal],
  );

  const readFile = useCallback(
    async (path: string): Promise<Uint8Array> => {
      try {
        const fs = checkReadyInternal();
        return await VfsOps.readFileOp(fs, path);
      } catch (err) {
        // checkReadyInternal throws and toasts, readFileOp handles its own errors/toasts
        // Re-throw the error to signal failure to the caller
        throw err;
      }
    },
    [checkReadyInternal],
  );

  const writeFile = useCallback(
    async (path: string, data: Uint8Array | string): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        // Pass the state setter for loading management
        await VfsOps.writeFileOp(fs, setIsOperationLoading, path, data);
      } catch (err) {
        // checkReadyInternal throws and toasts, writeFileOp handles its own errors/toasts
        // No need to re-throw, failure is indicated by toast and loading state change
      }
    },
    [checkReadyInternal],
  );

  const deleteItem = useCallback(
    async (path: string, recursive: boolean = false): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        await VfsOps.deleteItemOp(fs, setIsOperationLoading, path, recursive);
      } catch (err) {
        // checkReadyInternal throws and toasts, deleteItemOp handles its own errors/toasts
      }
    },
    [checkReadyInternal],
  );

  const createDirectory = useCallback(
    async (path: string): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        await VfsOps.createDirectoryOp(fs, setIsOperationLoading, path);
      } catch (err) {
        // checkReadyInternal throws and toasts, createDirectoryOp handles its own errors/toasts
      }
    },
    [checkReadyInternal],
  );

  const downloadFile = useCallback(
    async (path: string, filename?: string): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        await VfsOps.downloadFileOp(fs, path, filename);
      } catch (err) {
        // checkReadyInternal throws and toasts, downloadFileOp handles its own errors/toasts
      }
    },
    [checkReadyInternal],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], targetPath: string): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        await VfsOps.uploadFilesOp(
          fs,
          setIsOperationLoading,
          files,
          targetPath,
        );
      } catch (err) {
        // checkReadyInternal throws and toasts, uploadFilesOp handles its own errors/toasts
      }
    },
    [checkReadyInternal],
  );

  const uploadAndExtractZip = useCallback(
    async (file: File, targetPath: string): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        await VfsOps.uploadAndExtractZipOp(
          fs,
          setIsOperationLoading,
          file,
          targetPath,
        );
      } catch (err) {
        // checkReadyInternal throws and toasts, uploadAndExtractZipOp handles its own errors/toasts
      }
    },
    [checkReadyInternal],
  );

  const downloadAllAsZip = useCallback(
    async (filename?: string, rootPath: string = "/"): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        await VfsOps.downloadAllAsZipOp(
          fs,
          setIsOperationLoading,
          filename,
          rootPath,
        );
      } catch (err) {
        // checkReadyInternal throws and toasts, downloadAllAsZipOp handles its own errors/toasts
      }
    },
    [checkReadyInternal],
  );

  const rename = useCallback(
    async (oldPath: string, newPath: string): Promise<void> => {
      try {
        const fs = checkReadyInternal();
        await VfsOps.renameOp(fs, setIsOperationLoading, oldPath, newPath);
      } catch (err) {
        // checkReadyInternal throws and toasts, renameOp handles its own errors/toasts
      }
    },
    [checkReadyInternal],
  );

  // --- Return Value ---
  return {
    isReady: isReady,
    isLoading: isLoading,
    isOperationLoading: isOperationLoading,
    error: error,
    configuredVfsKey: configuredVfsKeyRef.current,
    // Expose the wrapper functions
    listFiles,
    readFile,
    writeFile,
    deleteItem,
    createDirectory,
    downloadFile,
    uploadFiles,
    uploadAndExtractZip,
    downloadAllAsZip,
    rename,
    vfsKey: vfsKey,
  };
}
