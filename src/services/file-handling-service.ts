// src/services/file-handling-service.ts
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { decodeUint8Array, isCodeFile } from "@/utils/chat-utils";
import type { TextPart, ImagePart } from "@/lib/types";
import { useVfsStore } from "@/store/vfs.store"; // Import the store

// Define the structure for the parts processed from files
type ContentPart = TextPart | ImagePart;

// Define the structure for the result of processing VFS files
export interface FileContextResult {
  contextPrefix: string; // The formatted string to prepend to the prompt
  pathsIncludedInContext: string[]; // List of paths successfully read
}

// Define a simplified context structure needed from the caller
interface VfsSimpleContext {
  isVfsReady: boolean;
  isVfsEnabledForItem: boolean;
  enableVfs: boolean; // Global VFS enable flag
  vfsKey: string | null; // Current VFS key
}

/**
 * Escapes special XML characters in a string.
 * @param unsafe The string to escape.
 * @returns The escaped string.
 */
const escapeXml = (unsafe: string): string => {
  // Use a regex for efficiency and completeness
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c; // Should not happen with the regex
    }
  });
};

export class FileHandlingService {
  /**
   * Processes attached files into an array of ContentPart objects for multi-modal input.
   * Images are returned as ImagePart, text/code files are formatted into <file_context> tags within a TextPart.
   * @param attachedFiles An array of File objects attached by the user.
   * @returns A promise resolving to an array of ContentPart objects.
   */
  public static async processAttachedFiles(
    attachedFiles: File[],
  ): Promise<ContentPart[]> {
    if (!attachedFiles || attachedFiles.length === 0) return [];

    const textContextParts: string[] = []; // Stores formatted text/code file contexts
    const imageParts: ImagePart[] = []; // Stores image parts

    // Process each file concurrently
    const fileProcessingPromises = attachedFiles.map(
      async (file): Promise<void> => {
        if (file.type.startsWith("image/")) {
          // Handle images
          try {
            const base64DataUrl = await this.readFileAsDataURL(file);
            imageParts.push({
              type: "image",
              image: base64DataUrl, // Store the full data URL
              mediaType: file.type,
            });
          } catch (readErr) {
            const errmsg =
              readErr instanceof Error ? readErr.message : String(readErr);
            console.error(
              `Failed to read attached image ${file.name}:`,
              readErr,
            );
            toast.error(
              `Failed to read attached image: ${file.name}\n${errmsg}`,
            );
            // Add error context block if reading fails
            textContextParts.push(
              `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" error="Failed to read"/>`,
            );
          }
        } else if (file.type.startsWith("text/") || isCodeFile(file.name)) {
          // Handle text/code files
          try {
            const contentText = await file.text();
            const fileExtension =
              file.name.split(".").pop()?.toLowerCase() || "";
            // Format as XML-like tag
            textContextParts.push(
              `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" extension="${escapeXml(fileExtension)}">
${escapeXml(contentText)}
</file_context>`,
            );
          } catch (readErr) {
            const errmsg =
              readErr instanceof Error ? readErr.message : String(readErr);
            console.error(
              `Failed to read attached file ${file.name}:`,
              readErr,
            );
            toast.error(
              `Failed to read attached file: ${file.name}\n${errmsg}`,
            );
            // Add error context block
            textContextParts.push(
              `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" error="Failed to read"/>`,
            );
          }
        } else {
          // Handle unsupported file types
          console.warn(
            `Skipping unsupported file type: ${file.name} (${file.type})`,
          );
          toast.info(`Skipping unsupported file type: ${file.name}`);
          // Add skipped context block
          textContextParts.push(
            `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" status="skipped_unsupported"/>`,
          );
        }
      },
    );

    // Wait for all file processing to complete
    await Promise.all(fileProcessingPromises);

    // Combine results
    const finalParts: ContentPart[] = [...imageParts]; // Start with image parts
    if (textContextParts.length > 0) {
      // Combine all text/code file contexts into a single TextPart, separated by newlines
      finalParts.push({
        type: "text",
        text: textContextParts.join("\n\n"),
      });
    }

    return finalParts;
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
          // Should not happen with readAsDataURL, but handle defensively
          reject(new Error("FileReader result was not a string."));
        }
      };
      reader.onerror = (error) => {
        // Reject the promise on file reading error
        reject(error);
      };
      // Read the file content as Data URL
      reader.readAsDataURL(file);
    });
  }

  /**
   * Processes VFS files selected for context, reading their content and formatting it.
   * Uses the VFS store directly to access the `readFile` operation.
   * @param vfsPaths Array of VFS paths to include.
   * @param vfsContext Simple context object with necessary VFS state flags.
   * @returns A promise resolving to an object containing the formatted text prefix and included paths.
   */
  public static async processVfsFilesWithContext(
    vfsPaths: string[],
    vfsContext: VfsSimpleContext,
  ): Promise<FileContextResult> {
    const { isVfsReady, isVfsEnabledForItem, enableVfs, vfsKey } = vfsContext;
    let contextPrefix = "";
    const pathsIncludedInContext: string[] = [];

    // --- Pre-checks ---
    if (
      !enableVfs || // Global VFS disabled
      !isVfsEnabledForItem || // VFS disabled for the current item
      !isVfsReady || // VFS backend not initialized
      !vfsKey || // No valid VFS key (indicates no item selected or orphan without VFS)
      vfsPaths.length === 0 // No paths selected
    ) {
      // Provide feedback if paths were selected but VFS isn't usable
      if (vfsPaths.length > 0 && enableVfs && !isVfsEnabledForItem) {
        toast.warning("VFS not enabled for this chat. Selected files ignored.");
      }
      // Return empty result if VFS cannot be used
      return { contextPrefix, pathsIncludedInContext };
    }

    console.log(
      `[FileHandlingService] Processing ${vfsPaths.length} VFS files for context (VFS Key: ${vfsKey})`,
    );

    // Emit event indicating which paths are being added to context
    modEvents.emit(ModEvent.VFS_CONTEXT_ADDED, { paths: vfsPaths });

    // Get the readFile function directly from the VFS store state
    const readFile = useVfsStore.getState().readFile;

    // Process each selected VFS path concurrently
    const vfsContentPromises = vfsPaths.map(async (path) => {
      try {
        // Read file content using the VFS store's action
        const contentBytes = await readFile(path);
        // Decode the content safely
        const contentText = decodeUint8Array(contentBytes);
        // Add path to the list of successfully included files
        pathsIncludedInContext.push(path);
        // Extract file extension and name
        const fileExtension = path.split(".").pop()?.toLowerCase() || "";
        const filename = path.split("/").pop() || path;
        console.log(
          `[FileHandlingService] Successfully read VFS file: ${path}`,
        );
        // Format the content using the XML-like tag
        return `<file_context type="vfs" path="${escapeXml(path)}" name="${escapeXml(filename)}" extension="${escapeXml(fileExtension)}">
${escapeXml(contentText)}
</file_context>`;
      } catch (readErr) {
        // Handle errors during file reading
        console.error(
          `[FileHandlingService] Error reading VFS file ${path}:`,
          readErr,
        );
        toast.error(`Failed to read VFS file: ${path}`);
        const filename = path.split("/").pop() || path;
        // Return an error context block
        return `<file_context type="vfs" path="${escapeXml(path)}" name="${escapeXml(filename)}" error="Failed to read"/>`;
      }
    });

    // Wait for all file reading promises to settle
    const vfsContents = await Promise.all(vfsContentPromises);

    // Combine the formatted contents into a single prefix string
    if (vfsContents.length > 0) {
      contextPrefix = vfsContents.join("\n\n") + "\n\n"; // Add separators and trailing newline
    }

    console.log(
      `[FileHandlingService] Processed ${pathsIncludedInContext.length} VFS files successfully for context.`,
    );
    // Return the combined prefix and the list of included paths
    return { contextPrefix, pathsIncludedInContext };
  }
}
