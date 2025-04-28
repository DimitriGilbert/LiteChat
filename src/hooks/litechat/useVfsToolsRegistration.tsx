// src/hooks/litechat/useVfsToolsRegistration.tsx
import { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { tool } from "ai";
import { z } from "zod";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { toast } from "sonner";
import { formatBytes } from "@/lib/litechat/file-manager-utils";

// --- VFS List Directory Tool ---
const vfsListDirectoryDefinition = tool({
  description:
    "Lists files and folders within a specified directory in the Virtual File System (VFS). Use '/' for the root directory.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path of the directory to list (e.g., '/', '/documents', '/code/projectA').",
      ),
  }),
});

const vfsListDirectoryImplementation = async (args: { path: string }) => {
  try {
    const entries = await VfsOps.listFilesOp(args.path);
    if (entries.length === 0) {
      return `Directory "${args.path}" is empty.`;
    }
    const formattedEntries = entries
      .map((e) => {
        const type = e.isDirectory ? "Folder" : "File";
        const size = e.isDirectory ? "" : ` (${formatBytes(e.size)})`;
        return `- ${e.name} [${type}]${size}`;
      })
      .join("\n");
    return `Contents of "${args.path}":\n${formattedEntries}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`VFS List Error (${args.path}): ${message}`);
    return { error: `Failed to list directory "${args.path}": ${message}` };
  }
};

// --- VFS Read File Tool ---
const vfsReadFileDefinition = tool({
  description:
    "Reads the content of a specified file in the Virtual File System (VFS). Returns the content as a string.",
  parameters: z.object({
    path: z
      .string()
      .describe(
        "The absolute path of the file to read (e.g., '/documents/notes.txt', '/code/main.py').",
      ),
  }),
});

const vfsReadFileImplementation = async (args: { path: string }) => {
  try {
    const contentUint8Array = await VfsOps.readFileOp(args.path);
    // Attempt to decode as UTF-8, fallback might be needed for binary
    const contentString = new TextDecoder().decode(contentUint8Array);
    // Limit response size for safety? Maybe not, let the LLM handle it.
    return contentString;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast.error(`VFS Read Error (${args.path}): ${message}`);
    return { error: `Failed to read file "${args.path}": ${message}` };
  }
};

export const useVfsToolsRegistration = () => {
  const registerTool = useControlRegistryStore((state) => state.registerTool);

  useEffect(() => {
    const unregisterList = registerTool(
      "core", // Assign to core modId
      "vfs_list_directory",
      vfsListDirectoryDefinition,
      vfsListDirectoryImplementation,
    );

    const unregisterRead = registerTool(
      "core", // Assign to core modId
      "vfs_read_file",
      vfsReadFileDefinition,
      vfsReadFileImplementation,
    );

    return () => {
      unregisterList();
      unregisterRead();
    };
  }, [registerTool]);
};
