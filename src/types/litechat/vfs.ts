// src/types/litechat/vfs.ts
export interface VfsNodeBase {
  id: string; // Unique ID (e.g., UUID or path-based hash)
  parentId: string | null; // ID of the parent directory, null for root
  name: string;
  path: string; // Full path for easier querying
  createdAt: number; // Use number (timestamp) for easier IndexedDB indexing/sorting
  lastModified: number; // Use number (timestamp)
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
  fileId: string; // Corresponds to VfsFile.id
  content: ArrayBuffer; // Store content as ArrayBuffer in IndexedDB
}

// Interface for representing a selected VFS file in the input context
export interface VfsFileObject {
  id: string; // VFS Node ID
  name: string;
  size: number;
  type: string; // MIME type
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
