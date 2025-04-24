import { useState, useEffect, useCallback } from "react";


import { useVfsStore } from "@/store/vfs.store";
import { GitSyncManager } from "@/utils/git-sync-manager";
import { fs } from "@zenfs/core";

export function useGitSync() {
  // Get VFS state from store
  const { isVfsReady, vfsKey } = useVfsStore((s) => ({
    isVfsReady: s.isVfsReady,
    vfsKey: s.vfsKey,
  }));
  const [syncManager, setSyncManager] = useState<GitSyncManager | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    // Use store state for readiness check
    if (isVfsReady) {
      // Pass the global fs instance and vfsKey from store
      setSyncManager(new GitSyncManager(fs, vfsKey || null));
    } else {
      setSyncManager(null);
    }
  }, [isVfsReady, vfsKey]);

  // Callbacks remain the same, use local syncManager instance
  const initializeProjectRepo = useCallback(
    async (project: any) => {
      if (!syncManager || !project) return false;
      setIsLoading(true);
      try {
        return await syncManager.initializeProjectRepo(project);
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager],
  );

  const initializeRootRepo = useCallback(
    async (rootConfig: any) => {
      if (!syncManager || !rootConfig) return false;
      setIsLoading(true);
      try {
        return await syncManager.initializeRootRepo(rootConfig);
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager],
  );

  const pullProjectChanges = useCallback(
    async (project: any) => {
      if (!syncManager || !project) return false;
      setIsLoading(true);
      try {
        return await syncManager.pullProjectChanges(project);
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager],
  );

  const pullRootChanges = useCallback(
    async (rootConfig: any) => {
      if (!syncManager || !rootConfig) return false;
      setIsLoading(true);
      try {
        return await syncManager.pullRootChanges(rootConfig);
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager],
  );

  const commitAndPushProjectChanges = useCallback(
    async (
      project: any,
      message: string,
      author: { name: string; email: string },
    ) => {
      if (!syncManager || !project) return false;
      setIsLoading(true);
      try {
        return await syncManager.commitAndPushProjectChanges(
          project,
          message,
          author,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager],
  );

  const commitAndPushRootChanges = useCallback(
    async (
      rootConfig: any,
      message: string,
      author: { name: string; email: string },
    ) => {
      if (!syncManager || !rootConfig) return false;
      setIsLoading(true);
      try {
        return await syncManager.commitAndPushRootChanges(
          rootConfig,
          message,
          author,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager],
  );

  return {
    isLoading,
    isInitialized: syncManager !== null,
    initializeProjectRepo,
    initializeRootRepo,
    pullProjectChanges,
    pullRootChanges,
    commitAndPushProjectChanges,
    commitAndPushRootChanges,
  };
}
