// src/hooks/litechat/useVfsToolsRegistration.tsx
import { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useVfsStore } from "@/store/vfs.store"; // Import VFS store
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { z } from "zod";
import { toast } from "sonner";
import type {
  ReadonlyChatContextSnapshot,
  ToolImplementation,
} from "@/types/litechat/modding";
import { Tool } from "ai";

// Helper to ensure VFS is initialized before running an operation
async function ensureVfsReady(
  toolName: string,
): Promise<typeof VfsOps.VFS | null> {
  const { fs: currentFs, initializeVFS, vfsKey } = useVfsStore.getState();

  if (currentFs) {
    return currentFs;
  }

  console.log(
    `[${toolName}] VFS not ready. Attempting initialization with key: ${vfsKey || "default_fallback_key"}...`,
  );
  toast.info(`Initializing filesystem for ${toolName}...`);

  try {
    // Attempt initialization and wait for it
    await initializeVFS(vfsKey || "default_fallback_key");

    // Check again after initialization attempt
    const { fs: updatedFs } = useVfsStore.getState();
    if (updatedFs) {
      console.log(`[${toolName}] VFS initialization successful.`);
      toast.success(`Filesystem ready for ${toolName}.`);
      return updatedFs;
    } else {
      throw new Error("VFS initialization failed after attempt.");
    }
  } catch (error) {
    console.error(`[${toolName}] Failed to ensure VFS readiness:`, error);
    toast.error(
      `Filesystem unavailable for ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null; // Indicate failure
  }
}

// --- Tool Definitions ---

const vfsListDirectoryTool: Tool<z.ZodObject<{ path: z.ZodString }>> = {
  description:
    "Lists files and folders within a specified directory in the Virtual File System (VFS). Use '/' for the root directory.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path of the directory to list (e.g., '/', '/documents', '/project/code').",
      ),
  }),
  // Execute logic is now wrapped
};

const vfsReadFileTool: Tool<z.ZodObject<{ path: z.ZodString }>> = {
  description:
    "Reads the content of a specified file from the Virtual File System (VFS). Returns the content as a string.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path of the file to read (e.g., '/documents/notes.txt', '/project/code/main.py').",
      ),
  }),
  // Execute logic is now wrapped
};

const vfsWriteFileTool: Tool<
  z.ZodObject<{ path: z.ZodString; content: z.ZodString }>
> = {
  description:
    "Writes or overwrites a file with the given content in the Virtual File System (VFS). Creates parent directories if they don't exist.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path where the file should be written (e.g., '/documents/new_notes.txt', '/project/data.json').",
      ),
    content: z.string().describe("The text content to write into the file."),
  }),
  // Execute logic is now wrapped
};

const vfsCreateDirectoryTool: Tool<z.ZodObject<{ path: z.ZodString }>> = {
  description:
    "Creates a new directory (and any necessary parent directories) at the specified path in the Virtual File System (VFS).",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path of the directory to create (e.g., '/new_folder', '/project/assets/images').",
      ),
  }),
  // Execute logic is now wrapped
};

const vfsDeleteTool: Tool<z.ZodObject<{ path: z.ZodString }>> = {
  description:
    "Deletes a file or an empty directory from the Virtual File System (VFS). Use with caution.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path of the file or empty directory to delete (e.g., '/documents/old_notes.txt', '/temp_folder').",
      ),
  }),
  // Execute logic is now wrapped
};

const vfsDeleteRecursiveTool: Tool<z.ZodObject<{ path: z.ZodString }>> = {
  description:
    "Deletes a directory and ALL its contents (files and subdirectories) recursively from the Virtual File System (VFS). VERY DANGEROUS - USE WITH EXTREME CAUTION.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path of the directory to delete recursively (e.g., '/project_to_delete', '/old_backups'). Cannot be '/'.",
      ),
  }),
  // Execute logic is now wrapped
};

// --- Tool Implementations ---

const vfsListDirectoryImpl: ToolImplementation<
  typeof vfsListDirectoryTool.parameters
> = async (args, _context) => {
  console.log(
    `[VFS Tool Execute] vfs_list_directory called for path: ${args.path}`,
  );
  // Ensure VFS is ready before proceeding
  const fsInstance = await ensureVfsReady("vfs_list_directory");
  if (!fsInstance) {
    return { status: "error", error: "Filesystem not available." };
  }
  console.log("[VFS Tool Execute] VfsOps.VFS instance state:", VfsOps.VFS); // Log the VFS instance state

  try {
    const entries = await VfsOps.listFilesOp(args.path);
    return {
      status: "success",
      isEmpty: entries.length === 0,
      content: entries.map((e) => ({
        name: e.name,
        type: e.isDirectory ? "folder" : "file",
        size: e.size,
        lastModified: e.lastModified.toISOString(),
      })),
    };
  } catch (error: any) {
    return {
      status: "error",
      error: `Failed to list directory: ${error.message}`,
    };
  }
};

const vfsReadFileImpl: ToolImplementation<
  typeof vfsReadFileTool.parameters
> = async (args, _context) => {
  console.log(`[VFS Tool Execute] vfs_read_file called for path: ${args.path}`);
  const fsInstance = await ensureVfsReady("vfs_read_file");
  if (!fsInstance) {
    return { status: "error", error: "Filesystem not available." };
  }
  try {
    const contentBuffer = await VfsOps.readFileOp(args.path);
    const contentString = new TextDecoder().decode(contentBuffer);
    return { status: "success", content: contentString };
  } catch (error: any) {
    return { status: "error", error: `Failed to read file: ${error.message}` };
  }
};

const vfsWriteFileImpl: ToolImplementation<
  typeof vfsWriteFileTool.parameters
> = async (args, _context) => {
  console.log(
    `[VFS Tool Execute] vfs_write_file called for path: ${args.path}`,
  );
  const fsInstance = await ensureVfsReady("vfs_write_file");
  if (!fsInstance) {
    return { status: "error", error: "Filesystem not available." };
  }
  try {
    await VfsOps.writeFileOp(args.path, args.content);
    return { status: "success" };
  } catch (error: any) {
    return {
      status: "error",
      error: `Failed to write file: ${error.message}`,
    };
  }
};

const vfsCreateDirectoryImpl: ToolImplementation<
  typeof vfsCreateDirectoryTool.parameters
> = async (args, _context) => {
  console.log(
    `[VFS Tool Execute] vfs_create_directory called for path: ${args.path}`,
  );
  const fsInstance = await ensureVfsReady("vfs_create_directory");
  if (!fsInstance) {
    return { status: "error", error: "Filesystem not available." };
  }
  try {
    await VfsOps.createDirectoryOp(args.path);
    return { status: "success" };
  } catch (error: any) {
    return {
      status: "error",
      error: `Failed to create directory: ${error.message}`,
    };
  }
};

const vfsDeleteImpl: ToolImplementation<
  typeof vfsDeleteTool.parameters
> = async (args, _context) => {
  console.log(`[VFS Tool Execute] vfs_delete called for path: ${args.path}`);
  const fsInstance = await ensureVfsReady("vfs_delete");
  if (!fsInstance) {
    return { status: "error", error: "Filesystem not available." };
  }
  if (args.path === "/") {
    return { status: "error", error: "Cannot delete the root directory." };
  }
  try {
    await VfsOps.deleteItemOp(args.path, false); // recursive = false
    return { status: "success" };
  } catch (error: any) {
    return {
      status: "error",
      error: `Failed to delete item: ${error.message}`,
    };
  }
};

const vfsDeleteRecursiveImpl: ToolImplementation<
  typeof vfsDeleteRecursiveTool.parameters
> = async (args, _context) => {
  console.log(
    `[VFS Tool Execute] vfs_delete_recursive called for path: ${args.path}`,
  );
  const fsInstance = await ensureVfsReady("vfs_delete_recursive");
  if (!fsInstance) {
    return { status: "error", error: "Filesystem not available." };
  }
  if (args.path === "/") {
    return { status: "error", error: "Cannot delete the root directory." };
  }
  try {
    await VfsOps.deleteItemOp(args.path, true); // recursive = true
    return { status: "success" };
  } catch (error: any) {
    return {
      status: "error",
      error: `Failed to delete directory recursively: ${error.message}`,
    };
  }
};

// --- Registration Hook ---

export const useVfsToolsRegistration = () => {
  const { registerTool } = useControlRegistryStore();

  useEffect(() => {
    const unregisterFuncs: (() => void)[] = [];

    const register = <P extends z.ZodSchema<any>>(
      name: string,
      definition: Tool<P>,
      implementation: ToolImplementation<P>,
    ) => {
      // Wrap the implementation with the VFS check
      const wrappedImplementation: ToolImplementation<P> = async (
        args: z.infer<P>,
        context: ReadonlyChatContextSnapshot,
      ) => {
        // The ensureVfsReady call is now inside the specific implementations above
        // This wrapper just calls the specific implementation
        return implementation(args, context);
      };
      unregisterFuncs.push(
        registerTool("core", name, definition, wrappedImplementation),
      );
    };

    // Register all VFS tools
    register("vfs_list_directory", vfsListDirectoryTool, vfsListDirectoryImpl);
    register("vfs_read_file", vfsReadFileTool, vfsReadFileImpl);
    register("vfs_write_file", vfsWriteFileTool, vfsWriteFileImpl);
    register(
      "vfs_create_directory",
      vfsCreateDirectoryTool,
      vfsCreateDirectoryImpl,
    );
    register("vfs_delete", vfsDeleteTool, vfsDeleteImpl);
    register(
      "vfs_delete_recursive",
      vfsDeleteRecursiveTool,
      vfsDeleteRecursiveImpl,
    );

    // Cleanup function
    return () => {
      console.log("[useVfsToolsRegistration] VFS tools unregistered");
      unregisterFuncs.forEach((unregister) => unregister());
    };
  }, [registerTool]); // Dependency array includes the registerTool action
};
