// src/hooks/use-virtual-file-system.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { configureSingle, fs as zenfs_fs } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import JSZip from "jszip";
import type { FileSystemEntry, SidebarItemType } from "@/lib/types";
import { toast } from "sonner";

interface UseVirtualFileSystemProps {
  itemId: string | null;
  itemType: SidebarItemType | null;
  isEnabled: boolean;
}

interface UseVirtualFileSystemReturn {
  isReady: boolean;
  isLoading: boolean;
  isOperationLoading: boolean;
  error: string | null;
  configuredItemId: string | null;
  listFiles: (path: string) => Promise<FileSystemEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  writeFile: (path: string, data: Uint8Array | string) => Promise<void>;
  deleteItem: (path: string, recursive?: boolean) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  downloadFile: (path: string, filename?: string) => Promise<void>;
  uploadFiles: (files: FileList | File[], targetPath: string) => Promise<void>;
  uploadAndExtractZip: (file: File, targetPath: string) => Promise<void>;
  downloadAllAsZip: (filename?: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
}

// --- Path Helpers ---
const normalizePath = (path: string): string => {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
};
const joinPath = (...segments: string[]): string => {
  return normalizePath(
    segments
      .map((s) => s.trim())
      .filter(Boolean)
      .join("/"),
  );
};
const dirname = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash === -1) return "/";
  if (lastSlash === 0) return "/";
  return normalized.substring(0, lastSlash);
};
// --- End Path Helpers ---

