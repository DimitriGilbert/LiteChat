import { VfsWorkerManager } from "./vfs.worker.manager";
import { useSettingsStore } from "@/store/settings.store";
import type { FileSystemEntry } from "@/types/litechat/vfs";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { vfsEvent } from "@/types/litechat/events/vfs.events";

export class VfsService {
  private static workerManager = VfsWorkerManager.getInstance();

  // VFS Operations
  static async initializeFsOp(vfsKey: string): Promise<any> {
    try {
      return await this.workerManager.initializeFs(vfsKey);
    } catch (error) {
      console.error("VfsService: Error initializing filesystem:", error);
      toast.error(
        `Failed to initialize filesystem "${vfsKey}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async listFilesOp(
    vfsKey: string,
    path: string
  ): Promise<FileSystemEntry[]> {
    try {
      const entries = await this.workerManager.listFilesWithStats(vfsKey, path);
      // Convert from worker format to FileSystemEntry format
      return entries.map((entry: any) => ({
        name: entry.name,
        path: entry.path,
        isDirectory: entry.isDirectory,
        size: entry.size,
        lastModified: entry.mtime,
      }));
    } catch (error) {
      console.error("VfsService: Error listing files:", error);
      toast.error(
        `Error listing files: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async readFileOp(vfsKey: string, path: string): Promise<Uint8Array> {
    try {
      const data = await this.workerManager.readFile(vfsKey, path);
      emitter.emit(vfsEvent.fileRead, { path });
      return data;
    } catch (error) {
      console.error("VfsService: Error reading file:", error);
      const fileName = path.split('/').pop() || path;
      toast.error(
        `Error reading file "${fileName}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async writeFileOp(
    vfsKey: string,
    path: string,
    data: Uint8Array | string
  ): Promise<void> {
    try {
      await this.workerManager.writeFile(vfsKey, path, data);
      emitter.emit(vfsEvent.fileWritten, { path });
    } catch (error) {
      console.error("VfsService: Error writing file:", error);
      const fileName = path.split('/').pop() || path;
      toast.error(
        `Error writing file "${fileName}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async deleteItemOp(
    vfsKey: string,
    path: string,
    recursive: boolean = false
  ): Promise<void> {
    try {
      await this.workerManager.deleteItem(vfsKey, path, recursive);
      emitter.emit(vfsEvent.fileDeleted, { path });
      const fileName = path.split('/').pop() || path;
      toast.success(`"${fileName}" deleted.`);
    } catch (error) {
      console.error("VfsService: Error deleting item:", error);
      const fileName = path.split('/').pop() || path;
      toast.error(
        `Error deleting "${fileName}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async createDirectoryOp(vfsKey: string, path: string): Promise<void> {
    try {
      await this.workerManager.createDirectory(vfsKey, path);
    } catch (error) {
      console.error("VfsService: Error creating directory:", error);
      const dirName = path.split('/').pop() || path;
      toast.error(
        `Error creating directory "${dirName}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async renameOp(
    vfsKey: string,
    oldPath: string,
    newPath: string
  ): Promise<void> {
    try {
      await this.workerManager.rename(vfsKey, oldPath, newPath);
      const oldName = oldPath.split('/').pop() || oldPath;
      const newName = newPath.split('/').pop() || newPath;
      toast.success(`Renamed "${oldName}" to "${newName}"`);
    } catch (error) {
      console.error("VfsService: Error renaming:", error);
      toast.error(
        `Rename failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  // Complex VFS Operations
  static async uploadFilesOp(
    vfsKey: string,
    files: File[],
    targetPath: string
  ): Promise<void> {
    try {
      await this.workerManager.uploadFiles(vfsKey, files, targetPath);
      const fileCount = files.length;
      const dirName = targetPath.split('/').pop() || 'root';
      toast.success(`Successfully uploaded ${fileCount} file(s) to ${dirName}.`);
    } catch (error) {
      console.error("VfsService: Error uploading files:", error);
      toast.error(
        `Upload failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async uploadAndExtractZipOp(
    vfsKey: string,
    file: File,
    targetPath: string
  ): Promise<void> {
    try {
      await this.workerManager.uploadAndExtractZip(vfsKey, file, targetPath);
      const dirName = targetPath.split('/').pop() || 'root';
      toast.success(`ZIP extracted successfully to ${dirName}.`);
    } catch (error) {
      console.error("VfsService: Error uploading and extracting ZIP:", error);
      toast.error(
        `ZIP extraction failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async downloadFileOp(
    vfsKey: string,
    path: string,
    filename?: string
  ): Promise<void> {
    try {
      await this.workerManager.downloadFile(vfsKey, path, filename);
    } catch (error) {
      console.error("VfsService: Error downloading file:", error);
      toast.error(
        `Download failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async downloadAllAsZipOp(
    vfsKey: string,
    filename?: string,
    rootPath: string = "/"
  ): Promise<void> {
    try {
      await this.workerManager.downloadAllAsZip(vfsKey, filename, rootPath);
    } catch (error) {
      console.error("VfsService: Error downloading as ZIP:", error);
      toast.error(
        `ZIP download failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  // Git Operations
  static async isGitRepoOp(vfsKey: string, path: string): Promise<boolean> {
    try {
      return await this.workerManager.isGitRepo(vfsKey, path);
    } catch (error) {
      console.error("VfsService: Error checking git repo:", error);
      return false;
    }
  }

  static async batchCheckGitReposOp(vfsKey: string, paths: string[]): Promise<Record<string, boolean>> {
    try {
      return await this.workerManager.batchCheckGitRepos(vfsKey, paths);
    } catch (error) {
      console.error("VfsService: Error batch checking git repos:", error);
      // Return all false if batch operation fails
      const result: Record<string, boolean> = {};
      paths.forEach(path => result[path] = false);
      return result;
    }
  }

  static async gitInitOp(vfsKey: string, path: string): Promise<void> {
    try {
      await this.workerManager.gitInit(vfsKey, path);
      toast.success(`Git repository initialized at ${path}`);
    } catch (error) {
      console.error("VfsService: Error initializing git repo:", error);
      toast.error(
        `Git init failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async gitCloneOp(
    vfsKey: string,
    targetPath: string,
    url: string,
    branch?: string,
    credentials?: { username?: string | null; password?: string | null }
  ): Promise<void> {
    try {
      const result = await this.workerManager.gitClone(
        vfsKey,
        targetPath,
        url,
        branch,
        credentials
      );
      const dirName = targetPath.split('/').pop() || targetPath;
      toast.success(
        `Repository cloned successfully into ${dirName} (branch: ${result.branch}).`
      );
    } catch (error) {
      console.error("VfsService: Error cloning repository:", error);
      toast.error(
        `Git clone failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async gitPullOp(
    vfsKey: string,
    path: string,
    branch: string,
    credentials?: { username?: string | null; password?: string | null }
  ): Promise<void> {
    try {
      const { gitUserName, gitUserEmail } = useSettingsStore.getState();
      if (!gitUserName || !gitUserEmail) {
        throw new Error(
          "Git user name and email must be configured in Settings before pulling."
        );
      }

      await this.workerManager.gitPull(
        vfsKey,
        path,
        branch,
        { name: gitUserName, email: gitUserEmail },
        credentials
      );
      const dirName = path.split('/').pop() || path;
      toast.success(`Pulled changes successfully for "${dirName}"`);
    } catch (error) {
      console.error("VfsService: Error pulling changes:", error);
      
      // Handle "already up-to-date" case
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("already up-to-date")
      ) {
        toast.info(`Branch "${branch}" is already up-to-date.`);
        return; // Don't throw for this case
      }

      toast.error(
        `Git pull failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async gitPushOp(
    vfsKey: string,
    path: string,
    branch: string,
    credentials?: { username?: string | null; password?: string | null }
  ): Promise<void> {
    try {
      const result = await this.workerManager.gitPush(
        vfsKey,
        path,
        branch,
        credentials
      );
      
      if (result.pushResult?.ok) {
        const dirName = path.split('/').pop() || path;
        toast.success(`Pushed changes successfully for "${dirName}"`);
      } else if (result.pushResult?.error?.includes("up-to-date")) {
        toast.info(`Branch "${branch}" already up-to-date on remote.`);
      } else if (result.pushResult?.error?.includes("rejected")) {
        const dirName = path.split('/').pop() || path;
        toast.error(`Push rejected for "${dirName}". Pull changes first.`);
        throw new Error(result.pushResult.error);
      } else {
        throw new Error(result.pushResult?.error || "Push rejected by remote");
      }
    } catch (error) {
      console.error("VfsService: Error pushing changes:", error);
      if (!(error instanceof Error && error.message.includes("rejected"))) {
        toast.error(
          `Git push failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      throw error;
    }
  }

  static async gitCommitOp(
    vfsKey: string,
    path: string,
    message: string
  ): Promise<void> {
    try {
      const { gitUserName, gitUserEmail } = useSettingsStore.getState();
      if (!gitUserName || !gitUserEmail) {
        throw new Error(
          "Git user name and email must be configured in Settings before committing."
        );
      }

      const result = await this.workerManager.gitCommit(
        vfsKey,
        path,
        message,
        { name: gitUserName, email: gitUserEmail }
      );

      if (result.message === "No changes detected to commit.") {
        toast.info("No changes detected to commit.");
      } else {
        toast.success(`Changes committed: ${result.sha}`);
      }
    } catch (error) {
      console.error("VfsService: Error committing changes:", error);
      toast.error(
        `Git commit failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  static async gitStatusOp(vfsKey: string, path: string): Promise<void> {
    try {
      const result = await this.workerManager.gitStatus(vfsKey, path);
      const dirName = path.split('/').pop() || path;
      toast.info(
        `Git Status for "${dirName}":
${result.status.length > 0 ? result.status.join('\n') : "No changes"}`,
        { duration: 15000 }
      );
    } catch (error) {
      console.error("VfsService: Error getting git status:", error);
      toast.error(
        `Git status failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  // Terminate worker (for cleanup)
  static terminate(): void {
    this.workerManager.terminate();
  }
} 