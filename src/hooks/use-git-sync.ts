// src/hooks/use-git-sync.ts
import { useState, useEffect, useCallback } from "react";
import { useVfsStore } from "@/store/vfs.store";
import { GitSyncManager } from "@/utils/git-sync-manager";
import type { DbProject } from "@/lib/types"; // Import DbProject type

// Define a type for the root configuration object
interface RootGitConfig {
  gitRepoEnabled: boolean;
  gitRepoUrl: string;
  gitRepoBranch: string;
}

// Define a type for the author object
interface GitAuthor {
  name: string;
  email: string;
}

export function useGitSync() {
  // Get VFS state from store using selector
  const { isVfsReady, vfsKey, fsInstance } = useVfsStore((s) => ({
    isVfsReady: s.isVfsReady,
    vfsKey: s.vfsKey,
    fsInstance: s.fs, // Get the fs instance from the store
  }));

  const [syncManager, setSyncManager] = useState<GitSyncManager | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // Explicitly type isLoading

  // Effect to initialize GitSyncManager when VFS is ready and fsInstance exists
  useEffect(() => {
    // Check store state for readiness and if fsInstance is available
    if (isVfsReady && fsInstance) {
      // Pass the fs instance and vfsKey from store
      setSyncManager(new GitSyncManager(fsInstance, vfsKey || null));
      console.log("[useGitSync] GitSyncManager initialized.");
    } else {
      setSyncManager(null); // Reset if VFS is not ready or fsInstance is missing
      console.log(
        "[useGitSync] VFS not ready or fsInstance missing, GitSyncManager not initialized.",
      );
    }
  }, [isVfsReady, vfsKey, fsInstance]); // Dependencies: VFS readiness, key, and fs instance

  // --- Wrapped Git Sync Operations ---
  // Use useCallback for stable function references

  const initializeProjectRepo = useCallback(
    async (project: DbProject): Promise<boolean> => {
      if (!syncManager || !project) {
        console.warn(
          "[useGitSync] initializeProjectRepo skipped: SyncManager not ready or project missing.",
        );
        return false;
      }
      setIsLoading(true);
      try {
        // Call the sync manager method
        return await syncManager.initializeProjectRepo(project);
      } finally {
        setIsLoading(false); // Ensure loading state is reset
      }
    },
    [syncManager], // Dependency: syncManager instance
  );

  const initializeRootRepo = useCallback(
    async (rootConfig: RootGitConfig): Promise<boolean> => {
      if (!syncManager || !rootConfig) {
        console.warn(
          "[useGitSync] initializeRootRepo skipped: SyncManager not ready or rootConfig missing.",
        );
        return false;
      }
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
    async (project: DbProject): Promise<boolean> => {
      if (!syncManager || !project) {
        console.warn(
          "[useGitSync] pullProjectChanges skipped: SyncManager not ready or project missing.",
        );
        return false;
      }
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
    async (rootConfig: RootGitConfig): Promise<boolean> => {
      if (!syncManager || !rootConfig) {
        console.warn(
          "[useGitSync] pullRootChanges skipped: SyncManager not ready or rootConfig missing.",
        );
        return false;
      }
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
      project: DbProject,
      message: string,
      author: GitAuthor, // Use defined type
    ): Promise<boolean> => {
      if (!syncManager || !project) {
        console.warn(
          "[useGitSync] commitAndPushProjectChanges skipped: SyncManager not ready or project missing.",
        );
        return false;
      }
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
      rootConfig: RootGitConfig, // Use defined type
      message: string,
      author: GitAuthor, // Use defined type
    ): Promise<boolean> => {
      if (!syncManager || !rootConfig) {
        console.warn(
          "[useGitSync] commitAndPushRootChanges skipped: SyncManager not ready or rootConfig missing.",
        );
        return false;
      }
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

  // Return state and wrapped functions
  return {
    isLoading,
    isInitialized: syncManager !== null, // Expose initialization status
    initializeProjectRepo,
    initializeRootRepo,
    pullProjectChanges,
    pullRootChanges,
    commitAndPushProjectChanges,
    commitAndPushRootChanges,
  };
}
