// src/types/litechat/events/stores/vfs.events.ts
// NEW FILE
export const vfsStoreEvent = {
  // State Change Events
  vfsKeyChanged: "stores.vfs.key.changed", // When the active VFS key (context) changes
  nodesUpdated: "stores.vfs.nodes.updated", // When the file/folder list for the current VFS key is updated
  selectionChanged: "stores.vfs.selection.changed", // When selected files in the VFS manager change
  loadingStateChanged: "stores.vfs.loading.state.changed", // For isLoading, operationLoading, error
  fsInstanceChanged: "stores.vfs.instance.changed", // When the ZenFS instance is set or cleared
  vfsEnabledChanged: "stores.vfs.enabled.changed", // When global VFS enable/disable state changes

  // Original events (can be re-emitted by VFS operations if needed by mods)
  fileWritten: "vfs.fileWritten",
  fileRead: "vfs.fileRead",
  fileDeleted: "vfs.fileDeleted",

  // Action Request Events
  setVfsKeyRequest: "stores.vfs.set.vfs.key.request",
  initializeVFSRequest: "stores.vfs.initialize.vfs.request",
  fetchNodesRequest: "stores.vfs.fetch.nodes.request",
  setCurrentPathRequest: "stores.vfs.set.current.path.request",
  createDirectoryRequest: "stores.vfs.create.directory.request",
  uploadFilesRequest: "stores.vfs.upload.files.request",
  deleteNodesRequest: "stores.vfs.delete.nodes.request",
  renameNodeRequest: "stores.vfs.rename.node.request",
  downloadFileRequest: "stores.vfs.download.file.request",
  selectFileRequest: "stores.vfs.select.file.request",
  deselectFileRequest: "stores.vfs.deselect.file.request",
  clearSelectionRequest: "stores.vfs.clear.selection.request",
  setEnableVfsRequest: "stores.vfs.set.enable.vfs.request",
} as const;
