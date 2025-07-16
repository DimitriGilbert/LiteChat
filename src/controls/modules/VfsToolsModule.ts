// src/controls/modules/VfsToolsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  type ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { z } from "zod";
import { Tool } from "ai";
import { normalizePath, joinPath } from "@/lib/litechat/file-manager-utils";

const listFilesSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      "The directory path to list within the VFS. Defaults to the current directory if omitted."
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

type ToolContext = ReadonlyChatContextSnapshot & {
  fsInstance?: typeof VfsOps.VFS;
};

export class VfsToolsModule implements ControlModule {
  readonly id = "core-vfs-tools";
  private unregisterCallbacks: (() => void)[] = [];

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // modApi parameter is available here if needed for initialization logic
    console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    console.log(`[${this.id}] Registering Core VFS Tools...`);

    const listFilesTool: Tool<any> = {
      description:
        "List files and directories in a specified VFS path, or the current path if none is given.",
      inputSchema: listFilesSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "vfsListFiles",
        listFilesTool,
        async (
          { path }: z.infer<typeof listFilesSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          const targetPath = normalizePath(path || "/");
          try {
            const entries = await VfsOps.listFilesOp(targetPath, {
              fsInstance,
            });
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
        }
      )
    );

    const readFileTool: Tool<any> = {
      description: "Read the content of a file from the VFS.",
      inputSchema: readFileSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "vfsReadFile",
        readFileTool,
        async (
          { path, encoding }: z.infer<typeof readFileSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          const normalizedPath = normalizePath(path);
          try {
            const contentBytes = await VfsOps.readFileOp(normalizedPath, {
              fsInstance,
            });
            let content: string;
            if (encoding === "base64") {
              content = btoa(String.fromCharCode(...contentBytes));
            } else {
              content = new TextDecoder().decode(contentBytes);
            }
            return { success: true, path: normalizedPath, content, encoding };
          } catch (e: any) {
            return { success: false, path: normalizedPath, error: e.message };
          }
        }
      )
    );

    const writeFileTool: Tool<any> = {
      description: "Write content to a file in the VFS.",
      inputSchema: writeFileSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "vfsWriteFile",
        writeFileTool,
        async (
          { path, content, encoding }: z.infer<typeof writeFileSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          const normalizedPath = normalizePath(path);
          try {
            let dataToWrite: Uint8Array | string;
            if (encoding === "base64") {
              const binaryString = atob(content);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              dataToWrite = bytes;
            } else {
              dataToWrite = content;
            }
            await VfsOps.writeFileOp(normalizedPath, dataToWrite, {
              fsInstance,
            });
            return { success: true, path: normalizedPath };
          } catch (e: any) {
            return { success: false, path: normalizedPath, error: e.message };
          }
        }
      )
    );

    const deleteFileTool: Tool<any> = {
      description: "Delete a file or directory from the VFS.",
      inputSchema: deleteFileSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "vfsDelete",
        deleteFileTool,
        async (
          { path, recursive }: z.infer<typeof deleteFileSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          const normalizedPath = normalizePath(path);
          try {
            await VfsOps.deleteItemOp(normalizedPath, recursive, {
              fsInstance,
            });
            return { success: true, path: normalizedPath };
          } catch (e: any) {
            return { success: false, path: normalizedPath, error: e.message };
          }
        }
      )
    );

    const createDirectoryTool: Tool<any> = {
      description: "Create a directory (including parents) in the VFS.",
      inputSchema: createDirectorySchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "vfsCreateDirectory",
        createDirectoryTool,
        async (
          { path }: z.infer<typeof createDirectorySchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          const normalizedPath = normalizePath(path);
          try {
            await VfsOps.createDirectoryOp(normalizedPath, { fsInstance });
            return { success: true, path: normalizedPath };
          } catch (e: any) {
            return { success: false, path: normalizedPath, error: e.message };
          }
        }
      )
    );

    const renameTool: Tool<any> = {
      description: "Rename a file or directory in the VFS.",
      inputSchema: renameSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "vfsRename",
        renameTool,
        async (
          { oldPath, newName }: z.infer<typeof renameSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          const normalizedOldPath = normalizePath(oldPath);
          const parentPath = normalizePath(
            normalizedOldPath.substring(
              0,
              normalizedOldPath.lastIndexOf("/")
            ) || "/"
          );
          const normalizedNewPath = joinPath(parentPath, newName);
          try {
            await VfsOps.renameOp(normalizedOldPath, normalizedNewPath, {
              fsInstance,
            });
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
        }
      )
    );

    console.log(`[${this.id}] Core VFS Tools Registered.`);
  }

  destroy(): void {
    this.unregisterCallbacks.forEach((unsub) => unsub());
    this.unregisterCallbacks = [];
    console.log(`[${this.id}] Destroyed.`);
  }
}
