# Virtual File System (VFS)

LiteChat implements a browser-based Virtual File System using ZenFS with IndexedDB backend, providing full filesystem functionality without server dependencies. The VFS enables project-specific file storage, Git integration, and seamless file operations entirely within the browser.

## Architecture Overview

### ZenFS Integration
The VFS is built on ZenFS (`@zenfs/core`) with IndexedDB backend (`@zenfs/dom`):

```typescript
// VFS initialization in src/lib/litechat/vfs-operations.ts
export const initializeFsOp = async (vfsKey: string): Promise<typeof fs | null> => {
  try {
    const vfsConf = {
      backend: IndexedDB,
      name: `litechat_vfs_${vfsKey}`,
    };
    await configureSingle(vfsConf);
    return fs;
  } catch (error) {
    console.error(`Failed to initialize VFS for key "${vfsKey}":`, error);
    return null;
  }
};
```

### Context-Based VFS Switching
The VFS operates with different contexts based on the `vfsKey`:

- **Project VFS**: `vfsKey = projectId` - Project-specific filesystem
- **Orphan VFS**: `vfsKey = "orphan"` - Shared filesystem for conversations without projects  
- **Sync VFS**: `vfsKey = "sync_repos"` - Dedicated filesystem for Git repositories

## VFS Store Architecture

The [`VfsStore`](../src/store/vfs.store.ts) manages VFS state and operations:

### State Structure
```typescript
interface VfsState {
  nodes: Record<string, VfsNode>;           // File/folder tree
  childrenMap: Record<string, string[]>;    // Parent-child relationships
  rootId: string | null;                    // Root directory node ID
  currentParentId: string | null;           // Current directory
  selectedFileIds: Set<string>;             // Selected files for operations
  loading: boolean;                         // General loading state
  operationLoading: boolean;                // File operation loading
  error: string | null;                     // Error state
  fs: typeof fs | null;                     // ZenFS instance
  enableVfs: boolean;                       // Global VFS enable/disable
  vfsKey: string | null;                    // Desired VFS context
  configuredVfsKey: string | null;          // Currently active VFS context
  initializingKey: string | null;           // VFS being initialized
}
```

### VFS Node Types
```typescript
interface VfsNodeBase {
  id: string;
  parentId: string | null;
  name: string;
  path: string;
  createdAt: number;
  lastModified: number;
}

interface VfsFile extends VfsNodeBase {
  type: "file";
  size: number;
  mimeType?: string;
}

interface VfsDirectory extends VfsNodeBase {
  type: "folder";
}

type VfsNode = VfsFile | VfsDirectory;
```

## Context Switching

### Automatic Context Management
The main LiteChat component manages VFS context switching based on UI state:

```typescript
// In LiteChat.tsx - Context switching logic
useEffect(() => {
  // Determine context based on selected item
  let currentProjectId: string | null = null;
  if (selectedItemType === "project") {
    currentProjectId = selectedItemId;
  } else if (selectedItemType === "conversation" && selectedItemId) {
    const conversation = getConversationByIdFromStore(selectedItemId);
    currentProjectId = conversation?.projectId ?? null;
  }

  // Set VFS key based on context
  const targetVfsKey = currentProjectId || "orphan";
  if (vfsKey !== targetVfsKey) {
    emitter.emit(vfsEvent.setVfsKeyRequest, { vfsKey: targetVfsKey });
  }
}, [selectedItemId, selectedItemType]);
```

### VFS Initialization Process
1. **Context Change**: UI determines new VFS context needed
2. **Key Request**: `vfsEvent.setVfsKeyRequest` emitted with new key
3. **Initialization**: VfsStore initializes filesystem for the key
4. **Backend Setup**: ZenFS creates/connects to IndexedDB backend
5. **Tree Loading**: File/folder tree loaded for the context
6. **UI Update**: File manager displays context-specific files

## File Operations

### Core VFS Operations
All file operations are implemented in [`src/lib/litechat/vfs-operations.ts`](../src/lib/litechat/vfs-operations.ts):

