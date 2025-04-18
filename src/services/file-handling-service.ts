// src/services/file-handling-service.ts
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { decodeUint8Array, isCodeFile } from "@/utils/chat-utils";
import type { VfsContextObject } from "@/lib/types";

export interface FileContextResult {
  contextPrefix: string;
  pathsIncludedInContext: string[];
}

export class FileHandlingService {
  /**
   * Processes attached files to include in the chat context
   * @param attachedFiles Files attached by the user
   * @returns The formatted content to be prepended to the user prompt
   */
  public static async processAttachedFiles(attachedFiles: File[]): Promise<string> {
    if (attachedFiles.length === 0) return "";
    
    const attachedContentPromises = attachedFiles.map(async (file) => {
      if (file.type.startsWith("text/") || isCodeFile(file.name)) {
        try {
          const contentText = await file.text();
          const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
          return `<attached_file name="${file.name}" type="${file.type}" extension="${fileExtension}">
\`\`\`${fileExtension}
${contentText}
\`\`\`
</attached_file>`;
        } catch (readErr) {
          let errmsg = "";
          if (readErr instanceof Error) {
            errmsg = readErr.message;
          } else {
            errmsg = String(readErr);
          }
          toast.error(
            `Failed to read attached file: ${file.name}\n${errmsg}`,
          );
          return `<attached_file name="${file.name}" type="${file.type}" error="Failed to read"/>`;
        }
      } else {
        toast.info(`Skipping unsupported file: ${file.name}`);
        return `<attached_file name="${file.name}" type="${file.type}" status="skipped_unsupported"/>`;
      }
    });
    
    const attachedContents = await Promise.all(attachedContentPromises);
    if (attachedContents.length > 0) {
      return attachedContents.join("\n") + "\n";
    }
    
    return "";
  }
  
  /**
   * Processes VFS files to include in the chat context
   * @param vfsPaths Array of VFS paths to be included
   * @param vfs VFS context object
   * @param isVfsEnabledForItem Whether VFS is enabled for the current item
   * @param enableVfs Whether VFS is enabled globally
   * @returns Object containing the formatted content and included paths
   */
  public static async processVfsFiles(
    vfsPaths: string[],
    vfs: VfsContextObject,
    isVfsEnabledForItem: boolean,
    enableVfs: boolean
  ): Promise<FileContextResult> {
    const contextPrefix = "";
    const pathsIncludedInContext: string[] = [];
    
    if (
      !enableVfs ||
      !isVfsEnabledForItem ||
      !vfs.isReady ||
      vfs.configuredVfsKey !== vfs.vfsKey ||
      vfsPaths.length === 0
    ) {
      if (vfsPaths.length > 0 && (enableVfs && !isVfsEnabledForItem)) {
        toast.warning("VFS not enabled for this chat. Selected files ignored.");
      }
      return { contextPrefix, pathsIncludedInContext };
    }
    
    modEvents.emit(ModEvent.VFS_CONTEXT_ADDED, {
      paths: vfsPaths,
    });
    
    const vfsContentPromises = vfsPaths.map(async (path) => {
      try {
        const contentBytes = await vfs.readFile(path);
        const contentText = decodeUint8Array(contentBytes);
        pathsIncludedInContext.push(path);
        const fileExtension = path.split(".").pop()?.toLowerCase() || "";
        return `<vfs_file path="${path}" extension="${fileExtension}">
\`\`\`${fileExtension}
${contentText}
\`\`\`
</vfs_file>`;
      } catch (readErr) {
        console.error(`Error reading VFS file ${path}:`, readErr);
        toast.error(`Failed to read VFS file: ${path}`);
        return `<vfs_file path="${path}" error="Failed to read"/>`;
      }
    });
    
    const vfsContents = await Promise.all(vfsContentPromises);
    if (vfsContents.length > 0) {
      return { 
        contextPrefix: vfsContents.join("\n") + "\n", 
        pathsIncludedInContext 
      };
    }
    
    return { contextPrefix, pathsIncludedInContext };
  }
}