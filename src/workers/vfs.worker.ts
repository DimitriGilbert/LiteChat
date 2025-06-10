import * as VfsOps from "@/lib/litechat/vfs-operations";
import * as GitOps from "@/lib/litechat/vfs-git-operations";
import { joinPath } from "@/lib/litechat/file-manager-utils";

// Worker message types
export interface VfsWorkerMessage {
  type: string;
  id: string;
  operation: string;
  payload: any;
}

export interface VfsWorkerResponse {
  type: string;
  id: string;
  operation: string;
  payload?: any;
  error?: string;
}

class VfsWorkerService {
  
  private async getVfsInstance(vfsKey: string) {
    const fsInstance = await VfsOps.initializeFsOp(vfsKey);
    if (!fsInstance) throw new Error(`Failed to initialize filesystem for key: ${vfsKey}`);
    return fsInstance;
  }
  
  async handleOperation(message: VfsWorkerMessage): Promise<VfsWorkerResponse> {
    const { id: operationId, operation, payload } = message;

    try {
      let result: any = null;

      switch (operation) {
        // VFS Operations - Import existing functions
        case 'initializeFs':
          const initResult = await VfsOps.initializeFsOp(payload.vfsKey);
          // Don't return the filesystem instance - it's not serializable
          // Just return success/failure indication
          result = initResult !== null;
          break;

        case 'listFiles':
          result = await VfsOps.listFilesOp(payload.path, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'readFile':
          result = await VfsOps.readFileOp(payload.path, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'writeFile':
          result = await VfsOps.writeFileOp(payload.path, payload.data, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'deleteItem':
          result = await VfsOps.deleteItemOp(payload.path, payload.recursive, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'createDirectory':
          result = await VfsOps.createDirectoryOp(payload.path, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'rename':
          result = await VfsOps.renameOp(payload.oldPath, payload.newPath, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'stat':
          const fsForStat = await this.getVfsInstance(payload.vfsKey);
          const statResult = await fsForStat.promises.stat(payload.path);
          // Convert to serializable object since postMessage loses prototype methods
          result = {
            isDirectory: statResult.isDirectory(),
            isFile: statResult.isFile(),
            size: statResult.size,
            mtime: statResult.mtime,
            atime: statResult.atime,
            ctime: statResult.ctime,
            mode: statResult.mode,
            uid: statResult.uid,
            gid: statResult.gid,
            ino: statResult.ino,
            nlink: statResult.nlink,
            rdev: statResult.rdev,
            blksize: statResult.blksize,
            blocks: statResult.blocks
          };
          break;

        case 'readdir':
          const fsForReaddir = await this.getVfsInstance(payload.vfsKey);
          result = await fsForReaddir.promises.readdir(payload.path);
          break;

        case 'mkdir':
          const fsForMkdir = await this.getVfsInstance(payload.vfsKey);
          result = await fsForMkdir.promises.mkdir(payload.path, { recursive: true });
          break;

        case 'rmdir':
          const fsForRmdir = await this.getVfsInstance(payload.vfsKey);
          result = await fsForRmdir.promises.rmdir(payload.path);
          break;

        case 'unlink':
          const fsForUnlink = await this.getVfsInstance(payload.vfsKey);
          result = await fsForUnlink.promises.unlink(payload.path);
          break;

        // Complex VFS Operations
        case 'uploadFiles':
          // Convert serialized files back to File objects for VfsOps
          const files = payload.files.map((fileData: any) => {
            const blob = new Blob([fileData.arrayBuffer]);
            return new File([blob], fileData.name);
          });
          result = await VfsOps.uploadFilesOp(files, payload.targetPath, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'uploadAndExtractZip':
          // Convert serialized file back to File object
          const zipBlob = new Blob([payload.file.arrayBuffer]);
          const zipFile = new File([zipBlob], payload.file.name);
          result = await VfsOps.uploadAndExtractZipOp(zipFile, payload.targetPath, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'downloadFile':
          result = await VfsOps.downloadFileOp(payload.path, payload.filename, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'downloadAllAsZip':
          result = await VfsOps.downloadAllAsZipOp(payload.filename, payload.rootPath, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        // Git Operations - Import existing functions
        case 'gitInit':
          result = await GitOps.gitInitOp(payload.path, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'gitClone':
          result = await GitOps.gitCloneOp(
            payload.targetPath,
            payload.url,
            payload.branch,
            payload.credentials,
            { fsInstance: await this.getVfsInstance(payload.vfsKey) }
          );
          break;

        case 'gitPull':
          result = await GitOps.gitPullOp(
            payload.path,
            payload.branch,
            payload.credentials,
            { fsInstance: await this.getVfsInstance(payload.vfsKey) }
          );
          break;

        case 'gitPush':
          result = await GitOps.gitPushOp(
            payload.path,
            payload.branch,
            payload.credentials,
            { fsInstance: await this.getVfsInstance(payload.vfsKey) }
          );
          break;

        case 'gitCommit':
          result = await GitOps.gitCommitOp(
            payload.path,
            payload.message,
            { fsInstance: await this.getVfsInstance(payload.vfsKey) }
          );
          break;

        case 'gitStatus':
          result = await GitOps.gitStatusOp(payload.path, { 
            fsInstance: await this.getVfsInstance(payload.vfsKey) 
          });
          break;

        case 'isGitRepo':
          const fsInstance = await this.getVfsInstance(payload.vfsKey);
          try {
            const gitDirPath = joinPath(payload.path, ".git");
            const stats = await fsInstance.promises.stat(gitDirPath);
            result = stats.isDirectory();
          } catch (err: unknown) {
            if (err instanceof Error && (err as any).code === "ENOENT") {
              result = false;
            } else {
              throw err;
            }
          }
          break;

        case 'batchCheckGitRepos':
          const fsBatch = await this.getVfsInstance(payload.vfsKey);
          const gitStatusResults: Record<string, boolean> = {};
          
          // Check all paths in one batch Promise.all
          const batchResults = await Promise.all(
            payload.paths.map(async (path: string) => {
              try {
                const gitDirPath = joinPath(path, ".git");
                const stats = await fsBatch.promises.stat(gitDirPath);
                return { path, isRepo: stats.isDirectory() };
              } catch (err: unknown) {
                if (err instanceof Error && (err as any).code === "ENOENT") {
                  return { path, isRepo: false };
                } else {
                  console.error(`[VfsWorker] Error checking git repo for ${path}:`, err);
                  return { path, isRepo: false };
                }
              }
            })
          );
          
          // Convert array to record
          batchResults.forEach(({ path, isRepo }) => {
            gitStatusResults[path] = isRepo;
          });
          
          result = gitStatusResults;
          break;

        case 'listFilesWithStats':
          const fsForList = await this.getVfsInstance(payload.vfsKey);
          try {
            // Use readdir with withFileTypes option to get type info without individual stat calls
            const entries = await fsForList.promises.readdir(payload.path, { withFileTypes: true });
            
            // Process entries without additional stat calls
            result = entries.map((entry: any) => {
              const fullPath = joinPath(payload.path, entry.name);
              return {
                name: entry.name,
                path: fullPath,
                isDirectory: entry.isDirectory(),
                isFile: entry.isFile(),
                size: entry.isFile() ? 0 : 0, // We'll get size lazily if needed
                mtime: new Date(), // Placeholder - IndexedDB doesn't store this efficiently
                atime: new Date(),
                ctime: new Date(),
                mode: entry.isDirectory() ? 16877 : 33188, // Standard directory/file modes
              };
            });
          } catch (err: unknown) {
            if (err instanceof Error && (err as any).code === "ENOENT") {
              // Directory doesn't exist, return empty array
              result = [];
            } else {
              throw err;
            }
          }
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      return {
        type: 'success',
        id: operationId,
        operation: operation,
        payload: result
      };

    } catch (error) {
      console.error(`[VfsWorker] Error in operation ${operation}:`, error);
      return {
        type: 'error',
        id: operationId,
        operation: operation,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

const vfsWorkerService = new VfsWorkerService();

self.onmessage = async (event: MessageEvent<VfsWorkerMessage>) => {
  const response = await vfsWorkerService.handleOperation(event.data);
  self.postMessage(response);
}; 