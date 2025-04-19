import { useState, useCallback, useEffect } from 'react';
import { GitUtils, GitCommitOptions, GitOperationResult } from '@/utils/git-utils';
import { toast } from 'sonner';

/**
 * Custom hook for git operations in the VFS
 * 
 * This hook requires the vfs object from useChatContext to work
 */
export function useGit(vfs: any) {
  const [loading, setLoading] = useState(false);
  const [gitUtils, setGitUtils] = useState<GitUtils | null>(null);
  
  // Initialize the git utils when the VFS is ready
  useEffect(() => {
    if (vfs && vfs.isReady && vfs.fs) {
      setGitUtils(new GitUtils(vfs.fs, vfs.vfsKey));
    } else {
      setGitUtils(null);
    }
  }, [vfs, vfs?.isReady, vfs?.fs, vfs?.vfsKey]);

  // Wraps git operations to handle loading state and toasts
  const withLoading = useCallback(
    async (operation: () => Promise<GitOperationResult>): Promise<GitOperationResult> => {
      if (!gitUtils) {
        toast.error('Git utils not initialized');
        return { success: false, message: 'Git utils not initialized' };
      }
      
      setLoading(true);
      try {
        const result = await operation();
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
        return result;
      } catch (error) {
        console.error('Git operation error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        toast.error(`Git operation failed: ${errorMessage}`);
        return { success: false, message: `Git operation failed: ${errorMessage}` };
      } finally {
        setLoading(false);
      }
    },
    [gitUtils]
  );

  // Git operations exposed to the component
  const cloneRepository = useCallback(
    (url: string, dir: string, options?: { depth?: number; branch?: string }) => {
      return withLoading(() => gitUtils!.clone(url, dir, options));
    },
    [gitUtils, withLoading]
  );

  const initRepository = useCallback(
    (dir: string) => {
      return withLoading(() => gitUtils!.init(dir));
    },
    [gitUtils, withLoading]
  );

  const getStatus = useCallback(
    (dir: string, filepath: string) => {
      return withLoading(() => gitUtils!.status(dir, filepath));
    },
    [gitUtils, withLoading]
  );

  const addFile = useCallback(
    (dir: string, filepath: string) => {
      return withLoading(() => gitUtils!.add(dir, filepath));
    },
    [gitUtils, withLoading]
  );

  const commitChanges = useCallback(
    (dir: string, options: GitCommitOptions) => {
      return withLoading(() => gitUtils!.commit(dir, options));
    },
    [gitUtils, withLoading]
  );

  const pushChanges = useCallback(
    (dir: string, options?: { remote?: string; branch?: string; credentials?: { username: string; password: string } }) => {
      return withLoading(() => gitUtils!.push(dir, options));
    },
    [gitUtils, withLoading]
  );

  const pullChanges = useCallback(
    (dir: string, options?: { remote?: string; branch?: string; credentials?: { username: string; password: string } }) => {
      return withLoading(() => gitUtils!.pull(dir, options));
    },
    [gitUtils, withLoading]
  );

  const getRepoInfo = useCallback(
    (dir: string) => {
      return withLoading(() => gitUtils!.getRepoInfo(dir));
    },
    [gitUtils, withLoading]
  );

  const listBranches = useCallback(
    (dir: string) => {
      return withLoading(() => gitUtils!.listBranches(dir));
    },
    [gitUtils, withLoading]
  );

  const getDiff = useCallback(
    (dir: string, filepath: string) => {
      return withLoading(() => gitUtils!.diff(dir, filepath));
    },
    [gitUtils, withLoading]
  );

  const isGitRepository = useCallback(
    async (dir: string): Promise<boolean> => {
      if (!gitUtils) return false;
      return gitUtils.isGitRepo(dir);
    },
    [gitUtils]
  );

  return {
    loading,
    initialized: gitUtils !== null,
    cloneRepository,
    initRepository,
    getStatus,
    addFile,
    commitChanges,
    pushChanges,
    pullChanges,
    getRepoInfo,
    listBranches,
    getDiff,
    isGitRepository
  };
}