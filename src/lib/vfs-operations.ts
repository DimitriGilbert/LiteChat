// src/lib/vfs-operations.ts
// Import promise-based functions directly
import {
  mkdir,
  readdir,
  stat,
  readFile,
  writeFile,
  rm,
  unlink,
  rename,
} from "@zenfs/core/promises";
// Import Stats type from @zenfs/core
import { type Stats } from "@zenfs/core";
import JSZip from "jszip";
import { toast } from "sonner";
import type { FileSystemEntry } from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";

// --- Path Utilities (Remain the same) ---

const normalizePath = (path: string): string => {
  let p = path.replace(/\/+/g, "/");
  if (!p.startsWith("/")) {
    p = "/" + p;
  }
  if (p !== "/" && p.endsWith("/")) {
    p = p.slice(0, -1);
  }
  return p;
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

const basename = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return "";
  return normalized.substring(normalized.lastIndexOf("/") + 1);
};

// --- Operation Implementations ---
// Removed fsInstance parameter, using imported promise functions

const createDirectoryRecursive = async (path: string): Promise<void> => {
  const normalized = normalizePath(path);
  if (normalized === "/") return;

  try {
    // Use imported mkdir with options object
    await mkdir(normalized, { recursive: true });
  } catch (err: unknown) {
    if (err instanceof Error && (err as any).code === "EEXIST") {
      console.warn(
        `[VFS Op] Directory already exists or created concurrently: ${normalized}`,
      );
      return;
    }
    console.error(`[VFS Op] Failed to create directory ${normalized}:`, err);
    toast.error(
      `Error creating directory "${basename(normalized)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

export const listFilesOp = async (path: string): Promise<FileSystemEntry[]> => {
  const normalized = normalizePath(path);
  try {
    // Use imported readdir
    const entries = await readdir(normalized);
    const statsPromises = entries.map(
      async (name: string): Promise<FileSystemEntry | null> => {
        const fullPath = joinPath(normalized, name);
        try {
          // Use imported stat
          const fileStat: Stats = await stat(fullPath);
          return {
            name,
            path: fullPath,
            isDirectory: fileStat.isDirectory(),
            size: fileStat.size,
            lastModified: fileStat.mtime,
          };
        } catch (statErr: unknown) {
          console.error(`[VFS Op] Failed to stat ${fullPath}:`, statErr);
          return null;
        }
      },
    );
    const stats = await Promise.all(statsPromises);
    // Add type guard for s
    return stats.filter((s): s is FileSystemEntry => s !== null);
  } catch (err: unknown) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      console.warn(`[VFS Op] Directory not found for listing: ${normalized}`);
      return [];
    }
    console.error(`[VFS Op] Failed to list directory ${normalized}:`, err);
    toast.error(
      `Error listing files: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

export const readFileOp = async (path: string): Promise<Uint8Array> => {
  const normalizedPath = normalizePath(path);
  try {
    // Use imported readFile
    const data = await readFile(normalizedPath);
    modEvents.emit(ModEvent.VFS_FILE_READ, { path: normalizedPath });
    // readFile from promises API should return Buffer, which is Uint8Array compatible
    return data;
  } catch (err: unknown) {
    console.error(`[VFS Op] Failed to read file ${normalizedPath}:`, err);
    toast.error(
      `Error reading file "${basename(normalizedPath)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

export const writeFileOp = async (
  setIsLoading: (loading: boolean) => void,
  path: string,
  data: Uint8Array | string,
): Promise<void> => {
  const normalized = normalizePath(path);
  const parentDir = dirname(normalized);
  setIsLoading(true);
  try {
    if (parentDir !== "/") {
      // Call helper which uses imported mkdir
      await createDirectoryRecursive(parentDir);
    }
    // Use imported writeFile
    await writeFile(normalized, data);
    modEvents.emit(ModEvent.VFS_FILE_WRITTEN, { path: normalized });
  } catch (err: unknown) {
    if (
      !(
        err instanceof Error && err.message.includes("Error creating directory")
      )
    ) {
      console.error(`[VFS Op] Failed to write file ${normalized}:`, err);
      toast.error(
        `Error writing file "${basename(normalized)}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    throw err;
  } finally {
    setIsLoading(false);
  }
};

export const deleteItemOp = async (
  setIsLoading: (loading: boolean) => void,
  path: string,
  recursive: boolean = false,
): Promise<void> => {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    toast.error("Cannot delete the root directory.");
    throw new Error("Cannot delete the root directory.");
  }
  setIsLoading(true);
  try {
    // Use imported stat
    const fileStat = await stat(normalized);
    if (fileStat.isDirectory()) {
      // Use imported rm with options object
      await rm(normalized, { recursive });
      // Emit event - Payload needs to match VfsFileOpPayload definition
      // Temporarily removing 'isDirectory' until definition is known
      modEvents.emit(ModEvent.VFS_FILE_DELETED, { path: normalized });
    } else {
      // Use imported unlink
      await unlink(normalized);
      // Emit event - Payload needs to match VfsFileOpPayload definition
      // Temporarily removing 'isDirectory' until definition is known
      modEvents.emit(ModEvent.VFS_FILE_DELETED, { path: normalized });
    }
    toast.success(`"${basename(normalized)}" deleted.`);
  } catch (err: unknown) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      console.warn(`[VFS Op] Item not found for deletion: ${normalized}`);
      setIsLoading(false);
      return;
    }
    console.error(`[VFS Op] Failed to delete ${normalized}:`, err);
    toast.error(
      `Error deleting "${basename(normalized)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  } finally {
    setIsLoading(false);
  }
};

export const createDirectoryOp = async (
  setIsLoading: (loading: boolean) => void,
  path: string,
): Promise<void> => {
  setIsLoading(true);
  try {
    // Call helper which uses imported mkdir
    await createDirectoryRecursive(path);
  } catch (err: unknown) {
    throw err;
  } finally {
    setIsLoading(false);
  }
};

export const downloadFileOp = async (
  path: string,
  filename?: string,
): Promise<void> => {
  try {
    // Calls helper which uses imported readFile
    const data = await readFileOp(path);
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const normalized = normalizePath(path);
    link.download = filename || basename(normalized);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err: unknown) {
    console.error(`[VFS Op] Failed to initiate download for ${path}:`, err);
    if (!(err instanceof Error && err.message.includes("Error reading file"))) {
      toast.error(
        `Download failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
};

export const uploadFilesOp = async (
  setIsLoading: (loading: boolean) => void,
  files: FileList | File[],
  targetPath: string,
): Promise<void> => {
  const normalizedTargetPath = normalizePath(targetPath);
  setIsLoading(true);
  let successCount = 0;
  let errorCount = 0;
  const fileArray = Array.from(files);

  try {
    // Calls helper which uses imported mkdir
    await createDirectoryRecursive(normalizedTargetPath);

    for (const file of fileArray) {
      const filePath = joinPath(normalizedTargetPath, file.name);
      try {
        const buffer = await file.arrayBuffer();
        // Use imported writeFile
        await writeFile(filePath, new Uint8Array(buffer));
        modEvents.emit(ModEvent.VFS_FILE_WRITTEN, { path: filePath });
        successCount++;
      } catch (err: unknown) {
        errorCount++;
        console.error(`[VFS Op] Failed to upload ${file.name}:`, err);
        toast.error(
          `Error uploading file "${file.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err: unknown) {
    errorCount = fileArray.length;
    console.error(
      `[VFS Op] Failed to prepare target directory ${normalizedTargetPath} for upload:`,
      err,
    );
  } finally {
    setIsLoading(false);
    if (errorCount > 0 && successCount > 0) {
      toast.warning(
        `Upload complete with issues. ${successCount} succeeded, ${errorCount} failed.`,
      );
    } else if (errorCount === 0 && successCount > 0) {
      toast.success(
        `Successfully uploaded ${successCount} file(s) to ${normalizedTargetPath === "/" ? "root" : basename(normalizedTargetPath)}.`,
      );
    } else if (errorCount > 0 && successCount === 0) {
      toast.error(`Upload failed. Could not upload any files.`);
    }
  }
};

export const uploadAndExtractZipOp = async (
  setIsLoading: (loading: boolean) => void,
  file: File,
  targetPath: string,
): Promise<void> => {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    toast.error("Please select a valid ZIP file.");
    return;
  }

  setIsLoading(true);
  const normalizedTargetPath = normalizePath(targetPath);
  let zip: JSZip;

  try {
    // Calls helper which uses imported mkdir
    await createDirectoryRecursive(normalizedTargetPath);

    zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);

    const results = await Promise.allSettled(
      entries.map(async (zipEntry) => {
        const fullTargetPath = joinPath(normalizedTargetPath, zipEntry.name);
        if (zipEntry.dir) {
          try {
            // Use imported mkdir with options object
            await mkdir(fullTargetPath, { recursive: true });
          } catch (err: unknown) {
            if (!(err instanceof Error && (err as any).code === "EEXIST")) {
              console.error(
                `[VFS Op] Failed to create directory during ZIP extraction ${fullTargetPath}:`,
                err,
              );
              throw err;
            }
          }
        } else {
          try {
            const content = await zipEntry.async("uint8array");
            const parentDir = dirname(fullTargetPath);
            if (parentDir !== normalizedTargetPath) {
              try {
                // Use imported mkdir with options object
                await mkdir(parentDir, { recursive: true });
              } catch (mkdirErr: unknown) {
                if (
                  !(
                    mkdirErr instanceof Error &&
                    (mkdirErr as any).code === "EEXIST"
                  )
                ) {
                  console.error(
                    `[VFS Op] Failed to create parent directory ${parentDir} during ZIP extraction:`,
                    mkdirErr,
                  );
                  throw mkdirErr;
                }
              }
            }
            // Use imported writeFile
            await writeFile(fullTargetPath, content);
            modEvents.emit(ModEvent.VFS_FILE_WRITTEN, {
              path: fullTargetPath,
            });
          } catch (err: unknown) {
            console.error(
              `[VFS Op] Failed to process ZIP entry ${zipEntry.name}:`,
              err,
            );
            throw err;
          }
        }
        return { name: zipEntry.name, isDir: zipEntry.dir };
      }),
    );

    let successFileCount = 0;
    let successDirCount = 0;
    let failedCount = 0;

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        if (result.value.isDir) {
          successDirCount++;
        } else {
          successFileCount++;
        }
      } else if (result.status === "rejected") {
        failedCount++;
        console.error("[VFS Op] ZIP Extraction item failed:", result.reason);
      }
    });

    if (failedCount > 0) {
      toast.warning(
        `Finished extracting "${file.name}". ${successFileCount + successDirCount} items succeeded, ${failedCount} failed.`,
      );
    } else {
      toast.success(
        `Successfully extracted ${successFileCount} files and ${successDirCount} folders from "${file.name}" to ${normalizedTargetPath === "/" ? "root" : basename(normalizedTargetPath)}.`,
      );
    }
  } catch (err: unknown) {
    if (
      !(
        err instanceof Error && err.message.includes("Error creating directory")
      )
    ) {
      console.error(`[VFS Op] Failed to extract zip ${file.name}:`, err);
      toast.error(
        `ZIP extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } finally {
    setIsLoading(false);
  }
};

export const downloadAllAsZipOp = async (
  setIsLoading: (loading: boolean) => void,
  filename?: string,
  rootPath: string = "/",
): Promise<void> => {
  setIsLoading(true);
  const zip = new JSZip();
  const normalizedRoot = normalizePath(rootPath);
  const rootDirName = basename(normalizedRoot) || "root";

  try {
    try {
      // Use imported stat
      const rootStat = await stat(normalizedRoot);
      if (!rootStat.isDirectory()) {
        toast.error(`Cannot export: "${rootDirName}" is not a directory.`);
        setIsLoading(false);
        return;
      }
    } catch (statErr: unknown) {
      if (statErr instanceof Error && (statErr as any).code === "ENOENT") {
        toast.error(`Cannot export: Path "${rootDirName}" not found.`);
      } else {
        toast.error(
          `Cannot export: Error accessing path "${rootDirName}". ${statErr instanceof Error ? statErr.message : String(statErr)}`,
        );
      }
      setIsLoading(false);
      return;
    }

    const addFolderToZip = async (folderPath: string, zipFolder: JSZip) => {
      // Calls helper which uses imported readdir/stat
      const entries = await listFilesOp(folderPath);

      for (const entry of entries) {
        if (entry.isDirectory) {
          const subFolder = zipFolder.folder(entry.name);
          if (subFolder) {
            await addFolderToZip(entry.path, subFolder);
          } else {
            throw new Error(`Failed to create subfolder ${entry.name} in zip.`);
          }
        } else {
          // Calls helper which uses imported readFile
          const content = await readFileOp(entry.path);
          zipFolder.file(entry.name, content);
        }
      }
    };

    await addFolderToZip(normalizedRoot, zip);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    const defaultFilename = `vfs_${rootDirName}_export.zip`;
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`"${rootDirName}" exported as ${link.download}.`);
  } catch (err: unknown) {
    console.error("[VFS Op] Failed to download all as zip:", err);
    if (
      !(
        err instanceof Error &&
        (err.message.includes("listing files") ||
          err.message.includes("reading file") ||
          err.message.includes("Cannot export"))
      )
    ) {
      toast.error(
        `ZIP export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } finally {
    setIsLoading(false);
  }
};

export const renameOp = async (
  setIsLoading: (loading: boolean) => void,
  oldPath: string,
  newPath: string,
): Promise<void> => {
  const normalizedOld = normalizePath(oldPath);
  const normalizedNew = normalizePath(newPath);

  if (normalizedOld === "/" || normalizedNew === "/") {
    toast.error("Cannot rename the root directory.");
    throw new Error("Cannot rename the root directory.");
  }
  if (normalizedOld === normalizedNew) {
    return;
  }

  setIsLoading(true);
  try {
    const parentDir = dirname(normalizedNew);
    if (parentDir !== "/") {
      // Calls helper which uses imported mkdir
      await createDirectoryRecursive(parentDir);
    }
    // Use imported rename
    await rename(normalizedOld, normalizedNew);
    toast.success(
      `Renamed "${basename(normalizedOld)}" to "${basename(normalizedNew)}"`,
    );
  } catch (err: unknown) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      if (err.message.includes("Error creating directory")) {
        // Handled by createDirectoryRecursive
      } else {
        toast.error(
          `Rename failed: Original item "${basename(normalizedOld)}" not found.`,
        );
      }
    } else if (err instanceof Error && (err as any).code === "EEXIST") {
      toast.error(
        `Rename failed: An item named "${basename(normalizedNew)}" already exists.`,
      );
    } else if (
      !(
        err instanceof Error && err.message.includes("Error creating directory")
      )
    ) {
      toast.error(
        `Rename failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    console.error(
      `[VFS Op] Failed to rename ${normalizedOld} to ${normalizedNew}:`,
      err,
    );
    throw err;
  } finally {
    setIsLoading(false);
  }
};
