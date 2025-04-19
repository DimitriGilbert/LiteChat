// src/hooks/use-virtual-file-system.ts
import { useState, useEffect, useCallback, useRef } from "react";
// Import fs directly for type usage and configureSingle
import { configureSingle, fs } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import type {
  FileSystemEntry,
  SidebarItemType,
  VfsContextObject, // Type definition updated in types.ts
} from "@/lib/types";
import * as VfsOps from "@/lib/vfs-operations";

interface UseVirtualFileSystemProps {
  itemId: string | null;
  itemType: SidebarItemType | null;
  isEnabled: boolean;
  vfsKey: string | null;
}

export function useVirtualFileSystem({
  isEnabled,
  vfsKey,
}: UseVirtualFileSystemProps): VfsContextObject {
  const [isLoading, setIsLoading] = useState(false);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isMountedRef = useRef(false);
  const configuredVfsKeyRef = useRef<string | null>(null);
  const configuringForVfsKeyRef = useRef<string | null>(null);
  // Store the global fs instance reference
  const fsInstanceRef = useRef<typeof fs | null>(null);

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
      fsInstanceRef.current = null;

      try {
        const vfsConf = {
          backend: IndexedDB,
          name: `litechat_vfs_${key}`,
        };
        await configureSingle(vfsConf);
        // Assign the configured global fs object to the ref.
        fsInstanceRef.current = fs;

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
            fsInstanceRef.current = null;
          }
        }
      } catch (err) {
        console.error(`[VFS Hook] Configuration failed for ${key}:`, err);
        if (isMountedRef.current && vfsKey === key) {
          const errorMsg = `Failed to initialize filesystem: ${err instanceof Error ? err.message : String(err)}`;
          setError(errorMsg);
          setIsReady(false);
          configuredVfsKeyRef.current = null;
          fsInstanceRef.current = null;
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
        if (!fsInstanceRef.current && isReady) {
          fsInstanceRef.current = fs;
        }
      }
    } else {
      if (isReady) setIsReady(false);
      if (configuredVfsKeyRef.current !== null) {
        configuredVfsKeyRef.current = null;
        fsInstanceRef.current = null;
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
  }, [vfsKey, isEnabled]);

  // Renamed: Checks readiness and throws if not ready. Doesn't return fs.
  const ensureReadyOrThrow = useCallback((): void => {
    if (
      !isReady ||
      configuredVfsKeyRef.current !== vfsKey ||
      !fsInstanceRef.current // Check if fs instance exists (post-configuration)
    ) {
      const message =
        "Filesystem is not ready or not configured for the current VFS key.";
      console.error(
        `[VFS Hook] Operation prevented: ${message} (isReady: ${isReady}, configuredVfsKey: ${configuredVfsKeyRef.current}, expectedVfsKey: ${vfsKey}, fsInstance: ${!!fsInstanceRef.current})`,
      );
      throw new Error(message);
    }
    // If checks pass, execution continues
  }, [isReady, vfsKey]); // fsInstanceRef is stable

  // --- Operations using ensureReadyOrThrow ---
  // Call ensureReadyOrThrow first, then the standalone VfsOps function

  const listFiles = useCallback(
    async (path: string): Promise<FileSystemEntry[]> => {
      ensureReadyOrThrow(); // Check readiness first
      try {
        // VfsOps functions now use imported promise functions
        return await VfsOps.listFilesOp(path);
      } catch (err) {
        // Error logging/toast handled within VfsOps
        return []; // Return empty array on error
      }
    },
    [ensureReadyOrThrow],
  );

  const readFile = useCallback(
    async (path: string): Promise<Uint8Array> => {
      ensureReadyOrThrow();
      // Let VfsOps handle errors
      return await VfsOps.readFileOp(path);
    },
    [ensureReadyOrThrow],
  );

  const writeFile = useCallback(
    async (path: string, data: Uint8Array | string): Promise<void> => {
      ensureReadyOrThrow();
      // Pass setIsLoading for operation loading state
      await VfsOps.writeFileOp(setIsOperationLoading, path, data);
    },
    [ensureReadyOrThrow],
  );

  const deleteItem = useCallback(
    async (path: string, recursive: boolean = false): Promise<void> => {
      ensureReadyOrThrow();
      await VfsOps.deleteItemOp(setIsOperationLoading, path, recursive);
    },
    [ensureReadyOrThrow],
  );

  const createDirectory = useCallback(
    async (path: string): Promise<void> => {
      ensureReadyOrThrow();
      await VfsOps.createDirectoryOp(setIsOperationLoading, path);
    },
    [ensureReadyOrThrow],
  );

  const downloadFile = useCallback(
    async (path: string, filename?: string): Promise<void> => {
      ensureReadyOrThrow();
      await VfsOps.downloadFileOp(path, filename);
    },
    [ensureReadyOrThrow],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], targetPath: string): Promise<void> => {
      ensureReadyOrThrow();
      await VfsOps.uploadFilesOp(setIsOperationLoading, files, targetPath);
    },
    [ensureReadyOrThrow],
  );

  const uploadAndExtractZip = useCallback(
    async (file: File, targetPath: string): Promise<void> => {
      ensureReadyOrThrow();
      await VfsOps.uploadAndExtractZipOp(
        setIsOperationLoading,
        file,
        targetPath,
      );
    },
    [ensureReadyOrThrow],
  );

  const downloadAllAsZip = useCallback(
    async (filename?: string, rootPath: string = "/"): Promise<void> => {
      ensureReadyOrThrow();
      await VfsOps.downloadAllAsZipOp(
        setIsOperationLoading,
        filename,
        rootPath,
      );
    },
    [ensureReadyOrThrow],
  );

  const rename = useCallback(
    async (oldPath: string, newPath: string): Promise<void> => {
      ensureReadyOrThrow();
      await VfsOps.renameOp(setIsOperationLoading, oldPath, newPath);
    },
    [ensureReadyOrThrow],
  );

  // Return object matching VfsContextObject
  return {
    isReady: isReady,
    isLoading: isLoading,
    isOperationLoading: isOperationLoading,
    error: error,
    configuredVfsKey: configuredVfsKeyRef.current,
    // Return the reference to the global fs instance
    fs: fsInstanceRef.current,
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
