// src/hooks/use-git.ts
import { useState, useCallback, useEffect } from "react";
import {
  GitUtils,
  GitCommitOptions,
  GitOperationResult,
  GitRepoInfoData,
} from "@/utils/git-utils";
import { toast } from "sonner";
import { fs } from "@zenfs/core"; // Import the global fs instance

/**
 * Custom hook for git operations in the VFS.
 * Provides loading state, initialization status, and wrapped git operations.
 *
 * @param fsInstance The configured ZenFS instance (can be null if not ready).
 */
export function useGit(fsInstance: typeof fs | null) {
  const [loading, setLoading] = useState<boolean>(false);
  const [gitUtils, setGitUtils] = useState<GitUtils | null>(null);

  // Effect to initialize GitUtils when fsInstance becomes available
  useEffect(() => {
    if (fsInstance && typeof fsInstance === "object") {
      // Pass the fsInstance to GitUtils constructor
      setGitUtils(new GitUtils(fsInstance, null)); // Assuming constructor accepts fs
      console.log("[useGit] GitUtils initialized with fs instance.");
    } else {
      setGitUtils(null); // Reset if fsInstance is null
      console.log("[useGit] fsInstance is null, GitUtils not initialized.");
    }
  }, [fsInstance]); // Re-run only when fsInstance changes

  /**
   * Higher-order function to wrap git operations with loading state and error handling.
   */
  const withLoading = useCallback(
    async <T>(
      operation: () => Promise<GitOperationResult<T>>,
    ): Promise<GitOperationResult<T>> => {
      // Check if gitUtils is initialized before proceeding
      if (!gitUtils) {
        const errorMsg =
          "Git functionality is not available (VFS/Git might be initializing).";
        toast.error(errorMsg);
        // Return a consistent error structure
        return {
          success: false,
          message: errorMsg,
        } as GitOperationResult<T>; // Cast needed for generic T
      }

      setLoading(true); // Set loading state
      try {
        const result = await operation(); // Execute the git operation
        // Display toast messages based on the operation result
        if (
          result.success &&
          result.message &&
          !result.message.startsWith("Status retrieved") // Avoid toast for simple status checks
        ) {
          toast.success(result.message);
        } else if (!result.success && result.message) {
          toast.error(result.message);
        }
        return result; // Return the original result
      } catch (error: unknown) {
        // Catch unexpected errors during the operation execution
        console.error("Git operation execution error:", error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error(`Git operation failed: ${errorMessage}`);
        // Return a consistent error structure
        return {
          success: false,
          message: `Git operation failed: ${errorMessage}`,
        } as GitOperationResult<T>; // Cast needed for generic T
      } finally {
        setLoading(false); // Ensure loading state is reset
      }
    },
    [gitUtils], // Dependency on gitUtils instance
  );

  // --- Wrapped Git Operations ---

  const cloneRepository = useCallback(
    (
      url: string,
      dir: string,
      options?: { depth?: number; branch?: string },
    ): Promise<GitOperationResult<void>> => {
      // Ensure gitUtils exists before calling clone
      return withLoading<void>(() => gitUtils!.clone(url, dir, options));
    },
    [gitUtils, withLoading],
  );

  const initRepository = useCallback(
    (dir: string): Promise<GitOperationResult<void>> => {
      return withLoading<void>(() => gitUtils!.init(dir));
    },
    [gitUtils, withLoading],
  );

  const getStatus = useCallback(
    (dir: string, filepath: string): Promise<GitOperationResult<string>> => {
      // Status check might not need the loading wrapper if it's fast/read-only
      if (!gitUtils) {
        console.error("Git utils not initialized for status check");
        const failureResult: GitOperationResult<string> = {
          success: false,
          message: "Git utils not initialized",
        };
        return Promise.resolve(failureResult);
      }
      // Directly call gitUtils status, handle potential errors if needed
      return gitUtils.status(dir, filepath);
    },
    [gitUtils],
  );

  const addFile = useCallback(
    (dir: string, filepath: string): Promise<GitOperationResult<void>> => {
      return withLoading<void>(() => gitUtils!.add(dir, filepath));
    },
    [gitUtils, withLoading],
  );

  const commitChanges = useCallback(
    (
      dir: string,
      options: GitCommitOptions,
    ): Promise<GitOperationResult<{ sha: string }>> => {
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
    ): Promise<GitOperationResult<any>> => {
      // Using 'any' for PushResult type
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
    ): Promise<GitOperationResult<any>> => {
      // Using 'any' for PullResult type
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
    (dir: string): Promise<GitOperationResult<string[]>> => {
      return withLoading<string[]>(() => gitUtils!.listBranches(dir));
    },
    [gitUtils, withLoading],
  );

  const getDiff = useCallback(
    (
      dir: string,
      filepath: string,
    ): Promise<GitOperationResult<{ workingDir: string; head: string }>> => {
      return withLoading<{ workingDir: string; head: string }>(() =>
        gitUtils!.diff(dir, filepath),
      );
    },
    [gitUtils, withLoading],
  );

  const isGitRepository = useCallback(
    async (dir: string): Promise<boolean> => {
      if (!gitUtils) return false; // Return false if not initialized
      // Directly call isGitRepo, assuming it handles its own errors gracefully
      return gitUtils.isGitRepo(dir);
    },
    [gitUtils],
  );

  // Return the hook's state and wrapped functions
  return {
    loading,
    initialized: gitUtils !== null, // Expose initialization status
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
