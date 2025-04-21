// src/context/vfs-context.tsx
import React, { createContext, useContext, useMemo } from "react";
import { fs } from "@zenfs/core";
import { useVirtualFileSystemManager } from "@/hooks/use-virtual-file-system";
import { useVfsStore } from "@/store/vfs.store"; // Import the store

interface VfsContextProps {
  enableVfs: boolean; // Global config flag
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
  isVfsEnabledForItem: boolean; // State for the currently selected item
  vfs: typeof fs | null; // Provide access to the configured fs instance
  // VFS Operational State (mirrored from store for convenience if needed)
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
  enableVfs = true, // Default to true if not provided
}) => {
  // --- Get state and actions from the Zustand store ---
  // Select all needed state slices and actions
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
  }));

  // --- Initialize the VFS Manager Hook ---
  // This hook manages the ZenFS instance lifecycle based on store state
  // (reads enableVfs, isVfsEnabledForItem, vfsKey from the store internally)
  useVirtualFileSystemManager(); // Call the hook to activate it

  // --- Provide access to the configured fs instance ---
  // Only provide fs if it's ready and enabled for the item
  const vfsInstance = useMemo(() => {
    // Read global enableVfs directly from the prop/default
    // Read item-specific state and readiness from the store
    return enableVfs && isVfsEnabledForItem && isVfsReady ? fs : null;
  }, [enableVfs, isVfsEnabledForItem, isVfsReady]);

  // --- Context Value ---
  // Construct the context value using state and actions from the store
  const value = useMemo(
    () => ({
      enableVfs, // Pass down the global config flag
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
      isVfsEnabledForItem,
      vfs: vfsInstance, // Provide the potentially null fs instance
      isVfsReady,
      isVfsLoading,
      isVfsOperationLoading,
      vfsError,
    }),
    [
      enableVfs,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
      isVfsEnabledForItem,
      vfsInstance,
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