export function useVirtualFileSystem({
  itemId,
  isEnabled,
}: UseVirtualFileSystemProps): UseVirtualFileSystemReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isMountedRef = useRef(false);
  const configuredFsIdRef = useRef<string | null>(null);
  const configuringForIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    const configureNewFs = async (id: string) => {
      if (!isMountedRef.current) return;

      console.log(
        `[VFS] Configuring global fs for item ID: ${id} using configureSingle`,
      );
      configuringForIdRef.current = id;

      setIsLoading((prev) => (prev ? prev : true));
      setIsOperationLoading(false);
      setError(null);
      setIsReady(false);

      try {
        await configureSingle({ backend: IndexedDB });

        if (
          isMountedRef.current &&
          configuringForIdRef.current === id &&
          itemId === id
        ) {
          configuredFsIdRef.current = id;
          setIsReady(true);
          setError(null);
          console.log(
            `[VFS] Global fs configured successfully for ${id}. Hook is ready.`,
          );
        } else {
          console.log(
            `[VFS] Configuration for ${id} finished, but hook state changed (mounted: ${isMountedRef.current}, target: ${itemId}, configuredFor: ${configuringForIdRef.current}). State not updated for ready.`,
          );
          if (itemId !== id) {
            setIsReady(false);
            configuredFsIdRef.current = null;
          }
        }
      } catch (err) {
        console.error(`[VFS] Configuration failed for ${id}:`, err);
        if (isMountedRef.current && itemId === id) {
          const errorMsg = `Failed to configure filesystem: ${err instanceof Error ? err.message : String(err)}`;
          setError((prev) => (prev === errorMsg ? prev : errorMsg));
          setIsReady(false);
          configuredFsIdRef.current = null;
        }
      } finally {
        if (configuringForIdRef.current === id) {
          setIsLoading(false);
          configuringForIdRef.current = null;
        }
      }
    };

    if (itemId && isEnabled) {
      if (itemId !== configuredFsIdRef.current) {
        configureNewFs(itemId);
      } else {
        if (!isReady) setIsReady(true);
        if (isLoading) setIsLoading(false);
        if (error !== null) setError(null);
        console.log(`[VFS] Already configured for ${itemId}. State ensured.`);
      }
    } else {
      if (isReady) setIsReady(false);
      if (configuredFsIdRef.current !== null) {
        configuredFsIdRef.current = null;
        console.log(
          "[VFS] Cleared configured FS ID and readiness due to disable/unselect.",
        );
      }
      if (isLoading) setIsLoading(false);
      if (isOperationLoading) setIsOperationLoading(false);
      if (error !== null) setError(null);
    }

    return () => {
      isMountedRef.current = false;
      console.log("[VFS] Cleanup effect triggered.");
    };
  }, [itemId, isEnabled, isReady, isLoading, isOperationLoading, error]); // Added state dependencies to ensure consistency check runs

  // --- Internal implementations (original functions renamed) ---
  const checkReadyInternal = useCallback(() => {
    if (!isReady || configuredFsIdRef.current !== itemId) {
      const message =
        "Filesystem is not ready or not configured for the current item.";
      // toast.error(message); // Avoid toast in check, let caller handle
      console.error(
        `[VFS] Operation prevented: ${message} (isReady: ${isReady}, configuredId: ${configuredFsIdRef.current}, expectedId: ${itemId})`,
      );
      throw new Error(message);
    }
    return zenfs_fs;
  }, [isReady, itemId]);

  const listFilesInternal = useCallback(
    async (path: string): Promise<FileSystemEntry[]> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      try {
        const entries = await fs.promises.readdir(normalized);
        const stats = await Promise.all(
          entries.map(async (name) => {
            const fullPath = joinPath(normalized, name);
            try {
              const stat = await fs.promises.stat(fullPath);
              return {
                name,
                path: fullPath,
                isDirectory: stat.isDirectory(),
                size: stat.size,
                lastModified: stat.mtime,
              };
            } catch (statErr) {
              console.error(`[VFS] Failed to stat ${fullPath}:`, statErr);
              return null; // Skip files that fail to stat
            }
          }),
        );
        return stats.filter((s): s is FileSystemEntry => s !== null);
      } catch (err) {
        if (err instanceof Error && (err as any).code === "ENOENT") {
          console.warn(`[VFS] Directory not found for listing: ${normalized}`);
          return []; // Return empty array if dir doesn't exist
        }
        console.error(`[VFS] Failed to list directory ${normalized}:`, err);
        toast.error(
          `Error listing files: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err; // Re-throw other errors
      }
    },
    [checkReadyInternal],
  );

  const readFileInternal = useCallback(
    async (path: string): Promise<Uint8Array> => {
      const fs = checkReadyInternal();
      return fs.promises.readFile(normalizePath(path));
    },
    [checkReadyInternal],
  );

  const createDirectoryInternalImpl = useCallback(
    async (path: string): Promise<void> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      try {
        await fs.promises.mkdir(normalized, { recursive: true });
      } catch (err) {
        if (err instanceof Error && (err as any).code === "EEXIST") {
          return; // Directory already exists, not an error
        }
        console.error(`[VFS] Failed to create directory ${normalized}:`, err);
        toast.error(
          `Error creating directory: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }
    },
    [checkReadyInternal],
  );

  const writeFileInternal = useCallback(
    async (path: string, data: Uint8Array | string): Promise<void> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      const parentDir = dirname(normalized);
      setIsOperationLoading(true);
      try {
        if (parentDir !== "/") {
          await createDirectoryInternalImpl(parentDir);
        }
        await fs.promises.writeFile(normalized, data);
      } catch (err) {
        console.error(`[VFS] Failed to write file ${normalized}:`, err);
        if (!(err instanceof Error && (err as any).code === "EEXIST")) {
          toast.error(
            `Error writing file: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal, createDirectoryInternalImpl],
  );

  const deleteItemInternal = useCallback(
    async (path: string, recursive: boolean = false): Promise<void> => {
      const fs = checkReadyInternal();
      const normalized = normalizePath(path);
      setIsOperationLoading(true);
      try {
        const stat = await fs.promises.stat(normalized);
        if (stat.isDirectory()) {
          await fs.promises.rm(normalized, { recursive });
        } else {
          await fs.promises.unlink(normalized);
        }
      } catch (err) {
        console.error(`[VFS] Failed to delete ${normalized}:`, err);
        toast.error(
          `Error deleting item: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal],
  );

  const createDirectoryActual = useCallback(
    async (path: string): Promise<void> => {
      setIsOperationLoading(true);
      try {
        await createDirectoryInternalImpl(path);
      } catch (err) {
        // Error handled in internal impl
      } finally {
        setIsOperationLoading(false);
      }
    },
    [createDirectoryInternalImpl],
  );

  const downloadFileInternal = useCallback(
    async (path: string, filename?: string): Promise<void> => {
      try {
        const data = await readFileInternal(normalizePath(path));
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const normalized = normalizePath(path);
        link.download =
          filename || normalized.substring(normalized.lastIndexOf("/") + 1);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error(`[VFS] Failed to download ${path}:`, err);
        if (
          !(
            err instanceof Error &&
            err.message.startsWith("Filesystem is not ready")
          )
        ) {
          toast.error(
            `Error downloading file: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    },
    [readFileInternal],
  );

  const uploadFilesInternal = useCallback(
    async (files: FileList | File[], targetPath: string): Promise<void> => {
      const normalizedTargetPath = normalizePath(targetPath);
      setIsOperationLoading(true);
      let successCount = 0;
      let errorCount = 0;
      try {
        await createDirectoryInternalImpl(normalizedTargetPath);

        const fileArray = Array.from(files);
        for (const file of fileArray) {
          const filePath = joinPath(normalizedTargetPath, file.name);
          try {
            const buffer = await file.arrayBuffer();
            await writeFileInternal(filePath, new Uint8Array(buffer));
            successCount++;
          } catch (err) {
            errorCount++;
            console.error(`[VFS] Failed to upload ${file.name}:`, err);
          }
        }

        if (errorCount > 0) {
          toast.error(
            `Finished uploading. ${successCount} files succeeded, ${errorCount} failed.`,
          );
        } else if (successCount > 0) {
          toast.success(
            `Successfully uploaded ${successCount} file(s) to ${normalizedTargetPath}.`,
          );
        }
      } catch (err) {
        console.error("[VFS] General upload error:", err);
        if (
          !(
            err instanceof Error &&
            (err.message.startsWith("Filesystem is not ready") ||
              (err as any).code === "EEXIST")
          )
        ) {
          toast.error(
            `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        setIsOperationLoading(false);
      }
    },
    [createDirectoryInternalImpl, writeFileInternal],
  );

  const uploadAndExtractZipInternal = useCallback(
    async (file: File, targetPath: string): Promise<void> => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        toast.error("Please select a valid ZIP file.");
        return;
      }
      setIsOperationLoading(true);
      const normalizedTargetPath = normalizePath(targetPath);
      try {
        await createDirectoryInternalImpl(normalizedTargetPath);

        const zip = await JSZip.loadAsync(file);
        const fileWritePromises: Promise<void>[] = [];

        zip.forEach((relativePath, zipEntry) => {
          const fullTargetPath = joinPath(normalizedTargetPath, zipEntry.name);
          if (zipEntry.dir) {
            fileWritePromises.push(createDirectoryInternalImpl(fullTargetPath));
          } else {
            const writePromise = zipEntry
              .async("uint8array")
              .then((content) => {
                return writeFileInternal(fullTargetPath, content);
              });
            fileWritePromises.push(writePromise);
          }
        });

        await Promise.all(fileWritePromises);
        toast.success(
          `Successfully extracted "${file.name}" to ${normalizedTargetPath}.`,
        );
      } catch (err) {
        console.error(`[VFS] Failed to extract zip ${file.name}:`, err);
        if (
          !(
            err instanceof Error &&
            (err.message.startsWith("Filesystem is not ready") ||
              (err as any).code === "EEXIST")
          )
        ) {
          toast.error(
            `ZIP extraction failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [createDirectoryInternalImpl, writeFileInternal],
  );

  const downloadAllAsZipInternal = useCallback(
    async (filename?: string): Promise<void> => {
      setIsOperationLoading(true);
      const zip = new JSZip();
      try {
        checkReadyInternal();

        const addFolderToZip = async (folderPath: string, zipFolder: JSZip) => {
          const entries = await listFilesInternal(folderPath);
          for (const entry of entries) {
            if (entry.isDirectory) {
              const subFolder = zipFolder.folder(entry.name);
              if (subFolder) {
                await addFolderToZip(entry.path, subFolder);
              }
            } else {
              const content = await readFileInternal(entry.path);
              zipFolder.file(entry.name, content);
            }
          }
        };

        await addFolderToZip("/", zip);

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        const defaultFilename = `vfs_export_${configuredFsIdRef.current || "current"}.zip`;
        link.download = filename || defaultFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Filesystem exported as ZIP.");
      } catch (err) {
        console.error("[VFS] Failed to download all as zip:", err);
        if (
          !(
            err instanceof Error &&
            err.message.startsWith("Filesystem is not ready")
          )
        ) {
          toast.error(
            `ZIP export failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal, listFilesInternal, readFileInternal],
  );

  const renameInternal = useCallback(
    async (oldPath: string, newPath: string): Promise<void> => {
      const fs = checkReadyInternal();
      const normalizedOld = normalizePath(oldPath);
      const normalizedNew = normalizePath(newPath);
      setIsOperationLoading(true);
      try {
        const parentDir = dirname(normalizedNew);
        if (parentDir !== "/") {
          await createDirectoryInternalImpl(parentDir);
        }
        await fs.promises.rename(normalizedOld, normalizedNew);
      } catch (err) {
        console.error(
          `[VFS] Failed to rename ${normalizedOld} to ${normalizedNew}:`,
          err,
        );
        if (
          !(
            err instanceof Error &&
            (err.message.startsWith("Filesystem is not ready") ||
              (err as any).code === "EEXIST")
          )
        ) {
          toast.error(
            `Rename failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false);
      }
    },
    [checkReadyInternal, createDirectoryInternalImpl],
  );

  // --- Return original interface, conditionally calling dummy or internal funcs ---
  return {
    isReady: isReady,
    isLoading: isLoading,
    isOperationLoading: isOperationLoading,
    error: error,
    configuredItemId: configuredFsIdRef.current,
    listFiles: listFilesInternal,
    readFile: readFileInternal,
    writeFile: writeFileInternal,
    deleteItem: deleteItemInternal,
    createDirectory: createDirectoryActual,
    downloadFile: downloadFileInternal,
    uploadFiles: uploadFilesInternal,
    uploadAndExtractZip: uploadAndExtractZipInternal,
    downloadAllAsZip: downloadAllAsZipInternal,
    rename: renameInternal,
  };
}