#### Directory Operations
```typescript
// Create directory with recursive parent creation
export const createDirectoryOp = async (
  path: string,
  options?: { fsInstance?: typeof fs }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  const normalized = normalizePath(path);
  await fsToUse.promises.mkdir(normalized, { recursive: true });
};

// List directory contents
export const listFilesOp = async (
  path: string = "/",
  options?: { fsInstance?: typeof fs }
): Promise<FileSystemEntry[]> => {
  const fsToUse = options?.fsInstance ?? fs;
  const files = await fsToUse.promises.readdir(path, { withFileTypes: true });
  
  return files.map(file => ({
    name: file.name,
    path: joinPath(path, file.name),
    isDirectory: file.isDirectory(),
    size: file.isFile() ? (file as any).size : 0,
    lastModified: new Date((file as any).mtime || Date.now()),
  }));
};
```

#### File Operations
```typescript
// Write file content
export const writeFileOp = async (
  path: string,
  content: ArrayBuffer,
  options?: { fsInstance?: typeof fs }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  const normalized = normalizePath(path);
  
  // Ensure parent directory exists
  const parentDir = dirname(normalized);
  if (parentDir !== "/") {
    await createDirectoryRecursive(parentDir, options);
  }
  
  await fsToUse.promises.writeFile(normalized, new Uint8Array(content));
  emitter.emit(vfsEvent.fileWritten, { path: normalized });
};

// Read file content
export const readFileOp = async (
  path: string,
  options?: { fsInstance?: typeof fs }
): Promise<ArrayBuffer> => {
  const fsToUse = options?.fsInstance ?? fs;
  const normalized = normalizePath(path);
  const content = await fsToUse.promises.readFile(normalized);
  emitter.emit(vfsEvent.fileRead, { path: normalized });
  return content.buffer;
};

// Delete file or directory
export const deleteItemOp = async (
  path: string,
  recursive: boolean = false,
  options?: { fsInstance?: typeof fs }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  const normalized = normalizePath(path);
  
  if (recursive) {
    await fsToUse.promises.rm(normalized, { recursive: true, force: true });
  } else {
    const stat = await fsToUse.promises.stat(normalized);
    if (stat.isDirectory()) {
      await fsToUse.promises.rmdir(normalized);
    } else {
      await fsToUse.promises.unlink(normalized);
    }
  }
  
  emitter.emit(vfsEvent.fileDeleted, { path: normalized });
};
```

### Store-Level Operations
VfsStore provides higher-level operations with state management:

```typescript
// Upload files with progress tracking
uploadFiles: async (parentId: string | null, files: FileList) => {
  const { fs: fsInstance, nodes, rootId } = get();
  if (!fsInstance) return;

  set({ operationLoading: true });
  try {
    const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
    const parentPath = parentNode ? parentNode.path : "/";
    
    // Upload all files
    await VfsOps.uploadFilesOp(Array.from(files), parentPath, { fsInstance });
    
    // Refresh directory listing
    await get().fetchNodes(parentId);
  } catch (error) {
    console.error("Failed to upload files:", error);
    set({ error: "Failed to upload one or more files." });
  } finally {
    set({ operationLoading: false });
  }
}

// Create directory with state updates
createDirectory: async (parentId: string | null, name: string) => {
  const { fs: fsInstance, nodes, rootId } = get();
  if (!fsInstance || !name.trim()) return;

  set({ operationLoading: true });
  try {
    const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
    const parentPath = parentNode ? parentNode.path : "/";
    const newPath = buildPath(parentPath, name.trim());

    // Create directory
    await VfsOps.createDirectoryOp(newPath, { fsInstance });

    // Add to state
    const newNode: VfsDirectory = {
      id: nanoid(),
      parentId: parentId,
      name: name.trim(),
      path: newPath,
      type: "folder",
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
    
    get()._addNodes([newNode]);
  } catch (error) {
    console.error("Failed to create directory:", error);
    set({ error: error.message || "Failed to create directory." });
  } finally {
    set({ operationLoading: false });
  }
}
```

## File Management UI

### FileManager Components
The VFS UI is implemented in [`src/components/LiteChat/file-manager/`](../src/components/LiteChat/file-manager/):

#### Core Components
- **FileManager.tsx**: Main container managing VFS state and operations
- **FileManagerToolbar.tsx**: Upload, create folder, and action buttons
- **FileManagerTable.tsx**: File/folder listing with selection and actions
- **FileManagerBreadcrumb.tsx**: Navigation breadcrumb trail

#### Integration with Controls
VFS integrates with the control system through:

