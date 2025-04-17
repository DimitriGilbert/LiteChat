// src/lib/vfs-operations.ts
import { fs as zenfs_fs } from "@zenfs/core"; // Import the fs object itself
import JSZip from "jszip";
import { toast } from "sonner";
import type { FileSystemEntry } from "@/lib/types";
import { modEvents, ModEvent } from "@/mods/events";

// Define the type based on the imported fs object
type ZenFsType = typeof zenfs_fs;

// --- Path Utilities (Remain the same) ---

const normalizePath = (path: string): string => {
  // Ensure leading slash, remove trailing slash (unless root), collapse multiple slashes
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
  if (lastSlash === -1) return "/"; // Should not happen with normalizePath
  if (lastSlash === 0) return "/"; // Parent of /file is /
  return normalized.substring(0, lastSlash);
};

const basename = (path: string): string => {
  const normalized = normalizePath(path);
  if (normalized === "/") return ""; // No basename for root
  return normalized.substring(normalized.lastIndexOf("/") + 1);
};

// --- Operation Implementations ---

// Helper to create directories internally
const createDirectoryRecursive = async (
  fs: ZenFsType, // Use the inferred type
  path: string,
): Promise<void> => {
  const normalized = normalizePath(path);
  if (normalized === "/") return;

  try {
    // Access .promises here
    await fs.promises.mkdir(normalized, { recursive: true });
  } catch (err) {
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

export const listFilesOp = async (
  fs: ZenFsType, // Use the inferred type
  path: string,
): Promise<FileSystemEntry[]> => {
  const normalized = normalizePath(path);
  try {
    // Access .promises here
    const entries = await fs.promises.readdir(normalized);
    const stats = await Promise.all(
      entries.map(async (name) => {
        const fullPath = joinPath(normalized, name);
        try {
          // Access .promises here
          const stat = await fs.promises.stat(fullPath);
          return {
            name,
            path: fullPath,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            lastModified: stat.mtime,
          };
        } catch (statErr) {
          console.error(`[VFS Op] Failed to stat ${fullPath}:`, statErr);
          return null;
        }
      }),
    );
    return stats.filter((s): s is FileSystemEntry => s !== null);
  } catch (err) {
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

export const readFileOp = async (
  fs: ZenFsType, // Use the inferred type
  path: string,
): Promise<Uint8Array> => {
  const normalizedPath = normalizePath(path);
  try {
    // Access .promises here
    const data = await fs.promises.readFile(normalizedPath);
    modEvents.emit(ModEvent.VFS_FILE_READ, { path: normalizedPath });
    return data;
  } catch (err) {
    console.error(`[VFS Op] Failed to read file ${normalizedPath}:`, err);
    toast.error(
      `Error reading file "${basename(normalizedPath)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

export const writeFileOp = async (
  fs: ZenFsType, // Use the inferred type
  setIsLoading: (loading: boolean) => void,
  path: string,
  data: Uint8Array | string,
): Promise<void> => {
  const normalized = normalizePath(path);
  const parentDir = dirname(normalized);
  setIsLoading(true);
  try {
    if (parentDir !== "/") {
      await createDirectoryRecursive(fs, parentDir); // Pass fs
    }
    // Access .promises here
    await fs.promises.writeFile(normalized, data);
    modEvents.emit(ModEvent.VFS_FILE_WRITTEN, { path: normalized });
  } catch (err) {
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
  fs: ZenFsType, // Use the inferred type
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
    // Access .promises here
    const stat = await fs.promises.stat(normalized);
    if (stat.isDirectory()) {
      // Access .promises here
      await fs.promises.rm(normalized, { recursive });
    } else {
      // Access .promises here
      await fs.promises.unlink(normalized);
      modEvents.emit(ModEvent.VFS_FILE_DELETED, { path: normalized });
    }
    toast.success(`"${basename(normalized)}" deleted.`);
  } catch (err) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      console.warn(`[VFS Op] Item not found for deletion: ${normalized}`);
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
  fs: ZenFsType, // Use the inferred type
  setIsLoading: (loading: boolean) => void,
  path: string,
): Promise<void> => {
  setIsLoading(true);
  try {
    await createDirectoryRecursive(fs, path); // Pass fs
  } catch (err) {
    throw err;
  } finally {
    setIsLoading(false);
  }
};

export const downloadFileOp = async (
  fs: ZenFsType, // Use the inferred type
  path: string,
  filename?: string,
): Promise<void> => {
  try {
    const data = await readFileOp(fs, path); // Pass fs
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
  } catch (err) {
    console.error(`[VFS Op] Failed to initiate download for ${path}:`, err);
  }
};

export const uploadFilesOp = async (
  fs: ZenFsType, // Use the inferred type
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
    await createDirectoryRecursive(fs, normalizedTargetPath); // Pass fs

    for (const file of fileArray) {
      const filePath = joinPath(normalizedTargetPath, file.name);
      try {
        const buffer = await file.arrayBuffer();
        // Access .promises here
        await fs.promises.writeFile(filePath, new Uint8Array(buffer));
        modEvents.emit(ModEvent.VFS_FILE_WRITTEN, { path: filePath });
        successCount++;
      } catch (err) {
        errorCount++;
        console.error(`[VFS Op] Failed to upload ${file.name}:`, err);
        toast.error(
          `Error uploading file "${file.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
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
    }
  }
};

export const uploadAndExtractZipOp = async (
  fs: ZenFsType, // Use the inferred type
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
    await createDirectoryRecursive(fs, normalizedTargetPath); // Pass fs

    zip = await JSZip.loadAsync(file);
    const fileWritePromises: Promise<void>[] = [];
    let fileCount = 0;
    let dirCount = 0;

    zip.forEach((_, zipEntry) => {
      const fullTargetPath = joinPath(normalizedTargetPath, zipEntry.name);
      if (zipEntry.dir) {
        dirCount++;
        fileWritePromises.push(
          // Access .promises here
          new Promise((resolve, reject) => {
            fs.promises
              .mkdir(fullTargetPath, { recursive: true })
              .then(() => resolve())
              .catch((err) => {
                if (!(err instanceof Error && (err as any).code === "EEXIST")) {
                  console.error(
                    `[VFS Op] Failed to create directory during ZIP extraction ${fullTargetPath}:`,
                    err,
                  );
                  reject(err);
                }
              });
          }),
        );
      } else {
        fileCount++;
        const writePromise = zipEntry
          .async("uint8array")
          .then((content) => {
            const parentDir = dirname(fullTargetPath);
            return (
              (
                parentDir === normalizedTargetPath
                  ? Promise.resolve()
                  : // Access .promises here
                    fs.promises.mkdir(parentDir, { recursive: true })
              )
                .catch((mkdirErr) => {
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
                })
                // Access .promises here
                .then(() => fs.promises.writeFile(fullTargetPath, content))
                .then(() => {
                  modEvents.emit(ModEvent.VFS_FILE_WRITTEN, {
                    path: fullTargetPath,
                  });
                })
            );
          })
          .catch((err) => {
            console.error(
              `[VFS Op] Failed to process ZIP entry ${zipEntry.name}:`,
              err,
            );
            throw err;
          });
        fileWritePromises.push(writePromise);
      }
    });

    const results = await Promise.allSettled(fileWritePromises);
    const failedCount = results.filter((r) => r.status === "rejected").length;

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error("[VFS Op] ZIP Extraction item failed:", result.reason);
        toast.error(
          `Error during ZIP extraction: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
      }
    });

    if (failedCount > 0) {
      toast.warning(
        `Finished extracting "${file.name}". ${fileCount + dirCount - failedCount} items succeeded, ${failedCount} failed.`,
      );
    } else {
      toast.success(
        `Successfully extracted ${fileCount} files and ${dirCount} folders from "${file.name}" to ${normalizedTargetPath === "/" ? "root" : basename(normalizedTargetPath)}.`,
      );
    }
  } catch (err) {
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
  fs: ZenFsType, // Use the inferred type
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
      // Access .promises here
      const rootStat = await fs.promises.stat(normalizedRoot);
      if (!rootStat.isDirectory()) {
        toast.error(`Cannot export: "${rootDirName}" is not a directory.`);
        setIsLoading(false);
        return;
      }
    } catch (statErr) {
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

    const addFolderToZip = async (
      folderPath: string,
      zipFolder: JSZip | null,
    ) => {
      const currentZipLevel = zipFolder || zip;
      const entries = await listFilesOp(fs, folderPath); // Pass fs

      for (const entry of entries) {
        if (entry.isDirectory) {
          const subFolder = currentZipLevel.folder(entry.name);
          if (subFolder) {
            await addFolderToZip(entry.path, subFolder);
          } else {
            throw new Error(`Failed to create subfolder ${entry.name} in zip.`);
          }
        } else {
          const content = await readFileOp(fs, entry.path); // Pass fs
          currentZipLevel.file(entry.name, content);
        }
      }
    };

    await addFolderToZip(normalizedRoot, null);

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
  } catch (err) {
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
  fs: ZenFsType, // Use the inferred type
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
      await createDirectoryRecursive(fs, parentDir); // Pass fs
    }
    // Access .promises here
    await fs.promises.rename(normalizedOld, normalizedNew);
    toast.success(
      `Renamed "${basename(normalizedOld)}" to "${basename(normalizedNew)}"`,
    );
  } catch (err) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      toast.error(
        `Rename failed: Original item "${basename(normalizedOld)}" not found.`,
      );
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
