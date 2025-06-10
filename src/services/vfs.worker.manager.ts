// src/services/vfs.worker.manager.ts
import type { 
  VfsWorkerMessage, 
  VfsWorkerResponse 
} from "@/workers/vfs.worker";
import { nanoid } from "nanoid";

export class VfsWorkerManager {
  private static instance: VfsWorkerManager;
  private worker: Worker | null = null;
  private pendingOperations = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private initialized = false;

  private constructor() {}

  static getInstance(): VfsWorkerManager {
    if (!VfsWorkerManager.instance) {
      VfsWorkerManager.instance = new VfsWorkerManager();
    }
    return VfsWorkerManager.instance;
  }

  private async initializeWorker(): Promise<void> {
    if (this.initialized && this.worker) return;

    try {
      const workerUrl = new URL('../workers/vfs.worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });
      
      this.worker.onmessage = (event: MessageEvent<VfsWorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('[VfsWorkerManager] Worker error:', error);
      };

      this.initialized = true;
      console.log('[VfsWorkerManager] VFS Worker initialized');
    } catch (error) {
      console.error('[VfsWorkerManager] Failed to initialize worker:', error);
      throw error;
    }
  }

  private handleWorkerMessage(response: VfsWorkerResponse): void {
    const { type, id, operation, payload, error } = response;

    console.log(`[VfsWorkerManager] Received response: ${operation} (${type})`, payload);

    const pending = this.pendingOperations.get(id);
    if (!pending) {
      console.warn(`[VfsWorkerManager] No pending operation found for ${id}`);
      return;
    }

    this.pendingOperations.delete(id);

    if (type === 'success') {
      pending.resolve(payload);
    } else {
      pending.reject(new Error(error || 'Unknown VFS error'));
    }
  }

  private async sendOperation(operation: string, payload?: any): Promise<any> {
    await this.initializeWorker();
    
    if (!this.worker) {
      throw new Error('Failed to initialize VFS worker');
    }

    const id = nanoid();
    const message: VfsWorkerMessage = {
      type: 'operation',
      id,
      operation,
      payload
    };

    console.log(`[VfsWorkerManager] Sending operation: ${operation}`, payload);

    return new Promise((resolve, reject) => {
      this.pendingOperations.set(id, { resolve, reject });
      this.worker!.postMessage(message);
    });
  }

  // VFS Operations
  async initializeFs(vfsKey: string): Promise<any> {
    return this.sendOperation('initializeFs', { vfsKey });
  }

  async listFiles(vfsKey: string, path: string): Promise<any[]> {
    return this.sendOperation('listFiles', { vfsKey, path });
  }

  async listFilesWithStats(vfsKey: string, path: string): Promise<any[]> {
    return this.sendOperation('listFilesWithStats', { vfsKey, path });
  }

  async readFile(vfsKey: string, path: string): Promise<Uint8Array> {
    return this.sendOperation('readFile', { vfsKey, path });
  }

  async writeFile(vfsKey: string, path: string, data: Uint8Array | string): Promise<void> {
    return this.sendOperation('writeFile', { vfsKey, path, data });
  }

  async deleteItem(vfsKey: string, path: string, recursive: boolean = false): Promise<void> {
    return this.sendOperation('deleteItem', { vfsKey, path, recursive });
  }

  async createDirectory(vfsKey: string, path: string): Promise<void> {
    return this.sendOperation('createDirectory', { vfsKey, path });
  }

  async rename(vfsKey: string, oldPath: string, newPath: string): Promise<void> {
    return this.sendOperation('rename', { vfsKey, oldPath, newPath });
  }

  // Low-level filesystem operations
  async stat(vfsKey: string, path: string): Promise<any> {
    return this.sendOperation('stat', { vfsKey, path });
  }

  async readdir(vfsKey: string, path: string): Promise<string[]> {
    return this.sendOperation('readdir', { vfsKey, path });
  }

  async mkdir(vfsKey: string, path: string): Promise<void> {
    return this.sendOperation('mkdir', { vfsKey, path });
  }

  async rmdir(vfsKey: string, path: string): Promise<void> {
    return this.sendOperation('rmdir', { vfsKey, path });
  }

  async unlink(vfsKey: string, path: string): Promise<void> {
    return this.sendOperation('unlink', { vfsKey, path });
  }

  // Complex VFS Operations
  async uploadFiles(vfsKey: string, files: File[], targetPath: string): Promise<void> {
    // Convert files to serializable format for worker
    const filesData = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        arrayBuffer: await file.arrayBuffer()
      }))
    );
    return this.sendOperation('uploadFiles', { vfsKey, files: filesData, targetPath });
  }

  async uploadAndExtractZip(vfsKey: string, file: File, targetPath: string): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    return this.sendOperation('uploadAndExtractZip', { 
      vfsKey, 
      file: { name: file.name, arrayBuffer }, 
      targetPath 
    });
  }

  async downloadFile(vfsKey: string, path: string, filename?: string): Promise<void> {
    return this.sendOperation('downloadFile', { vfsKey, path, filename });
  }

  async downloadAllAsZip(vfsKey: string, filename?: string, rootPath: string = "/"): Promise<void> {
    return this.sendOperation('downloadAllAsZip', { vfsKey, filename, rootPath });
  }

  // Git Operations
  async gitInit(vfsKey: string, path: string): Promise<void> {
    return this.sendOperation('gitInit', { vfsKey, path });
  }

  async gitClone(
    vfsKey: string, 
    targetPath: string, 
    url: string, 
    branch?: string,
    credentials?: { username?: string | null; password?: string | null }
  ): Promise<any> {
    return this.sendOperation('gitClone', { vfsKey, targetPath, url, branch, credentials });
  }

  async gitPull(
    vfsKey: string,
    path: string,
    branch: string,
    gitUser: { name: string; email: string },
    credentials?: { username?: string | null; password?: string | null }
  ): Promise<void> {
    return this.sendOperation('gitPull', { vfsKey, path, branch, gitUser, credentials });
  }

  async gitPush(
    vfsKey: string,
    path: string,
    branch: string,
    credentials?: { username?: string | null; password?: string | null }
  ): Promise<any> {
    return this.sendOperation('gitPush', { vfsKey, path, branch, credentials });
  }

  async gitCommit(
    vfsKey: string,
    path: string,
    message: string,
    gitUser: { name: string; email: string }
  ): Promise<any> {
    return this.sendOperation('gitCommit', { vfsKey, path, message, gitUser });
  }

  async gitStatus(vfsKey: string, path: string): Promise<any> {
    return this.sendOperation('gitStatus', { vfsKey, path });
  }

  async isGitRepo(vfsKey: string, path: string): Promise<boolean> {
    return this.sendOperation('isGitRepo', { vfsKey, path });
  }

  async batchCheckGitRepos(vfsKey: string, paths: string[]): Promise<Record<string, boolean>> {
    return this.sendOperation('batchCheckGitRepos', { vfsKey, paths });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      this.pendingOperations.clear();
    }
  }
} 