import { useState, useEffect, useCallback } from 'react';
import { useChatContext } from '@/hooks/use-chat-context';
import { GitSyncManager } from '@/utils/git-sync-manager';

export function useGitSync() {
  const { vfs } = useChatContext();
  const [syncManager, setSyncManager] = useState<GitSyncManager | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize the sync manager when VFS is ready
  useEffect(() => {
    if (vfs && vfs.isReady) {
      setSyncManager(new GitSyncManager(vfs, vfs.vfsKey || null));
    } else {
      setSyncManager(null);
    }
  }, [vfs, vfs?.isReady, vfs?.vfsKey]);

  // Initialize a project repository
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
    [syncManager]
  );

  // Initialize the root repository
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
    [syncManager]
  );

  // Pull latest changes for a project
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
    [syncManager]
  );

  // Pull latest changes for root repository
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
    [syncManager]
  );

  // Commit and push changes for a project
  const commitAndPushProjectChanges = useCallback(
    async (project: any, message: string, author: { name: string; email: string }) => {
      if (!syncManager || !project) return false;
      setIsLoading(true);
      try {
        return await syncManager.commitAndPushProjectChanges(project, message, author);
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager]
  );

  // Commit and push changes for root repository
  const commitAndPushRootChanges = useCallback(
    async (rootConfig: any, message: string, author: { name: string; email: string }) => {
      if (!syncManager || !rootConfig) return false;
      setIsLoading(true);
      try {
        return await syncManager.commitAndPushRootChanges(rootConfig, message, author);
      } finally {
        setIsLoading(false);
      }
    },
    [syncManager]
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