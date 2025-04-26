// src/lib/litechat/vfs-operations.ts
import { fs, configureSingle, type Stats } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import { toast } from "sonner";
// Corrected import path for types, use FileSystemEntry from vfs.ts
import type { FileSystemEntry } from "@/types/litechat/vfs"; // Correct path
// Corrected import path for events
import { modEvents, ModEvent } from "@/mods/events"; // Correct path for mod events
import JSZip from "jszip";
// Corrected import path for utils
import {
  normalizePath,
  joinPath,
  dirname,
  basename,
} from "./file-manager-utils"; // Correct path relative to this file

// --- Helper Functions ---
const createDirectoryRecursive = async (path: string): Promise<void> => {
  const normalized = normalizePath(path);
  if (normalized === "/") return;
  try {
    await fs.promises.mkdir(normalized, { recursive: true });
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

// --- Exported VFS Operation Functions ---
export const initializeFsOp = async (
  vfsKey: string,
): Promise<typeof fs | null> => {
  try {
    const vfsConf = {
      backend: IndexedDB,
      name: `litechat_vfs_${vfsKey}`,
    };
    console.log("[VFS Op] Configuring ZenFS with:", vfsConf);
    await configureSingle(vfsConf);
    console.log(`[VFS Op] ZenFS configured successfully for key "${vfsKey}".`);
    return fs;
  } catch (error) {
    console.error(
      `[VFS Op] Failed to initialize VFS for key "${vfsKey}":`,
      error,
    );
    toast.error(
      `Failed to initialize filesystem "${vfsKey}": ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
};

export const listFilesOp = async (path: string): Promise<FileSystemEntry[]> => {
  const normalized = normalizePath(path);
  try {
    const entries = await fs.promises.readdir(normalized);
    const statsPromises = entries.map(
      async (name: string): Promise<FileSystemEntry | null> => {
        const fullPath = joinPath(normalized, name);
        try {
          const fileStat: Stats = await fs.promises.stat(fullPath);
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
    const data = await fs.promises.readFile(normalizedPath);
    modEvents.emit(ModEvent.VFS_FILE_READ, { path: normalizedPath });
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
  path: string,
  data: Uint8Array | string,
): Promise<void> => {
  const normalized = normalizePath(path);
  const parentDir = dirname(normalized);
  try {
    if (parentDir !== "/") {
      await createDirectoryRecursive(parentDir);
    }
    await fs.promises.writeFile(normalized, data);
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
  }
};

export const deleteItemOp = async (
  path: string,
  recursive: boolean = false,
): Promise<void> => {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    toast.error("Cannot delete the root directory.");
    throw new Error("Cannot delete the root directory.");
  }
  try {
    const fileStat = await fs.promises.stat(normalized);
    if (fileStat.isDirectory()) {
      await fs.promises.rm(normalized, { recursive });
      modEvents.emit(ModEvent.VFS_FILE_DELETED, { path: normalized });
    } else {
      await fs.promises.unlink(normalized);
      modEvents.emit(ModEvent.VFS_FILE_DELETED, { path: normalized });
    }
    toast.success(`"${basename(normalized)}" deleted.`);
  } catch (err: unknown) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      console.warn(`[VFS Op] Item not found for deletion: ${normalized}`);
      return;
    }
    console.error(`[VFS Op] Failed to delete ${normalized}:`, err);
    toast.error(
      `Error deleting "${basename(normalized)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

export const createDirectoryOp = async (path: string): Promise<void> => {
  try {
    await createDirectoryRecursive(path);
  } catch (err: unknown) {
    throw err;
  }
};

export const downloadFileOp = async (
  path: string,
  filename?: string,
): Promise<void> => {
  try {
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
  files: FileList | File[],
  targetPath: string,
): Promise<void> => {
  const normalizedTargetPath = normalizePath(targetPath);
  let successCount = 0;
  let errorCount = 0;
  const fileArray = Array.from(files);

  try {
    await createDirectoryRecursive(normalizedTargetPath);

    for (const file of fileArray) {
      const filePath = joinPath(normalizedTargetPath, file.name);
      try {
        const buffer = await file.arrayBuffer();
        await writeFileOp(filePath, new Uint8Array(buffer));
        successCount++;
      } catch (err: unknown) {
        errorCount++;
        console.error(`[VFS Op] Failed to upload ${file.name}:`, err);
      }
    }
  } catch (err: unknown) {
    errorCount = fileArray.length;
    console.error(
      `[VFS Op] Failed to prepare target directory ${normalizedTargetPath} for upload:`,
      err,
    );
  } finally {
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
  file: File,
  targetPath: string,
): Promise<void> => {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    toast.error("Please select a valid ZIP file.");
    return;
  }

  const normalizedTargetPath = normalizePath(targetPath);
  let zip: JSZip;

  try {
    await createDirectoryRecursive(normalizedTargetPath);

    zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);

    const results = await Promise.allSettled(
      entries.map(async (zipEntry) => {
        const fullTargetPath = joinPath(normalizedTargetPath, zipEntry.name);
        if (zipEntry.dir) {
          await createDirectoryRecursive(fullTargetPath);
        } else {
          const content = await zipEntry.async("uint8array");
          await writeFileOp(fullTargetPath, content);
        }
        return { name: zipEntry.name, isDir: zipEntry.dir };
      }),
    );

    let successFileCount = 0;
    let successDirCount = 0;
    let failedCount = 0;

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        if (result.value.isDir) successDirCount++;
        else successFileCount++;
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
  }
};

export const downloadAllAsZipOp = async (
  filename?: string,
  rootPath: string = "/",
): Promise<void> => {
  const zip = new JSZip();
  const normalizedRoot = normalizePath(rootPath);
  const rootDirName = basename(normalizedRoot) || "root";

  try {
    try {
      const rootStat = await fs.promises.stat(normalizedRoot);
      if (!rootStat.isDirectory()) {
        toast.error(`Cannot export: "${rootDirName}" is not a directory.`);
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
      return;
    }

    const addFolderToZip = async (folderPath: string, zipFolder: JSZip) => {
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
        (err.message.includes("Error listing files") ||
          err.message.includes("Error reading file") ||
          err.message.includes("Cannot export"))
      )
    ) {
      toast.error(
        `ZIP export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
};

export const renameOp = async (
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

  try {
    const parentDir = dirname(normalizedNew);
    if (parentDir !== "/") {
      await createDirectoryRecursive(parentDir);
    }
    await fs.promises.rename(normalizedOld, normalizedNew);
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
  }
};
