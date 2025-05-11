// src/types/litechat/events/vfs.events.ts
// FULL FILE
import type { VfsNode } from "@/types/litechat/vfs";
import type { fs as FsType } from "@zenfs/core";

export const vfsEvent = {
  // State Change Events
  vfsKeyChanged: "vfs.key.changed",
  nodesUpdated: "vfs.nodes.updated",
  selectionChanged: "vfs.selection.changed",
  loadingStateChanged: "vfs.loading.state.changed",
  fsInstanceChanged: "vfs.instance.changed",
  vfsEnabledChanged: "vfs.enabled.changed",

  // Original events
  fileWritten: "vfs.sdk.fileWritten",
  fileRead: "vfs.sdk.fileRead",
  fileDeleted: "vfs.sdk.fileDeleted",

  // Action Request Events
  setVfsKeyRequest: "vfs.set.vfs.key.request",
  initializeVFSRequest: "vfs.initialize.vfs.request",
  fetchNodesRequest: "vfs.fetch.nodes.request",
  setCurrentPathRequest: "vfs.set.current.path.request",
  createDirectoryRequest: "vfs.create.directory.request",
  uploadFilesRequest: "vfs.upload.files.request",
  deleteNodesRequest: "vfs.delete.nodes.request",
  renameNodeRequest: "vfs.rename.node.request",
  downloadFileRequest: "vfs.download.file.request",
  selectFileRequest: "vfs.select.file.request",
  deselectFileRequest: "vfs.deselect.file.request",
  clearSelectionRequest: "vfs.clear.selection.request",
  setEnableVfsRequest: "vfs.set.enable.vfs.request",
} as const;

export interface VfsEventPayloads {
  [vfsEvent.vfsKeyChanged]: {
    vfsKey: string | null;
    configuredVfsKey: string | null;
  };
  [vfsEvent.nodesUpdated]: {
    vfsKey: string | null;
    nodes: Record<string, VfsNode>;
    childrenMap: Record<string, string[]>;
  };
  [vfsEvent.selectionChanged]: { selectedFileIds: string[] };
  [vfsEvent.loadingStateChanged]: {
    isLoading: boolean;
    operationLoading: boolean;
    error: string | null;
  };
  [vfsEvent.fsInstanceChanged]: { fsInstance: typeof FsType | null };
  [vfsEvent.vfsEnabledChanged]: { enabled: boolean };
  [vfsEvent.fileWritten]: { path: string };
  [vfsEvent.fileRead]: { path: string };
  [vfsEvent.fileDeleted]: { path: string };
  [vfsEvent.setVfsKeyRequest]: { key: string | null };
  [vfsEvent.initializeVFSRequest]: {
    vfsKey: string;
    options?: { force?: boolean };
  };
  [vfsEvent.fetchNodesRequest]: { parentId?: string | null };
  [vfsEvent.setCurrentPathRequest]: { path: string };
  [vfsEvent.createDirectoryRequest]: { parentId: string | null; name: string };
  [vfsEvent.uploadFilesRequest]: { parentId: string | null; files: FileList };
  [vfsEvent.deleteNodesRequest]: { ids: string[] };
  [vfsEvent.renameNodeRequest]: { id: string; newName: string };
  [vfsEvent.downloadFileRequest]: { fileId: string };
  [vfsEvent.selectFileRequest]: { fileId: string };
  [vfsEvent.deselectFileRequest]: { fileId: string };
  [vfsEvent.clearSelectionRequest]: undefined;
  [vfsEvent.setEnableVfsRequest]: { enabled: boolean };
}
