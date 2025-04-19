// src/hooks/use-git.ts
import { useState, useCallback, useEffect } from "react";
import {
  GitUtils,
  GitCommitOptions,
  GitOperationResult,
  GitRepoInfoData,
} from "@/utils/git-utils";
import { toast } from "sonner";

/**
 * Custom hook for git operations in the VFS
 *
 * This hook requires the vfs object from useChatContext to work
 */
export function useGit(fsInstance: any) {
  const [loading, setLoading] = useState(false);
  const [gitUtils, setGitUtils] = useState<GitUtils | null>(null);

  useEffect(() => {
    if (fsInstance && typeof fsInstance === "object") {
      setGitUtils(new GitUtils(fsInstance, null));
    } else {
      setGitUtils(null);
    }
  }, [fsInstance]);

  // Wraps git operations to handle loading state and toasts
  const withLoading = useCallback(
    async <T>(
      operation: () => Promise<GitOperationResult<T>>,
    ): Promise<GitOperationResult<T>> => {
      if (!gitUtils) {
        const errorMsg =
          "Git functionality is not available (VFS might be initializing).";
        // For non-void types we return a different shape according to GitOperationResult
        return {
          success: false,
          message: errorMsg,
        } as GitOperationResult<T>;
      }

      setLoading(true);
      try {
        const result = await operation();
        if (
          result.success &&
          result.message &&
          !result.message.startsWith("Status retrieved")
        ) {
          toast.success(result.message);
        } else if (!result.success && result.message) {
          toast.error(result.message);
        }
        return result;
      } catch (error: unknown) {
        console.error("Git operation execution error:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error(`Git operation failed: ${errorMessage}`);
        
        // Return a properly typed error result
        return {
          success: false,
          message: `Git operation failed: ${errorMessage}`,
        } as GitOperationResult<T>;
      } finally {
        setLoading(false);
      }
    },
    [gitUtils],
  );

  // --- Git Operations ---

  const cloneRepository = useCallback(
    (
      url: string,
      dir: string,
      options?: { depth?: number; branch?: string },
    ) => {
      return withLoading<void>(() => gitUtils!.clone(url, dir, options));
    },
    [gitUtils, withLoading],
  );

  const initRepository = useCallback(
    (dir: string) => {
      return withLoading<void>(() => gitUtils!.init(dir));
    },
    [gitUtils, withLoading],
  );

  const getStatus = useCallback(
    (dir: string, filepath: string) => {
      if (!gitUtils) {
        console.error("Git utils not initialized for status check");
        // For string return type, explicitly typing the failure result
        const failureResult: GitOperationResult<string> = {
          success: false,
          message: "Git utils not initialized",
        };
        return Promise.resolve(failureResult);
      }
      return gitUtils.status(dir, filepath);
    },
    [gitUtils],
  );

  const addFile = useCallback(
    (dir: string, filepath: string) => {
      return withLoading<void>(() => gitUtils!.add(dir, filepath));
    },
    [gitUtils, withLoading],
  );

  const commitChanges = useCallback(
    (dir: string, options: GitCommitOptions) => {
      return withLoading<{ sha: string }>(() => gitUtils!.commit(dir, options));
    },
    [gitUtils, withLoading],
  );

  const pushChanges = useCallback(
    (
      dir: string,
      options?: {
        remote?: string;
        branch?: string;
        credentials?: { username: string; password: string };
      },
    ) => {
      return withLoading<any>(() => gitUtils!.push(dir, options));
    },
    [gitUtils, withLoading],
  );

  const pullChanges = useCallback(
    (
      dir: string,
      options?: {
        remote?: string;
        branch?: string;
        credentials?: { username: string; password: string };
      },
    ) => {
      return withLoading<any>(() => gitUtils!.pull(dir, options));
    },
    [gitUtils, withLoading],
  );

  const getRepoInfo = useCallback(
    (dir: string): Promise<GitOperationResult<GitRepoInfoData>> => {
      return withLoading<GitRepoInfoData>(() => gitUtils!.getRepoInfo(dir));
    },
    [gitUtils, withLoading],
  );

  const listBranches = useCallback(
    (dir: string) => {
      return withLoading<string[]>(() => gitUtils!.listBranches(dir));
    },
    [gitUtils, withLoading],
  );

  const getDiff = useCallback(
    (dir: string, filepath: string) => {
      return withLoading<{ workingDir: string; head: string }>(() =>
        gitUtils!.diff(dir, filepath),
      );
    },
    [gitUtils, withLoading],
  );

  const isGitRepository = useCallback(
    async (dir: string): Promise<boolean> => {
      if (!gitUtils) return false;
      return gitUtils.isGitRepo(dir);
    },
    [gitUtils],
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
    isGitRepository,
  };
}