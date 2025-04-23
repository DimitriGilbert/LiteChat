
import React, { createContext, useContext, useMemo } from "react";
import { fs } from "@zenfs/core";
import { useVfsStore } from "@/store/vfs.store";

interface VfsContextProps {
  enableVfs: boolean;
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
  isVfsEnabledForItem: boolean;
  vfs: typeof fs | null;
  isVfsReady: boolean;
  isVfsLoading: boolean;
  isVfsOperationLoading: boolean;
  vfsError: string | null;
}

const VfsContext = createContext<VfsContextProps | undefined>(undefined);

interface VfsProviderProps {
  children: React.ReactNode;
  enableVfs?: boolean; // Global config flag passed during setup
}

export const VfsProvider: React.FC<VfsProviderProps> = ({
  children,
  enableVfs: configEnableVfs = true, // Default to true if not provided
}) => {
  // Select state needed for context value
  const {
    selectedVfsPaths,
    addSelectedVfsPath,
    removeSelectedVfsPath,
    clearSelectedVfsPaths,
    isVfsEnabledForItem,
    isVfsReady,
    isVfsLoading,
    isVfsOperationLoading,
    vfsError,
    fsInstance,
    globalEnableVfsFromStore,
    _setEnableVfs,
    initializeVfs,
  } = useVfsStore((state) => ({
    selectedVfsPaths: state.selectedVfsPaths,
    addSelectedVfsPath: state.addSelectedVfsPath,
    removeSelectedVfsPath: state.removeSelectedVfsPath,
    clearSelectedVfsPaths: state.clearSelectedVfsPaths,
    isVfsEnabledForItem: state.isVfsEnabledForItem,
    isVfsReady: state.isVfsReady,
    isVfsLoading: state.isVfsLoading,
    isVfsOperationLoading: state.isVfsOperationLoading,
    vfsError: state.vfsError,
    fsInstance: state.fs,
    globalEnableVfsFromStore: state.enableVfs,
    _setEnableVfs: state._setEnableVfs,
    initializeVfs: state.initializeVfs,
  }));

  // Determine the effective global enable flag (config prop overrides store default)
  const effectiveGlobalEnableVfs = configEnableVfs ?? globalEnableVfsFromStore;

  // Ensure the store reflects the config prop if it was provided
  React.useEffect(() => {
    if (
      configEnableVfs !== undefined &&
      configEnableVfs !== globalEnableVfsFromStore
    ) {
      _setEnableVfs(configEnableVfs);
    }

    // Try to initialize VFS if enabled
    if (isVfsEnabledForItem && effectiveGlobalEnableVfs) {
      console.log("[VfsProvider] Attempting to initialize VFS on mount");
      initializeVfs();
    }
  }, [
    configEnableVfs,
    globalEnableVfsFromStore,
    _setEnableVfs,
    isVfsEnabledForItem,
    effectiveGlobalEnableVfs,
    initializeVfs,
  ]);

  // Context value construction
  const value = useMemo(
    () => ({
      enableVfs: effectiveGlobalEnableVfs,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
      isVfsEnabledForItem,
      vfs: fsInstance,
      isVfsReady,
      isVfsLoading,
      isVfsOperationLoading,
      vfsError,
    }),
    [
      effectiveGlobalEnableVfs,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
      isVfsEnabledForItem,
      fsInstance,
      isVfsReady,
      isVfsLoading,
      isVfsOperationLoading,
      vfsError,
    ],
  );

  return <VfsContext.Provider value={value}>{children}</VfsContext.Provider>;
};

export const useVfsContext = (): VfsContextProps => {
  const context = useContext(VfsContext);
  if (context === undefined) {
    throw new Error("useVfsContext must be used within a VfsProvider");
  }
  return context;
};