```typescript
// VfsControlModule registers file selection UI
export class VfsControlModule implements ControlModule {
  register(modApi: LiteChatModApi): void {
    this.unregisterCallbacks.push(
      modApi.registerPromptControl({
        id: this.id,
        status: () => this.getControlStatus(),
        triggerRenderer: () => 
          React.createElement(VfsControlTrigger, { module: this }),
        getMetadata: () => this.getSelectedFilesMetadata(),
        clearOnSubmit: () => this.clearSelection(),
      })
    );
  }
}
```

### File Selection and Attachment
Files can be selected for attachment to prompts:

```typescript
// File selection state management
selectFile: (fileId: string) => {
  set((state) => {
    state.selectedFileIds.add(fileId);
  });
  emitter.emit(vfsEvent.selectionChanged, {
    selectedFileIds: Array.from(get().selectedFileIds),
  });
},

// Integration with prompt system
getSelectedFilesMetadata: () => {
  const { selectedFileIds, nodes } = get();
  return {
    attachedFiles: Array.from(selectedFileIds).map(id => ({
      source: "vfs",
      id: nodes[id]?.id,
      name: nodes[id]?.name,
      path: nodes[id]?.path,
      type: nodes[id]?.type,
      size: (nodes[id] as VfsFile)?.size,
    }))
  };
}
```

## Git Integration

### Git Operations on VFS
The VFS supports Git operations through `isomorphic-git`:

```typescript
// Git operations in vfs-operations.ts
export const gitInitOp = async (
  repoPath: string,
  options?: { fsInstance?: typeof fs }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  await git.init({ fs: fsToUse, dir: repoPath });
};

export const gitCloneOp = async (
  url: string,
  repoPath: string,
  options?: { 
    fsInstance?: typeof fs;
    username?: string;
    password?: string;
  }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  await git.clone({
    fs: fsToUse,
    http,
    dir: repoPath,
    url,
    onAuth: () => ({
      username: options?.username || "",
      password: options?.password || "",
    }),
  });
};

// Commit changes
export const gitCommitOp = async (
  repoPath: string,
  message: string,
  author: { name: string; email: string },
  options?: { fsInstance?: typeof fs }
): Promise<string> => {
  const fsToUse = options?.fsInstance ?? fs;
  return await git.commit({
    fs: fsToUse,
    dir: repoPath,
    message,
    author,
  });
};
```

### Sync Repository Management
Conversation sync uses the VFS for Git repositories:

```typescript
// Sync workflow using VFS
const syncConversationLogic = async (conversationId: string) => {
  // 1. Switch to sync VFS context
  const syncFs = await VfsStore.getState().initializeVFS("sync_repos", { force: true });
  
  // 2. Ensure repository exists
  const repoPath = `/repo_${syncRepo.id}`;
  await VfsOps.createDirectoryOp(repoPath, { fsInstance: syncFs });
  
  // 3. Export conversation data
  const conversationData = await PersistenceService.exportConversationData(conversationId);
  const jsonContent = JSON.stringify(conversationData, null, 2);
  
  // 4. Write to VFS
  const filePath = `${repoPath}/conversation_${conversationId}.json`;
  await VfsOps.writeFileOp(filePath, new TextEncoder().encode(jsonContent), { fsInstance: syncFs });
  
  // 5. Git operations
  await VfsOps.gitAddOp(repoPath, ".", { fsInstance: syncFs });
  await VfsOps.gitCommitOp(repoPath, `Update conversation ${conversationId}`, author, { fsInstance: syncFs });
  await VfsOps.gitPushOp(repoPath, "origin", "main", credentials, { fsInstance: syncFs });
};
```

## Advanced VFS Features

### Bulk Operations
```typescript
// Bulk file upload with progress
export const uploadFilesOp = async (
  files: File[],
  targetPath: string,
  options?: { fsInstance?: typeof fs }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  
  for (const file of files) {
    const filePath = joinPath(targetPath, file.name);
    const content = await file.arrayBuffer();
    await writeFileOp(filePath, content, { fsInstance: fsToUse });
  }
};

// Bulk delete with confirmation
deleteNodes: async (ids: string[]) => {
  const { fs: fsInstance, nodes } = get();
  if (!fsInstance) return;

  set({ operationLoading: true });
  try {
    const nodesToDelete = ids.map(id => nodes[id]).filter(Boolean);
    for (const node of nodesToDelete) {
      await VfsOps.deleteItemOp(node.path, node.type === "folder", { fsInstance });
    }
    get()._removeNodes(ids);
  } catch (error) {
    console.error("Failed to delete nodes:", error);
    set({ error: "Failed to delete one or more items." });
    // Refresh to get accurate state
    await get().fetchNodes(get().currentParentId);
  } finally {
    set({ operationLoading: false });
  }
}
```

