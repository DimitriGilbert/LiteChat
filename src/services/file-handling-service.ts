// src/services/file-handling-service.ts
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { decodeUint8Array, isCodeFile } from "@/utils/chat-utils";
import type { VfsContextObject, TextPart, ImagePart } from "@/lib/types";

// Define the ContentPart type based on TextPart and ImagePart
type ContentPart = TextPart | ImagePart;

// Define a type for the intermediate result before filtering nulls
type MaybeContentPart = ContentPart | null;

export interface FileContextResult {
  contextPrefix: string; // Keep for VFS text content
  pathsIncludedInContext: string[];
}

export class FileHandlingService {
  /**
   * Processes attached files into an array of ContentPart objects for multi-modal input.
   * @param attachedFiles Files attached by the user
   * @returns An array of ContentPart objects (TextPart for text/code, ImagePart for images)
   */
  public static async processAttachedFiles(
    attachedFiles: File[],
  ): Promise<ContentPart[]> {
    if (attachedFiles.length === 0) return [];

    const contentPartsPromises = attachedFiles.map(
      async (file): Promise<MaybeContentPart> => {
        // Explicitly type the promise return
        if (file.type.startsWith("image/")) {
          // Process images: Read as base64 data URL
          try {
            const base64DataUrl = await this.readFileAsDataURL(file);
            // Ensure the returned object matches ImagePart exactly
            const imagePart: ImagePart = {
              type: "image",
              image: base64DataUrl,
              mediaType: file.type, // Assign mediaType, it's optional but good to have
            };
            return imagePart;
          } catch (readErr) {
            const errmsg =
              readErr instanceof Error ? readErr.message : String(readErr);
            toast.error(
              `Failed to read attached image: ${file.name}\n${errmsg}`,
            );
            // Optionally return a text part indicating the error
            const textPart: TextPart = {
              type: "text",
              text: `<attached_file name="${file.name}" type="${file.type}" error="Failed to read"/>`,
            };
            return textPart;
          }
        } else if (file.type.startsWith("text/") || isCodeFile(file.name)) {
          // Process text/code files: Read as text
          try {
            const contentText = await file.text();
            const fileExtension =
              file.name.split(".").pop()?.toLowerCase() || "";
            // Format as a text block within the message content array
            const textPart: TextPart = {
              type: "text",
              text: `<attached_file name="${file.name}" type="${file.type}" extension="${fileExtension}">
\`\`\`${fileExtension}
${contentText}
\`\`\`
</attached_file>`,
            };
            return textPart;
          } catch (readErr) {
            const errmsg =
              readErr instanceof Error ? readErr.message : String(readErr);
            toast.error(
              `Failed to read attached file: ${file.name}\n${errmsg}`,
            );
            const textPart: TextPart = {
              type: "text",
              text: `<attached_file name="${file.name}" type="${file.type}" error="Failed to read"/>`,
            };
            return textPart;
          }
        } else {
          // Skip unsupported files, maybe add a text note
          toast.info(`Skipping unsupported file type: ${file.name}`);
          const textPart: TextPart = {
            type: "text",
            text: `<attached_file name="${file.name}" type="${file.type}" status="skipped_unsupported"/>`,
          };
          return textPart;
          // Or return null if you prefer to completely ignore them
          // return null;
        }
      },
    );

    // Wait for all promises and filter out nulls using a type predicate
    const resolvedParts = await Promise.all(contentPartsPromises);
    const contentParts = resolvedParts.filter(
      (part): part is ContentPart => part !== null, // Correct type predicate
    );
    return contentParts;
  }

  /**
   * Helper function to read a File object as a base64 data URL.
   * @param file The File object to read.
   * @returns A promise that resolves with the base64 data URL string.
   */
  private static readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to read file as Data URL."));
        }
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Processes VFS files to include in the chat context (as text for now).
   * @param vfsPaths Array of VFS paths to be included
   * @param vfs VFS context object
   * @param isVfsEnabledForItem Whether VFS is enabled for the current item
   * @param enableVfs Whether VFS is enabled globally
   * @returns Object containing the formatted text content and included paths
   */
  public static async processVfsFiles(
    vfsPaths: string[],
    vfs: VfsContextObject,
    isVfsEnabledForItem: boolean,
    enableVfs: boolean,
  ): Promise<FileContextResult> {
    let contextPrefix = ""; // Changed from const to let
    const pathsIncludedInContext: string[] = [];

    if (
      !enableVfs ||
      !isVfsEnabledForItem ||
      !vfs.isReady ||
      vfs.configuredVfsKey !== vfs.vfsKey ||
      vfsPaths.length === 0
    ) {
      if (vfsPaths.length > 0 && enableVfs && !isVfsEnabledForItem) {
        toast.warning("VFS not enabled for this chat. Selected files ignored.");
      }
      return { contextPrefix, pathsIncludedInContext };
    }

    modEvents.emit(ModEvent.VFS_CONTEXT_ADDED, {
      paths: vfsPaths,
    });

    const vfsContentPromises = vfsPaths.map(async (path) => {
      try {
        // For now, treat VFS files as text context.
        // Future enhancement: Could check mime type and potentially return ImagePart if VFS stores images.
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
      contextPrefix = vfsContents.join("\n\n") + "\n\n"; // Assign to contextPrefix
    }

    return { contextPrefix, pathsIncludedInContext };
  }
}
