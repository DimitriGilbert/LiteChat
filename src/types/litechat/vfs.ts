// src/types/litechat/vfs.ts
export interface VfsNodeBase {
  id: string
  parentId: string | null
  name: string;
  path: string
  createdAt: number
  lastModified: number
}

export interface VfsDirectory extends VfsNodeBase {
  type: "folder";
}

export interface VfsFile extends VfsNodeBase {
  type: "file";
  size: number;
  mimeType?: string;
  // Content will be handled by PersistenceService/VFS Ops, not stored directly in state
}

export type VfsNode = VfsDirectory | VfsFile;

// Interface for file content storage (used by PersistenceService/VFS Ops)
export interface VfsFileContent {
  fileId: string
  content: ArrayBuffer
}

// Interface for representing a selected VFS file in the input context
export interface VfsFileObject {
  id: string
  name: string;
  size: number;
  type: string
  path?: string;
}

// Define and export FileSystemEntry based on ZenFS Stat object structure
// This is used by vfs-operations.ts which interacts directly with ZenFS
export interface FileSystemEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: Date;
}

// --- Added Text Detection Logic ---
// Constant removed, import from file-extensions.ts