### ZIP Export/Import
```typescript
// Export directory as ZIP
export const exportDirectoryAsZip = async (
  dirPath: string,
  options?: { fsInstance?: typeof fs }
): Promise<Blob> => {
  const fsToUse = options?.fsInstance ?? fs;
  const zip = new JSZip();
  
  const addToZip = async (currentPath: string, zipFolder: JSZip) => {
    const entries = await listFilesOp(currentPath, { fsInstance: fsToUse });
    
    for (const entry of entries) {
      if (entry.isDirectory) {
        const folder = zipFolder.folder(entry.name);
        await addToZip(entry.path, folder);
      } else {
        const content = await readFileOp(entry.path, { fsInstance: fsToUse });
        zipFolder.file(entry.name, content);
      }
    }
  };
  
  await addToZip(dirPath, zip);
  return await zip.generateAsync({ type: "blob" });
};

// Import ZIP to directory
export const importZipToDirectory = async (
  zipFile: File,
  targetPath: string,
  options?: { fsInstance?: typeof fs }
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs;
  const zip = new JSZip();
  const zipContent = await zip.loadAsync(zipFile);
  
  for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
    const fullPath = joinPath(targetPath, relativePath);
    
    if (zipEntry.dir) {
      await createDirectoryOp(fullPath, { fsInstance: fsToUse });
    } else {
      const content = await zipEntry.async("arraybuffer");
      await writeFileOp(fullPath, content, { fsInstance: fsToUse });
    }
  }
};
```

## Performance Optimization

### Lazy Loading
```typescript
// Only load directory contents when needed
fetchNodes: async (parentId: string | null = null) => {
  const { fs: fsInstance, nodes, rootId } = get();
  if (!fsInstance) return;

  // Skip if already loading or wrong context
  if (get().loading || get().configuredVfsKey !== get().vfsKey) {
    return;
  }

  set({ loading: true });
  try {
    const parentNode = parentId ? nodes[parentId] : nodes[rootId || ""];
    const pathToFetch = parentNode ? parentNode.path : "/";
    
    // Fetch only the requested directory
    const fetchedEntries = await VfsOps.listFilesOp(pathToFetch, { fsInstance });
    
    // Efficiently update only changed nodes
    updateNodesFromEntries(fetchedEntries, parentId);
  } finally {
    set({ loading: false });
  }
}
```

### Caching Strategy
```typescript
// Cache frequently accessed paths
const pathCache = new Map<string, FileSystemEntry[]>();

export const listFilesOpCached = async (
  path: string,
  options?: { fsInstance?: typeof fs; useCache?: boolean }
): Promise<FileSystemEntry[]> => {
  const cacheKey = `${options?.fsInstance ? 'custom' : 'default'}:${path}`;
  
  if (options?.useCache && pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey)!;
  }
  
  const result = await listFilesOp(path, options);
  
  if (options?.useCache) {
    pathCache.set(cacheKey, result);
    // Auto-expire cache after 30 seconds
    setTimeout(() => pathCache.delete(cacheKey), 30000);
  }
  
  return result;
};
```

## Error Handling and Recovery

### Graceful Degradation
```typescript
// Fallback when VFS is unavailable
const useVfsOrFallback = () => {
  const { enableVfs, fs: fsInstance, error } = useVfsStore();
  
  if (!enableVfs || !fsInstance || error) {
    // Fall back to regular file input
    return {
      uploadEnabled: false,
      directUploadOnly: true,
      message: error || "VFS temporarily unavailable"
    };
  }
  
  return {
    uploadEnabled: true,
    directUploadOnly: false,
    message: null
  };
};
```

### Recovery Mechanisms
```typescript
// Reset stuck initialization
resetStuckInitialization: () => {
  console.warn("[VfsStore] Force resetting stuck initialization state");
  set({ 
    initializingKey: null, 
    loading: false, 
    operationLoading: false,
    error: null 
  });
},

// Retry failed operations
retryFailedOperation: async (operation: () => Promise<void>) => {
  const maxRetries = 3;
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      await operation();
      break;
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
    }
  }
}
```

The VFS system provides a powerful, browser-based filesystem that enables LiteChat's advanced file management, Git integration, and project organization features while maintaining the privacy-first, client-side architecture.