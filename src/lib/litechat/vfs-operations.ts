// src/lib/litechat/vfs-operations.ts
import { fs, configureSingle, type Stats } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import { toast } from "sonner";
import type { FileSystemEntry } from "@/types/litechat/vfs";
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import JSZip from "jszip";
import {
  normalizePath,
  joinPath,
  dirname,
  basename,
} from "./file-manager-utils";

// Import Git operations from the separate module
import {
  isGitRepoOp as _isGitRepoOp,
  gitCloneOp as _gitCloneOp,
  gitInitOp as _gitInitOp,
  gitCommitOp as _gitCommitOp,
  gitPullOp as _gitPullOp,
  gitPushOp as _gitPushOp,
  gitStatusOp as _gitStatusOp,
  gitCurrentBranchOp as _gitCurrentBranchOp,
  gitListBranchesOp as _gitListBranchesOp,
  gitListRemotesOp as _gitListRemotesOp,
} from "./vfs-git-operations";

// --- Helper Functions (Non-Git) ---
const createDirectoryRecursive = async (path: string): Promise<void> => {
  const normalized = normalizePath(path);
  if (normalized === "/") return;
  try {
    await fs.promises.mkdir(normalized, { recursive: true });
  } catch (err: unknown) {
    // Ignore EEXIST error, as directory might be created concurrently
    if (err instanceof Error && (err as any).code === "EEXIST") {
      console.warn(
        `[VFS Op] Directory already exists or created concurrently: ${normalized}`,
      );
      return;
    }
    // Log and re-throw other errors
    console.error(`[VFS Op] Failed to create directory ${normalized}:`, err);
    toast.error(
      `Error creating directory "${basename(normalized)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

// --- Exported VFS Operation Functions (Non-Git) ---

/**
 * Initializes the ZenFS filesystem with IndexedDB backend.
 * @param vfsKey A unique key to identify the filesystem instance.
 * @returns The configured fs instance or null on failure.
 */
export const initializeFsOp = async (
  vfsKey: string,
): Promise<typeof fs | null> => {
  try {
    const vfsConf = {
      backend: IndexedDB,
      name: `litechat_vfs_${vfsKey}`, // Use key in DB name
    };
    // Configure the filesystem. This might throw if already configured differently.
    await configureSingle(vfsConf);
    return fs; // Return the globally configured fs instance
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

/**
 * Lists files and directories within a given path.
 * @param path The directory path to list.
 * @returns An array of FileSystemEntry objects.
 * @throws Throws an error if listing fails.
 */
export const listFilesOp = async (path: string): Promise<FileSystemEntry[]> => {
  const normalized = normalizePath(path);
  try {
    // Ensure the directory exists before listing
    try {
      await fs.promises.stat(normalized);
    } catch (statErr: any) {
      if (statErr.code === "ENOENT") {
        // If directory doesn't exist, create it and return empty list
        console.warn(
          `[VFS Op] Directory not found for listing, attempting creation: ${normalized}`,
        );
        await createDirectoryRecursive(normalized);
        return []; // Return empty as it was just created
      }
      // Rethrow other stat errors
      throw statErr;
    }

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
            lastModified: fileStat.mtime, // Use mtime (modification time)
          };
        } catch (statErr: unknown) {
          // Log error but filter out the entry if stat fails
          console.error(`[VFS Op] Failed to stat ${fullPath}:`, statErr);
          return null;
        }
      },
    );
    const stats = await Promise.all(statsPromises);
    // Filter out null results where stat failed
    const filteredStats = stats.filter((s): s is FileSystemEntry => s !== null);
    return filteredStats;
  } catch (err: unknown) {
    console.error(`[VFS Op] Failed to list directory ${normalized}:`, err);
    toast.error(
      `Error listing files: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err; // Re-throw error for caller handling
  }
};

/**
 * Reads the content of a file.
 * @param path The path to the file.
 * @returns The file content as a Uint8Array.
 * @throws Throws an error if reading fails.
 */
export const readFileOp = async (path: string): Promise<Uint8Array> => {
  const normalizedPath = normalizePath(path);
  try {
    const data = await fs.promises.readFile(normalizedPath);
    emitter.emit(ModEvent.VFS_FILE_READ, { path: normalizedPath });
    return data;
  } catch (err: unknown) {
    console.error(`[VFS Op] Failed to read file ${normalizedPath}:`, err);
    toast.error(
      `Error reading file "${basename(normalizedPath)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

/**
 * Writes data to a file, creating parent directories if necessary.
 * @param path The path to the file.
 * @param data The data to write (Uint8Array or string).
 * @throws Throws an error if writing fails.
 */
export const writeFileOp = async (
  path: string,
  data: Uint8Array | string,
): Promise<void> => {
  const normalized = normalizePath(path);
  const parentDir = dirname(normalized);
  try {
    // Ensure parent directory exists
    if (parentDir !== "/") {
      await createDirectoryRecursive(parentDir);
    }
    // Write the file
    await fs.promises.writeFile(normalized, data);
    emitter.emit(ModEvent.VFS_FILE_WRITTEN, { path: normalized });
  } catch (err: unknown) {
    // Avoid double-toasting if error came from createDirectoryRecursive
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
    throw err; // Re-throw error
  }
};

/**
 * Deletes a file or directory.
 * @param path The path to the item to delete.
 * @param recursive If true, delete directories recursively (default: false).
 * @throws Throws an error if deletion fails (except for ENOENT).
 */
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
      // Use rm for directories
      await fs.promises.rm(normalized, { recursive });
      emitter.emit(ModEvent.VFS_FILE_DELETED, { path: normalized });
    } else {
      // Use unlink for files
      await fs.promises.unlink(normalized);
      emitter.emit(ModEvent.VFS_FILE_DELETED, { path: normalized });
    }
    toast.success(`"${basename(normalized)}" deleted.`);
  } catch (err: unknown) {
    // Ignore "Not Found" errors, maybe already deleted
    if (err instanceof Error && (err as any).code === "ENOENT") {
      console.warn(`[VFS Op] Item not found for deletion: ${normalized}`);
      return; // Don't throw, just return
    }
    // Handle other errors
    console.error(`[VFS Op] Failed to delete ${normalized}:`, err);
    toast.error(
      `Error deleting "${basename(normalized)}": ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err; // Re-throw other errors
  }
};

/**
 * Creates a directory, including parent directories if necessary.
 * @param path The directory path to create.
 * @throws Throws an error if creation fails.
 */
export const createDirectoryOp = async (path: string): Promise<void> => {
  await createDirectoryRecursive(path); // Uses helper with error handling
};

/**
 * Initiates a browser download for a file in the VFS.
 * @param path The path to the file in the VFS.
 * @param filename Optional filename for the download. Defaults to the file's basename.
 */
export const downloadFileOp = async (
  path: string,
  filename?: string,
): Promise<void> => {
  try {
    const data = await readFileOp(path); // Use existing op with error handling
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const normalized = normalizePath(path);
    link.download = filename || basename(normalized); // Use basename helper
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    // Success toast is implicit via readFileOp if it doesn't throw
  } catch (err: unknown) {
    // Error handling is done within readFileOp, just log context here
    console.error(`[VFS Op] Failed to initiate download for ${path}:`, err);
    // Avoid double toast if readFileOp already showed one
    if (!(err instanceof Error && err.message.includes("Error reading file"))) {
      toast.error(
        `Download failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
};

/**
 * Uploads multiple files to the specified target directory.
 * @param files A FileList or array of File objects.
 * @param targetPath The destination directory path in the VFS.
 */
export const uploadFilesOp = async (
  files: FileList | File[],
  targetPath: string,
): Promise<void> => {
  const normalizedTargetPath = normalizePath(targetPath);
  let successCount = 0;
  let errorCount = 0;
  const fileArray = Array.from(files); // Convert FileList to array if necessary

  try {
    // Ensure target directory exists
    await createDirectoryRecursive(normalizedTargetPath);

    // Process each file
    for (const file of fileArray) {
      const filePath = joinPath(normalizedTargetPath, file.name);
      try {
        const buffer = await file.arrayBuffer();
        await writeFileOp(filePath, new Uint8Array(buffer)); // Use existing op
        successCount++;
      } catch (err: unknown) {
        // writeFileOp handles its own toast, just count errors here
        errorCount++;
        console.error(`[VFS Op] Failed to upload ${file.name}:`, err);
      }
    }
  } catch (err: unknown) {
    // Error creating target directory (handled by createDirectoryRecursive)
    // Set error count to total files as none could be uploaded
    errorCount = fileArray.length;
    console.error(
      `[VFS Op] Failed to prepare target directory ${normalizedTargetPath} for upload:`,
      err,
    );
    // Toast handled by createDirectoryRecursive
  } finally {
    // Provide summary toast based on counts
    if (errorCount > 0 && successCount > 0) {
      toast.warning(
        `Upload complete with issues. ${successCount} succeeded, ${errorCount} failed.`,
      );
    } else if (errorCount === 0 && successCount > 0) {
      toast.success(
        `Successfully uploaded ${successCount} file(s) to ${normalizedTargetPath === "/" ? "root" : basename(normalizedTargetPath)}.`,
      );
    } else if (errorCount > 0 && successCount === 0) {
      // Error toast was likely already shown by createDirectoryRecursive or writeFileOp
      // toast.error(`Upload failed. Could not upload any files.`);
    }
  }
};

/**
 * Uploads a ZIP file and extracts its contents into the target directory.
 * @param file The ZIP file object.
 * @param targetPath The destination directory path in the VFS.
 */
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
    // Ensure target directory exists
    await createDirectoryRecursive(normalizedTargetPath);

    // Load the ZIP file
    zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);

    // Process each entry in the ZIP
    const results = await Promise.allSettled(
      entries.map(async (zipEntry) => {
        const fullTargetPath = joinPath(normalizedTargetPath, zipEntry.name);
        if (zipEntry.dir) {
          // Create directory entry
          await createDirectoryRecursive(fullTargetPath);
        } else {
          // Write file entry
          const content = await zipEntry.async("uint8array");
          await writeFileOp(fullTargetPath, content); // Use existing op
        }
        return { name: zipEntry.name, isDir: zipEntry.dir };
      }),
    );

    // Tally results for summary toast
    let successFileCount = 0;
    let successDirCount = 0;
    let failedCount = 0;

    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        if (result.value.isDir) successDirCount++;
        else successFileCount++;
      } else if (result.status === "rejected") {
        failedCount++;
        // Log individual item failures
        console.error("[VFS Op] ZIP Extraction item failed:", result.reason);
        // Individual file write errors are toasted by writeFileOp
      }
    });

    // Show summary toast
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
    // Catch errors during initial directory creation or ZIP loading
    // Avoid double-toasting if error came from createDirectoryRecursive
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
    // Do not re-throw here, allow operation to finish
  }
};

/**
 * Creates a ZIP archive of a directory's contents and initiates download.
 * @param filename Optional filename for the downloaded ZIP file.
 * @param rootPath The directory path in the VFS to archive (defaults to root '/').
 */
export const downloadAllAsZipOp = async (
  filename?: string,
  rootPath: string = "/",
): Promise<void> => {
  const zip = new JSZip();
  const normalizedRoot = normalizePath(rootPath);
  const rootDirName = basename(normalizedRoot) || "root"; // Use 'root' if path is '/'

  try {
    // Verify the root path exists and is a directory
    try {
      const rootStat = await fs.promises.stat(normalizedRoot);
      if (!rootStat.isDirectory()) {
        toast.error(`Cannot export: "${rootDirName}" is not a directory.`);
        return;
      }
    } catch (statErr: unknown) {
      // Handle specific "Not Found" error
      if (statErr instanceof Error && (statErr as any).code === "ENOENT") {
        toast.error(`Cannot export: Path "${rootDirName}" not found.`);
      } else {
        // Handle other stat errors
        toast.error(
          `Cannot export: Error accessing path "${rootDirName}". ${statErr instanceof Error ? statErr.message : String(statErr)}`,
        );
      }
      return; // Stop if root path is invalid
    }

    // Recursive function to add folder contents to the ZIP
    const addFolderToZip = async (folderPath: string, zipFolder: JSZip) => {
      const entries = await listFilesOp(folderPath); // Use existing op

      for (const entry of entries) {
        if (entry.isDirectory) {
          // Skip .git directory
          if (entry.name === ".git") continue;
          // Create a new folder within the current zip folder
          const subFolder = zipFolder.folder(entry.name);
          if (subFolder) {
            // Recursively add contents of the subfolder
            await addFolderToZip(entry.path, subFolder);
          } else {
            // This should ideally not happen with JSZip
            throw new Error(`Failed to create subfolder ${entry.name} in zip.`);
          }
        } else {
          // Read file content and add it to the zip folder
          const content = await readFileOp(entry.path); // Use existing op
          zipFolder.file(entry.name, content);
        }
      }
    };

    // Start the recursive zipping process from the root path
    await addFolderToZip(normalizedRoot, zip);

    // Generate the ZIP blob
    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Trigger the download
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    // Create a default filename if none provided
    const defaultFilename = `vfs_${rootDirName}_export.zip`;
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`"${rootDirName}" exported as ${link.download}.`);
  } catch (err: unknown) {
    // Catch errors during listing, reading, or zipping
    console.error("[VFS Op] Failed to download all as zip:", err);
    // Avoid double-toasting if error came from listFilesOp or readFileOp
    if (
      !(
        (
          err instanceof Error &&
          (err.message.includes("Error listing files") ||
            err.message.includes("Error reading file") ||
            err.message.includes("Cannot export"))
        ) // Check for specific export errors
      )
    ) {
      toast.error(
        `ZIP export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
};

/**
 * Renames a file or directory.
 * @param oldPath The current path of the item.
 * @param newPath The desired new path of the item.
 * @throws Throws an error if renaming fails.
 */
export const renameOp = async (
  oldPath: string,
  newPath: string,
): Promise<void> => {
  const normalizedOld = normalizePath(oldPath);
  const normalizedNew = normalizePath(newPath);

  // Prevent renaming root or renaming to the same path
  if (normalizedOld === "/" || normalizedNew === "/") {
    toast.error("Cannot rename the root directory.");
    throw new Error("Cannot rename the root directory.");
  }
  if (normalizedOld === normalizedNew) {
    return; // No operation needed
  }

  try {
    // Ensure the parent directory of the new path exists
    const parentDir = dirname(normalizedNew);
    if (parentDir !== "/") {
      await createDirectoryRecursive(parentDir);
    }

    // Attempt the rename operation
    await fs.promises.rename(normalizedOld, normalizedNew);
    toast.success(
      `Renamed "${basename(normalizedOld)}" to "${basename(normalizedNew)}"`,
    );
  } catch (err: unknown) {
    // Handle specific errors for better feedback
    if (err instanceof Error && (err as any).code === "ENOENT") {
      // Check if the error is from createDirectoryRecursive (already handled)
      if (err.message.includes("Error creating directory")) {
        // Do nothing, error already toasted
      } else {
        // Original item not found
        toast.error(
          `Rename failed: Original item "${basename(normalizedOld)}" not found.`,
        );
      }
    } else if (err instanceof Error && (err as any).code === "EEXIST") {
      // Target name already exists
      toast.error(
        `Rename failed: An item named "${basename(normalizedNew)}" already exists.`,
      );
    } else if (
      // Avoid double-toasting if error came from createDirectoryRecursive
      !(
        err instanceof Error && err.message.includes("Error creating directory")
      )
    ) {
      // Handle other generic errors
      toast.error(
        `Rename failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // Log the error regardless
    console.error(
      `[VFS Op] Failed to rename ${normalizedOld} to ${normalizedNew}:`,
      err,
    );
    throw err; // Re-throw error
  }
};

// --- Re-export Git operations ---
export {
  _isGitRepoOp as isGitRepoOp,
  _gitCloneOp as gitCloneOp,
  _gitInitOp as gitInitOp,
  _gitCommitOp as gitCommitOp,
  _gitPullOp as gitPullOp,
  _gitPushOp as gitPushOp,
  _gitStatusOp as gitStatusOp,
  _gitCurrentBranchOp as gitCurrentBranchOp,
  _gitListBranchesOp as gitListBranchesOp,
  _gitListRemotesOp as gitListRemotesOp,
};

// Export the fs instance for direct use if needed (e.g., in stores)
export const VFS = fs;
