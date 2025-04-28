// src/hooks/litechat/useVfsToolsRegistration.tsx
import { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { tool } from "ai";
import { z } from "zod";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { toast } from "sonner";
import { normalizePath, basename } from "@/lib/litechat/file-manager-utils";

const MOD_ID = "core-vfs-tools";

export function useVfsToolsRegistration() {
  const { registerTool, unregisterTool } = useControlRegistryStore.getState();

  useEffect(() => {
    const unregisterFunctions: (() => void)[] = [];

    // --- vfs_list_directory ---
    const listDirectoryTool = tool({
      description:
        "Lists the files and subdirectories within a specified directory path in the Virtual File System (VFS). Use '/' for the root directory.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the directory to list (e.g., '/', '/documents', '/projectA/code').",
          ),
      }),
      execute: async ({ path }) => {
        const normalizedPath = normalizePath(path);
        console.log(
          `[VFS Tool Execute] vfs_list_directory called for path: ${normalizedPath}`,
        ); // Log entry
        // Log the state of the VFS instance *at the time of execution*
        console.log(
          `[VFS Tool Execute] VfsOps.VFS instance state:`,
          VfsOps.VFS,
        );
        if (!VfsOps.VFS) {
          const msg = "VFS is not initialized or available.";
          console.error(`[VFS Tool Execute] ${msg}`);
          toast.error(msg);
          return { status: "error", message: msg };
        }
        try {
          const entries = await VfsOps.listFilesOp(normalizedPath);
          if (entries.length === 0) {
            return { status: "success", isEmpty: true, content: [] }; // Indicate empty directory
          }
          // Return structured list of names and types
          return {
            status: "success",
            isEmpty: false,
            content: entries.map((e) => ({
              name: e.name,
              type: e.isDirectory ? "folder" : "file",
            })),
          };
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred listing directory.";
          console.error(
            `[VFS Tool Execute] Error in listFilesOp for ${normalizedPath}:`,
            error,
          );
          toast.error(`VFS List Error (${normalizedPath}): ${errorMessage}`);
          return { status: "error", message: errorMessage }; // Return error status
        }
      },
    });
    unregisterFunctions.push(
      registerTool(MOD_ID, "vfs_list_directory", listDirectoryTool),
    );

    // --- vfs_read_file ---
    const readFileTool = tool({
      description:
        "Reads the content of a specified file path from the Virtual File System (VFS). Returns the file content as a string.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the file to read (e.g., '/readme.txt', '/data/config.json').",
          ),
      }),
      execute: async ({ path }) => {
        const normalizedPath = normalizePath(path);
        console.log(
          `[VFS Tool Execute] vfs_read_file called for path: ${normalizedPath}`,
        );
        console.log(
          `[VFS Tool Execute] VfsOps.VFS instance state:`,
          VfsOps.VFS,
        );
        if (!VfsOps.VFS) {
          const msg = "VFS is not initialized or available.";
          console.error(`[VFS Tool Execute] ${msg}`);
          toast.error(msg);
          return { status: "error", message: msg };
        }
        try {
          const contentUint8Array = await VfsOps.readFileOp(normalizedPath);
          const contentString = new TextDecoder().decode(contentUint8Array);
          return { status: "success", content: contentString }; // Return content
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred reading file.";
          console.error(
            `[VFS Tool Execute] Error in readFileOp for ${normalizedPath}:`,
            error,
          );
          toast.error(`VFS Read Error (${normalizedPath}): ${errorMessage}`);
          return { status: "error", message: errorMessage }; // Return error status
        }
      },
    });
    unregisterFunctions.push(
      registerTool(MOD_ID, "vfs_read_file", readFileTool),
    );

    // --- vfs_write_file ---
    const writeFileTool = tool({
      description:
        "Writes or overwrites a file at a specified path in the Virtual File System (VFS) with the provided content.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path where the file should be written (e.g., '/notes.txt', '/output/results.json'). Parent directories will be created if they don't exist.",
          ),
        content: z.string().describe("The text content to write to the file."),
      }),
      execute: async ({ path, content }) => {
        const normalizedPath = normalizePath(path);
        console.log(
          `[VFS Tool Execute] vfs_write_file called for path: ${normalizedPath}`,
        );
        console.log(
          `[VFS Tool Execute] VfsOps.VFS instance state:`,
          VfsOps.VFS,
        );
        if (!VfsOps.VFS) {
          const msg = "VFS is not initialized or available.";
          console.error(`[VFS Tool Execute] ${msg}`);
          toast.error(msg);
          return { status: "error", message: msg };
        }
        try {
          await VfsOps.writeFileOp(normalizedPath, content);
          return { status: "success", path: normalizedPath }; // Confirm success
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred writing file.";
          console.error(
            `[VFS Tool Execute] Error in writeFileOp for ${normalizedPath}:`,
            error,
          );
          toast.error(`VFS Write Error (${normalizedPath}): ${errorMessage}`);
          return { status: "error", message: errorMessage }; // Return error status
        }
      },
    });
    unregisterFunctions.push(
      registerTool(MOD_ID, "vfs_write_file", writeFileTool),
    );

    // --- vfs_create_directory ---
    const createDirectoryTool = tool({
      description:
        "Creates a new directory at the specified path in the Virtual File System (VFS). Creates parent directories if they do not exist.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the directory to create (e.g., '/new_folder', '/data/images').",
          ),
      }),
      execute: async ({ path }) => {
        const normalizedPath = normalizePath(path);
        console.log(
          `[VFS Tool Execute] vfs_create_directory called for path: ${normalizedPath}`,
        );
        console.log(
          `[VFS Tool Execute] VfsOps.VFS instance state:`,
          VfsOps.VFS,
        );
        if (!VfsOps.VFS) {
          const msg = "VFS is not initialized or available.";
          console.error(`[VFS Tool Execute] ${msg}`);
          toast.error(msg);
          return { status: "error", message: msg };
        }
        try {
          await VfsOps.createDirectoryOp(normalizedPath);
          return { status: "success", path: normalizedPath }; // Confirm success
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred creating directory.";
          console.error(
            `[VFS Tool Execute] Error in createDirectoryOp for ${normalizedPath}:`,
            error,
          );
          toast.error(
            `VFS Create Dir Error (${normalizedPath}): ${errorMessage}`,
          );
          return { status: "error", message: errorMessage }; // Return error status
        }
      },
    });
    unregisterFunctions.push(
      registerTool(MOD_ID, "vfs_create_directory", createDirectoryTool),
    );

    // --- vfs_delete_item ---
    const deleteItemTool = tool({
      description:
        "Deletes a file or directory (and its contents recursively) at the specified path in the Virtual File System (VFS). Use with caution.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the file or directory to delete (e.g., '/old_file.txt', '/temporary_folder').",
          ),
      }),
      execute: async ({ path }) => {
        const normalizedPath = normalizePath(path);
        console.log(
          `[VFS Tool Execute] vfs_delete_item called for path: ${normalizedPath}`,
        );
        console.log(
          `[VFS Tool Execute] VfsOps.VFS instance state:`,
          VfsOps.VFS,
        );
        if (!VfsOps.VFS) {
          const msg = "VFS is not initialized or available.";
          console.error(`[VFS Tool Execute] ${msg}`);
          toast.error(msg);
          return { status: "error", message: msg };
        }
        if (normalizedPath === "/") {
          const msg = "Deleting the root directory is not allowed.";
          toast.error(msg);
          return { status: "error", message: msg };
        }
        try {
          // Always delete recursively for simplicity and safety with folders
          await VfsOps.deleteItemOp(normalizedPath, true);
          return { status: "success", path: normalizedPath }; // Confirm success
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred deleting item.";
          console.error(
            `[VFS Tool Execute] Error in deleteItemOp for ${normalizedPath}:`,
            error,
          );
          toast.error(`VFS Delete Error (${normalizedPath}): ${errorMessage}`);
          return { status: "error", message: errorMessage }; // Return error status
        }
      },
    });
    unregisterFunctions.push(
      registerTool(MOD_ID, "vfs_delete_item", deleteItemTool),
    );

    // --- vfs_rename_item ---
    const renameItemTool = tool({
      description:
        "Renames or moves a file or directory from an old path to a new path within the Virtual File System (VFS).",
      parameters: z.object({
        oldPath: z
          .string()
          .describe(
            "The current absolute path of the file or directory to rename/move.",
          ),
        newPath: z
          .string()
          .describe("The desired new absolute path for the file or directory."),
      }),
      execute: async ({ oldPath, newPath }) => {
        const normalizedOldPath = normalizePath(oldPath);
        const normalizedNewPath = normalizePath(newPath);
        console.log(
          `[VFS Tool Execute] vfs_rename_item called for ${normalizedOldPath} -> ${normalizedNewPath}`,
        );
        console.log(
          `[VFS Tool Execute] VfsOps.VFS instance state:`,
          VfsOps.VFS,
        );
        if (!VfsOps.VFS) {
          const msg = "VFS is not initialized or available.";
          console.error(`[VFS Tool Execute] ${msg}`);
          toast.error(msg);
          return { status: "error", message: msg };
        }
        if (
          normalizedOldPath === "/" ||
          normalizedNewPath === "/" ||
          normalizedOldPath === normalizedNewPath
        ) {
          const msg = "Invalid rename operation (root or same path).";
          toast.error(msg);
          return { status: "error", message: msg };
        }
        try {
          await VfsOps.renameOp(normalizedOldPath, normalizedNewPath);
          return {
            status: "success",
            oldPath: normalizedOldPath,
            newPath: normalizedNewPath,
          }; // Confirm success
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred renaming item.";
          console.error(
            `[VFS Tool Execute] Error in renameOp for ${normalizedOldPath} -> ${normalizedNewPath}:`,
            error,
          );
          toast.error(
            `VFS Rename Error (${basename(normalizedOldPath)} -> ${basename(normalizedNewPath)}): ${errorMessage}`,
          );
          return { status: "error", message: errorMessage }; // Return error status
        }
      },
    });
    unregisterFunctions.push(
      registerTool(MOD_ID, "vfs_rename_item", renameItemTool),
    );

    return () => {
      unregisterFunctions.forEach((unregister) => unregister());
      console.log("[useVfsToolsRegistration] VFS tools unregistered");
    };
  }, [registerTool, unregisterTool]); // Ensure dependencies are correct
}
