// src/context/vfs-context.tsx
import React, { createContext, useContext, useMemo, useEffect } from "react";
import type { VfsContextObject, SidebarItemType } from "@/lib/types";
import { useVirtualFileSystem } from "@/hooks/use-virtual-file-system";
import { useState as useVfsState, useCallback as useVfsCallback } from "react";

const dummyVfs: VfsContextObject = {
  isReady: false,
  isLoading: false,
  isOperationLoading: false,
  error: null,
  configuredVfsKey: null,
  listFiles: async () => {
    console.warn("VFS not enabled/ready");
    return [];
  },
  readFile: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  writeFile: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  deleteItem: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  createDirectory: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  downloadFile: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  uploadFiles: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  uploadAndExtractZip: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  downloadAllAsZip: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  rename: async () => {
    console.warn("VFS not enabled/ready");
    throw new Error("VFS not enabled/ready");
  },
  vfsKey: null,
};

interface VfsContextProps {
  enableVfs: boolean;
  isVfsEnabledForItem: boolean;
  vfs: VfsContextObject;
  selectedVfsPaths: string[];
  addSelectedVfsPath: (path: string) => void;
  removeSelectedVfsPath: (path: string) => void;
  clearSelectedVfsPaths: () => void;
}

const VfsContext = createContext<VfsContextProps | undefined>(undefined);

interface VfsProviderProps {
  children: React.ReactNode;
  enableVfs?: boolean;
  // Dependencies from SidebarContext
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  isVfsEnabledForItem: boolean; // Derived state from SidebarContext
  vfsKey: string | null; // Derived state from SidebarContext
}

export const VfsProvider: React.FC<VfsProviderProps> = ({
  children,
  enableVfs = true,
  selectedItemId,
  selectedItemType,
  isVfsEnabledForItem,
  vfsKey,
}) => {
  // VFS Selection State (for prompt input)
  const [selectedVfsPaths, setSelectedVfsPaths] = useVfsState<string[]>([]);
  const addSelectedVfsPath = useVfsCallback((path: string) => {
    setSelectedVfsPaths((prev) =>
      prev.includes(path) ? prev : [...prev, path].sort(),
    );
  }, []);
  const removeSelectedVfsPath = useVfsCallback((path: string) => {
    setSelectedVfsPaths((prev) => prev.filter((p) => p !== path));
  }, []);
  const clearSelectedVfsPaths = useVfsCallback(() => {
    setSelectedVfsPaths([]);
  }, []);

  // VFS Instance Logic
  const realVfs = useVirtualFileSystem({
    itemId: selectedItemId,
    itemType: selectedItemType,
    isEnabled: isVfsEnabledForItem && !!selectedItemId,
    vfsKey,
  });

  const vfs = useMemo(() => {
    if (enableVfs && isVfsEnabledForItem && selectedItemId) {
      return realVfs;
    }
    return dummyVfs;
  }, [enableVfs, isVfsEnabledForItem, selectedItemId, realVfs]);

  // Effect to clear selection if VFS becomes disabled for the item
  useEffect(() => {
    if (!isVfsEnabledForItem && selectedVfsPaths.length > 0) {
      clearSelectedVfsPaths();
    }
  }, [isVfsEnabledForItem, selectedVfsPaths, clearSelectedVfsPaths]);

  const value = useMemo(
    () => ({
      enableVfs: enableVfs ?? true,
      isVfsEnabledForItem,
      vfs,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
    }),
    [
      enableVfs,
      isVfsEnabledForItem,
      vfs,
      selectedVfsPaths,
      addSelectedVfsPath,
      removeSelectedVfsPath,
      clearSelectedVfsPaths,
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
