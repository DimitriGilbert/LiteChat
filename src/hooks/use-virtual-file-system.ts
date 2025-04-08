// src/hooks/use-virtual-file-system.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { configureSingle, fs as zenfs_fs } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import JSZip from "jszip";
import type { FileSystem } from "@zenfs/core";
import type { FileSystemEntry, SidebarItemType } from "@/lib/types";
import { toast } from "sonner";

interface UseVirtualFileSystemProps {
  itemId: string | null;
  itemType: SidebarItemType | null;
  isEnabled: boolean;
}

interface UseVirtualFileSystemReturn {
  isReady: boolean;
  isLoading: boolean; // Configuration loading
  isOperationLoading: boolean; // Loading for specific FS operations
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
  const [isLoading, setIsLoading] = useState(false); // For configuration
  const [isOperationLoading, setIsOperationLoading] = useState(false); // For FS actions
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
      setIsLoading(true); // Config loading starts
      setIsOperationLoading(false); // Reset operation loading
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
            `[VFS] Configuration for ${id} finished, but hook is no longer mounted, or target itemId changed (current: ${itemId}). State not updated.`,
          );
          if (itemId !== id) {
            setIsReady(false);
            configuredFsIdRef.current = null;
          }
        }
      } catch (err) {
        console.error(`[VFS] Configuration failed for ${id}:`, err);
        if (isMountedRef.current && itemId === id) {
          setError(
            `Failed to configure filesystem: ${err instanceof Error ? err.message : String(err)}`,
          );
          setIsReady(false);
          configuredFsIdRef.current = null;
        }
      } finally {
        if (isMountedRef.current && itemId === id) {
          setIsLoading(false); // Config loading ends
        }
      }
    };

    if (itemId && isEnabled) {
      if (itemId !== configuredFsIdRef.current) {
        configureNewFs(itemId);
      } else {
        if (!isReady) setIsReady(true);
        if (isLoading) setIsLoading(false);
        if (error) setError(null);
        // Don't reset isOperationLoading here, an operation might be in progress
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
      if (isOperationLoading) setIsOperationLoading(false); // Reset operation loading if disabled
      if (error) setError(null);
    }

    return () => {
      isMountedRef.current = false;
      console.log("[VFS] Cleanup effect triggered.");
      configuringForIdRef.current = null;
    };
  }, [itemId, isEnabled]);

  const checkReady = useCallback(() => {
    if (!isReady || configuredFsIdRef.current !== itemId) {
      const message =
        "Filesystem is not ready or not configured for the current item.";
      toast.error(message);
      console.error(
        `[VFS] Operation prevented: ${message} (isReady: ${isReady}, configuredId: ${configuredFsIdRef.current}, expectedId: ${itemId})`,
      );
      throw new Error(message);
    }
    return zenfs_fs;
  }, [isReady, itemId]);

  const listFiles = useCallback(
    async (path: string): Promise<FileSystemEntry[]> => {
      const fs = checkReady();
      const normalized = normalizePath(path);
      // No operation loading needed for read-only list
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
              return null;
            }
          }),
        );
        return stats.filter((s): s is FileSystemEntry => s !== null);
      } catch (err) {
        if (err instanceof Error && (err as any).code === "ENOENT") {
          console.warn(`[VFS] Directory not found for listing: ${normalized}`);
          return [];
        }
        console.error(`[VFS] Failed to list directory ${normalized}:`, err);
        toast.error(
          `Error listing files: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }
    },
    [checkReady],
  );

  const readFile = useCallback(
    async (path: string): Promise<Uint8Array> => {
      const fs = checkReady();
      // No operation loading needed for read
      return fs.promises.readFile(normalizePath(path));
    },
    [checkReady],
  );

  const writeFile = useCallback(
    async (path: string, data: Uint8Array | string): Promise<void> => {
      const fs = checkReady();
      const normalized = normalizePath(path);
      const parentDir = dirname(normalized);
      setIsOperationLoading(true); // Write operation starts
      try {
        await fs.promises.mkdir(parentDir, { recursive: true });
        await fs.promises.writeFile(normalized, data);
      } catch (err) {
        console.error(`[VFS] Failed to write file ${normalized}:`, err);
        toast.error(
          `Error writing file: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      } finally {
        setIsOperationLoading(false); // Write operation ends
      }
    },
    [checkReady],
  );

  const deleteItem = useCallback(
    async (path: string, recursive: boolean = false): Promise<void> => {
      const fs = checkReady();
      const normalized = normalizePath(path);
      setIsOperationLoading(true); // Delete operation starts
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
        setIsOperationLoading(false); // Delete operation ends
      }
    },
    [checkReady],
  );

  const createDirectory = useCallback(
    async (path: string): Promise<void> => {
      const fs = checkReady();
      const normalized = normalizePath(path);
      setIsOperationLoading(true); // Create dir operation starts
      try {
        await fs.promises.mkdir(normalized, { recursive: true });
      } catch (err) {
        console.error(`[VFS] Failed to create directory ${normalized}:`, err);
        toast.error(
          `Error creating directory: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      } finally {
        setIsOperationLoading(false); // Create dir operation ends
      }
    },
    [checkReady],
  );

  const downloadFile = useCallback(
    async (path: string, filename?: string): Promise<void> => {
      // No specific operation loading needed for download trigger
      try {
        const data = await readFile(normalizePath(path)); // Calls checkReady internally
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
    [readFile],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], targetPath: string): Promise<void> => {
      const normalizedTargetPath = normalizePath(targetPath);
      setIsOperationLoading(true); // Upload operation starts
      let successCount = 0;
      let errorCount = 0;
      try {
        // checkReady is called implicitly by createDirectory/writeFile
        await createDirectory(normalizedTargetPath); // This will set/unset loading briefly
        const fileArray = Array.from(files);
        for (const file of fileArray) {
          const filePath = joinPath(normalizedTargetPath, file.name);
          try {
            const buffer = await file.arrayBuffer();
            // Use internal writeFile which handles its own loading state
            await writeFile(filePath, new Uint8Array(buffer));
            successCount++;
          } catch (err) {
            errorCount++;
            console.error(`[VFS] Failed to upload ${file.name}:`, err);
            // Don't re-throw here, try next file
          }
        }
        if (errorCount > 0) {
          toast.error(
            `Finished uploading. ${successCount} files succeeded, ${errorCount} failed.`,
          );
        } else {
          toast.success(
            `Successfully uploaded ${successCount} file(s) to ${normalizedTargetPath}.`,
          );
        }
      } catch (err) {
        console.error("[VFS] General upload error:", err);
        if (
          !(
            err instanceof Error &&
            err.message.startsWith("Filesystem is not ready")
          )
        ) {
          toast.error(
            `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        // Re-throw general errors (like checkReady failing in createDirectory)
        throw err;
      } finally {
        setIsOperationLoading(false); // Upload operation ends
      }
    },
    [createDirectory, writeFile],
  );

  const uploadAndExtractZip = useCallback(
    async (file: File, targetPath: string): Promise<void> => {
      if (!file.name.toLowerCase().endsWith(".zip")) {
        toast.error("Please select a valid ZIP file.");
        return;
      }
      setIsOperationLoading(true); // Extraction operation starts
      const normalizedTargetPath = normalizePath(targetPath);
      try {
        // checkReady is called implicitly by createDirectory/writeFile
        await createDirectory(normalizedTargetPath); // Sets/unsets loading briefly

        const zip = await JSZip.loadAsync(file);
        const fileWritePromises: Promise<void>[] = [];

        zip.forEach((relativePath, zipEntry) => {
          const fullTargetPath = joinPath(normalizedTargetPath, zipEntry.name);
          if (zipEntry.dir) {
            // Use internal createDirectory which handles its own loading state
            fileWritePromises.push(createDirectory(fullTargetPath));
          } else {
            const writePromise = zipEntry
              .async("uint8array")
              .then((content) => {
                // Use internal writeFile which handles its own loading state
                return writeFile(fullTargetPath, content);
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
            err.message.startsWith("Filesystem is not ready")
          )
        ) {
          toast.error(
            `ZIP extraction failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        throw err;
      } finally {
        setIsOperationLoading(false); // Extraction operation ends
      }
    },
    [createDirectory, writeFile],
  );

  const downloadAllAsZip = useCallback(
    async (filename?: string): Promise<void> => {
      setIsOperationLoading(true); // ZIP export operation starts
      const zip = new JSZip();
      try {
        // checkReady is called implicitly by listFiles/readFile
        const addFolderToZip = async (folderPath: string, zipFolder: JSZip) => {
          const entries = await listFiles(folderPath); // Read-only, no loading set
          for (const entry of entries) {
            if (entry.isDirectory) {
              const subFolder = zipFolder.folder(entry.name);
              if (subFolder) {
                await addFolderToZip(entry.path, subFolder);
              }
            } else {
              const content = await readFile(entry.path); // Read-only, no loading set
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
        setIsOperationLoading(false); // ZIP export operation ends
      }
    },
    [listFiles, readFile],
  );

  const rename = useCallback(
    async (oldPath: string, newPath: string): Promise<void> => {
      const fs = checkReady();
      const normalizedOld = normalizePath(oldPath);
      const normalizedNew = normalizePath(newPath);
      setIsOperationLoading(true); // Rename operation starts
      try {
        const parentDir = dirname(normalizedNew);
        if (parentDir !== "/") {
          // Use internal createDirectory which handles its own loading state
          await createDirectory(parentDir);
        }
        await fs.promises.rename(normalizedOld, normalizedNew);
      } catch (err) {
        console.error(
          `[VFS] Failed to rename ${normalizedOld} to ${normalizedNew}:`,
          err,
        );
        toast.error(
          `Rename failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      } finally {
        setIsOperationLoading(false); // Rename operation ends
      }
    },
    [checkReady, createDirectory],
  );

  return {
    isReady,
    isLoading, // Configuration loading
    isOperationLoading, // Operation loading
    error,
    configuredItemId: configuredFsIdRef.current,
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
  };
}
