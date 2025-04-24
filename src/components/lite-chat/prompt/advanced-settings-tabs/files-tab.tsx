// src/components/lite-chat/prompt/advanced-settings-tabs/files-tab.tsx
import React, { useEffect } from "react";
import { FileManager } from "@/components/lite-chat/file-manager";
import { Loader2Icon } from "lucide-react";
import { useVfsStore } from "@/store/vfs.store";
import { useShallow } from "zustand/react/shallow";

export const FilesTab: React.FC = () => {
  const {
    isVfsEnabledForItem,
    isVfsReady,
    isVfsLoading,
    vfsError,
    vfsKey,
    initializeVfs,
  } = useVfsStore(
    useShallow((state) => ({
      isVfsEnabledForItem: state.isVfsEnabledForItem,
      isVfsReady: state.isVfsReady,
      isVfsLoading: state.isVfsLoading,
      vfsError: state.vfsError,
      vfsKey: state.vfsKey,
      initializeVfs: state.initializeVfs,
    })),
  );

  // Attempt initialization if needed when tab becomes visible
  useEffect(() => {
    if (isVfsEnabledForItem && !isVfsReady && !isVfsLoading && vfsKey) {
      console.log("[FilesTab] VFS enabled but not ready, triggering init");
      initializeVfs();
    }
  }, [isVfsEnabledForItem, isVfsReady, isVfsLoading, vfsKey, initializeVfs]);

  const showFileManager = isVfsEnabledForItem && isVfsReady;

  return (
    <div className="mt-0">
      {showFileManager ? (
        <FileManager key={vfsKey} /> // Use key to force remount on vfsKey change
      ) : (
        <div className="text-center text-sm text-gray-500 py-8">
          {isVfsEnabledForItem && isVfsLoading ? (
            <>
              <Loader2Icon className="h-4 w-4 mr-2 inline animate-spin" />
              <span>Initializing filesystem...</span>
            </>
          ) : isVfsEnabledForItem && vfsError ? (
            `Error: ${vfsError}`
          ) : !isVfsEnabledForItem ? (
            <>
              Virtual Filesystem is not enabled for the selected item.
              <br />
              Enable it using the toggle in the basic prompt settings area.
            </>
          ) : (
            "Virtual Filesystem is initializing or in an unknown state."
          )}
        </div>
      )}
    </div>
  );
};
