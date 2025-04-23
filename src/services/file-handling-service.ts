
import { toast } from "sonner";
import { modEvents, ModEvent } from "@/mods/events";
import { decodeUint8Array, isCodeFile } from "@/utils/chat-utils";
import type { TextPart, ImagePart } from "@/lib/types";
import { useVfsStore } from "@/store/vfs.store";


type ContentPart = TextPart | ImagePart;

export interface FileContextResult {
  contextPrefix: string; // This will now contain the <file_context> tags for VFS files
  pathsIncludedInContext: string[];
}


interface VfsSimpleContext {
  isVfsReady: boolean;
  isVfsEnabledForItem: boolean;
  enableVfs: boolean;
  vfsKey: string | null;
}


const escapeXml = (unsafe: string): string => {
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
        return c;
    }
  });
};

export class FileHandlingService {
  /**
   * Processes attached files into an array of ContentPart objects for multi-modal input.
   * Images are returned as ImagePart, text/code files are formatted into <file_context> tags within a TextPart.
   * @param attachedFiles Files attached by the user
   * @returns An array of ContentPart objects (TextPart for text/code, ImagePart for images)
   */
  public static async processAttachedFiles(
    attachedFiles: File[],
  ): Promise<ContentPart[]> {
    if (attachedFiles.length === 0) return [];

    const textContextParts: string[] = [];
    const imageParts: ImagePart[] = [];

    const fileProcessingPromises = attachedFiles.map(
      async (file): Promise<void> => {
        if (file.type.startsWith("image/")) {
          try {
            const base64DataUrl = await this.readFileAsDataURL(file);
            imageParts.push({
              type: "image",
              image: base64DataUrl,
              mediaType: file.type,
            });
          } catch (readErr) {
            const errmsg =
              readErr instanceof Error ? readErr.message : String(readErr);
            toast.error(
              `Failed to read attached image: ${file.name}\n${errmsg}`,
            );
            textContextParts.push(
              `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" error="Failed to read"/>`,
            );
          }
        } else if (file.type.startsWith("text/") || isCodeFile(file.name)) {
          try {
            const contentText = await file.text();
            const fileExtension =
              file.name.split(".").pop()?.toLowerCase() || "";
            textContextParts.push(
              `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" extension="${escapeXml(fileExtension)}">
${escapeXml(contentText)}
</file_context>`,
            );
          } catch (readErr) {
            const errmsg =
              readErr instanceof Error ? readErr.message : String(readErr);
            toast.error(
              `Failed to read attached file: ${file.name}\n${errmsg}`,
            );
            textContextParts.push(
              `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" error="Failed to read"/>`,
            );
          }
        } else {
          toast.info(`Skipping unsupported file type: ${file.name}`);
          textContextParts.push(
            `<file_context type="attached" name="${escapeXml(file.name)}" fileType="${escapeXml(file.type)}" status="skipped_unsupported"/>`,
          );
        }
      },
    );

    await Promise.all(fileProcessingPromises);

    const finalParts: ContentPart[] = [...imageParts];
    if (textContextParts.length > 0) {
      // Combine all text/code file contexts into a single TextPart
      finalParts.push({
        type: "text",
        text: textContextParts.join("\n\n"), // Separate blocks
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
   * Processes VFS files to include in the chat context using the standardized <file_context> tag.
   * @param vfsPaths Array of VFS paths to be included
   * @param vfsContext Simple context object with necessary VFS state
   * @returns Object containing the formatted text content (as contextPrefix) and included paths
   */
  public static async processVfsFilesWithContext(
    vfsPaths: string[],
    vfsContext: VfsSimpleContext,
  ): Promise<FileContextResult> {
    const { isVfsReady, isVfsEnabledForItem, enableVfs, vfsKey } = vfsContext;
    let contextPrefix = "";
    const pathsIncludedInContext: string[] = [];

    if (
      !enableVfs ||
      !isVfsEnabledForItem ||
      !isVfsReady ||
      !vfsKey ||
      vfsPaths.length === 0
    ) {
      if (vfsPaths.length > 0 && enableVfs && !isVfsEnabledForItem) {
        toast.warning("VFS not enabled for this chat. Selected files ignored.");
      }
      return { contextPrefix, pathsIncludedInContext };
    }

    console.log(`Processing ${vfsPaths.length} VFS files for context`);

    modEvents.emit(ModEvent.VFS_CONTEXT_ADDED, {
      paths: vfsPaths,
    });

    const readFile = useVfsStore.getState().readFile;

    const vfsContentPromises = vfsPaths.map(async (path) => {
      try {
        const contentBytes = await readFile(path);
        const contentText = decodeUint8Array(contentBytes);
        pathsIncludedInContext.push(path);
        const fileExtension = path.split(".").pop()?.toLowerCase() || "";
        const filename = path.split("/").pop() || path;
        console.log(`Successfully read VFS file: ${path}`);

        // Use the standardized tag format
        return `<file_context type="vfs" path="${escapeXml(path)}" name="${escapeXml(filename)}" extension="${escapeXml(fileExtension)}">
${escapeXml(contentText)}
</file_context>`;
      } catch (readErr) {
        console.error(`Error reading VFS file ${path}:`, readErr);
        toast.error(`Failed to read VFS file: ${path}`);
        const filename = path.split("/").pop() || path;
        return `<file_context type="vfs" path="${escapeXml(path)}" name="${escapeXml(filename)}" error="Failed to read"/>`;
      }
    });

    const vfsContents = await Promise.all(vfsContentPromises);
    if (vfsContents.length > 0) {
      contextPrefix = vfsContents.join("\n\n") + "\n\n"; // Separate blocks
    }

    console.log(
      `Processed ${pathsIncludedInContext.length} files successfully`,
    );
    return { contextPrefix, pathsIncludedInContext };
  }
}
