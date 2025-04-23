
import { useState, useCallback, useEffect } from "react";
import {
  GitUtils,
  GitCommitOptions,
  GitOperationResult,
  GitRepoInfoData,
} from "@/utils/git-utils";
import { toast } from "sonner";
import { fs } from "@zenfs/core"; // Import fs type

/**
 * Custom hook for git operations in the VFS
 *
 * @param fsInstance The configured ZenFS instance (can be null if not ready).
 */

export function useGit(fsInstance: typeof fs | null) {
  const [loading, setLoading] = useState(false);
  const [gitUtils, setGitUtils] = useState<GitUtils | null>(null);

  useEffect(() => {
    // Initialize GitUtils only when a valid fsInstance is provided
    if (fsInstance && typeof fsInstance === "object") {
      // Pass the fsInstance to GitUtils constructor
      // Assuming GitUtils constructor accepts fs instance
      setGitUtils(new GitUtils(fsInstance, null)); // Pass null for vfsKey for now
      console.log("[useGit] GitUtils initialized with fs instance.");
    } else {
      setGitUtils(null);
      console.log("[useGit] fsInstance is null, GitUtils not initialized.");
    }
  }, [fsInstance]); // Re-run effect when fsInstance changes

  const withLoading = useCallback(
    async <T>(
      operation: () => Promise<GitOperationResult<T>>,
    ): Promise<GitOperationResult<T>> => {
      if (!gitUtils) {
        const errorMsg =
          "Git functionality is not available (VFS/Git might be initializing).";
        toast.error(errorMsg); // Show toast for user feedback
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
        return {
          success: false,
          message: `Git operation failed: ${errorMessage}`,
        } as GitOperationResult<T>;
      } finally {
        setLoading(false);
      }
    },
    [gitUtils], // Depends on gitUtils instance
  );

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
        const failureResult: GitOperationResult<string> = {
          success: false,
          message: "Git utils not initialized",
        };
        return Promise.resolve(failureResult);
      }
      // Assuming gitUtils.status doesn't need withLoading wrapper if it's read-only
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
      // Assuming gitUtils.isGitRepo doesn't need withLoading wrapper
      return gitUtils.isGitRepo(dir);
    },
    [gitUtils],
  );

  return {
    loading,
    initialized: gitUtils !== null, // Based on whether gitUtils is initialized
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
