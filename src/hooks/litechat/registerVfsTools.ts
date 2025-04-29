// src/hooks/litechat/registerVfsTools.ts
import { useControlRegistryStore } from "@/store/control.store";
import { useVfsStore } from "@/store/vfs.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { z } from "zod";
import { Tool } from "ai";
import { normalizePath, joinPath } from "@/lib/litechat/file-manager-utils";

// --- Schemas ---
const listFilesSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      "The directory path to list within the VFS. Defaults to the current directory if omitted.",
    ),
});

const readFileSchema = z.object({
  path: z.string().describe("The path of the file to read within the VFS."),
  encoding: z
    .enum(["utf-8", "base64"])
    .optional()
    .default("utf-8")
    .describe("Encoding for reading the file (utf-8 or base64)."),
});

const writeFileSchema = z.object({
  path: z.string().describe("The path where the file should be written."),
  content: z.string().describe("The content to write to the file."),
  encoding: z
    .enum(["utf-8", "base64"])
    .optional()
    .default("utf-8")
    .describe("Encoding of the provided content (utf-8 or base64)."),
});

const deleteFileSchema = z.object({
  path: z.string().describe("The path of the file or directory to delete."),
  recursive: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to delete directories recursively."),
});

const createDirectorySchema = z.object({
  path: z
    .string()
    .describe("The path of the directory to create (including parents)."),
});

const renameSchema = z.object({
  oldPath: z.string().describe("The current path of the item to rename."),
  newName: z.string().describe("The new name for the item."),
});

// --- Registration Function ---
export function registerVfsTools() {
  const registerTool = useControlRegistryStore.getState().registerTool;
  const getCurrentPath = () => {
    const currentParentId = useVfsStore.getState().currentParentId;
    const nodes = useVfsStore.getState().nodes;
    const rootId = useVfsStore.getState().rootId;
    const currentDirectory = currentParentId
      ? nodes[currentParentId]
      : nodes[rootId || ""];
    return currentDirectory ? currentDirectory.path : "/";
  };

  console.log("[Function] Registering Core VFS Tools...");

  // --- List Files Tool ---
  const listFilesTool: Tool<typeof listFilesSchema> = {
    description:
      "List files and directories in a specified VFS path, or the current path if none is given.",
    parameters: listFilesSchema,
  };
  registerTool("core", "vfsListFiles", listFilesTool, async ({ path }) => {
    const targetPath = normalizePath(path || getCurrentPath());
    try {
      const entries = await VfsOps.listFilesOp(targetPath);
      return {
        success: true,
        path: targetPath,
        entries: entries.map((e) => ({
          name: e.name,
          type: e.isDirectory ? "folder" : "file",
          size: e.size,
          lastModified: e.lastModified.toISOString(),
        })),
      };
    } catch (e: any) {
      return { success: false, path: targetPath, error: e.message };
    }
  });

  // --- Read File Tool ---
  const readFileTool: Tool<typeof readFileSchema> = {
    description: "Read the content of a file from the VFS.",
    parameters: readFileSchema,
  };
  registerTool(
    "core",
    "vfsReadFile",
    readFileTool,
    async ({ path, encoding }) => {
      const normalizedPath = normalizePath(path);
      try {
        const contentBytes = await VfsOps.readFileOp(normalizedPath);
        let content: string;
        if (encoding === "base64") {
          // Convert Uint8Array to base64 string
          content = btoa(String.fromCharCode(...contentBytes));
        } else {
          // Default to utf-8
          content = new TextDecoder().decode(contentBytes);
        }
        return { success: true, path: normalizedPath, content, encoding };
      } catch (e: any) {
        return { success: false, path: normalizedPath, error: e.message };
      }
    },
  );

  // --- Write File Tool ---
  const writeFileTool: Tool<typeof writeFileSchema> = {
    description: "Write content to a file in the VFS.",
    parameters: writeFileSchema,
  };
  registerTool(
    "core",
    "vfsWriteFile",
    writeFileTool,
    async ({ path, content, encoding }) => {
      const normalizedPath = normalizePath(path);
      try {
        let dataToWrite: Uint8Array | string;
        if (encoding === "base64") {
          // Convert base64 string to Uint8Array
          const binaryString = atob(content);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          dataToWrite = bytes;
        } else {
          // Default to utf-8 string
          dataToWrite = content;
        }
        await VfsOps.writeFileOp(normalizedPath, dataToWrite);
        return { success: true, path: normalizedPath };
      } catch (e: any) {
        return { success: false, path: normalizedPath, error: e.message };
      }
    },
  );

  // --- Delete File/Directory Tool ---
  const deleteFileTool: Tool<typeof deleteFileSchema> = {
    description: "Delete a file or directory from the VFS.",
    parameters: deleteFileSchema,
  };
  registerTool(
    "core",
    "vfsDelete",
    deleteFileTool,
    async ({ path, recursive }) => {
      const normalizedPath = normalizePath(path);
      try {
        await VfsOps.deleteItemOp(normalizedPath, recursive);
        return { success: true, path: normalizedPath };
      } catch (e: any) {
        return { success: false, path: normalizedPath, error: e.message };
      }
    },
  );

  // --- Create Directory Tool ---
  const createDirectoryTool: Tool<typeof createDirectorySchema> = {
    description: "Create a directory (including parents) in the VFS.",
    parameters: createDirectorySchema,
  };
  registerTool(
    "core",
    "vfsCreateDirectory",
    createDirectoryTool,
    async ({ path }) => {
      const normalizedPath = normalizePath(path);
      try {
        await VfsOps.createDirectoryOp(normalizedPath);
        return { success: true, path: normalizedPath };
      } catch (e: any) {
        return { success: false, path: normalizedPath, error: e.message };
      }
    },
  );

  // --- Rename Tool ---
  const renameTool: Tool<typeof renameSchema> = {
    description: "Rename a file or directory in the VFS.",
    parameters: renameSchema,
  };
  registerTool(
    "core",
    "vfsRename",
    renameTool,
    async ({ oldPath, newName }) => {
      const normalizedOldPath = normalizePath(oldPath);
      const parentPath = normalizePath(
        normalizedOldPath.substring(0, normalizedOldPath.lastIndexOf("/")) ||
          "/",
      );
      const normalizedNewPath = joinPath(parentPath, newName);
      try {
        await VfsOps.renameOp(normalizedOldPath, normalizedNewPath);
        return {
          success: true,
          oldPath: normalizedOldPath,
          newPath: normalizedNewPath,
        };
      } catch (e: any) {
        return {
          success: false,
          oldPath: normalizedOldPath,
          newName: newName,
          error: e.message,
        };
      }
    },
  );

  console.log("[Function] Core VFS Tools Registered.");
  // No cleanup needed or returned
}
