// src/lib/litechat/vfs-git-operations.ts
import { fs } from "@zenfs/core";
import { toast } from "sonner";
import {
  joinPath,
  normalizePath,
  basename,
  dirname,
} from "./file-manager-utils";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { useSettingsStore } from "@/store/settings.store";

// --- Constants ---
const CORS_PROXY = "https://cors.isomorphic-git.org"; // Consider making this configurable

// --- Session Credentials Store (Simple In-Memory) ---
// NOTE: This is VERY basic and resets on page reload.
const sessionCredentials = new Map<
  string,
  { username?: string; password?: string }
>();

// --- Helper Functions ---

/**
 * Ensures Git user name and email are configured for the repository directory.
 * Reads from global settings and sets if necessary.
 * @param dir The repository directory path.
 * @returns True if configuration is successful or already set, false otherwise.
 */
const ensureGitConfig = async (dir: string): Promise<boolean> => {
  const { gitUserName, gitUserEmail } = useSettingsStore.getState();
  if (!gitUserName || !gitUserEmail) {
    toast.error(
      "Git user name and email must be configured in Settings before committing.",
    );
    return false;
  }
  try {
    // Check current config, set only if different to avoid unnecessary writes
    const currentName = await git
      .getConfig({ fs, dir, path: "user.name" })
      .catch(() => null); // Handle potential error if not set
    const currentEmail = await git
      .getConfig({ fs, dir, path: "user.email" })
      .catch(() => null); // Handle potential error if not set

    if (currentName !== gitUserName) {
      await git.setConfig({
        fs,
        dir,
        path: "user.name",
        value: gitUserName,
      });
    }
    if (currentEmail !== gitUserEmail) {
      await git.setConfig({
        fs,
        dir,
        path: "user.email",
        value: gitUserEmail,
      });
    }
    return true;
  } catch (err) {
    console.error("[VFS Git Op] Error checking/setting Git config:", err);
    toast.error(
      `Failed to configure Git user: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
};

/**
 * Isomorphic-git authentication callback.
 * Prioritizes provided credentials, then session credentials, then prompts the user.
 * @param url The URL requiring authentication.
 * @param storedCreds Optional credentials passed directly (e.g., from SyncRepo config).
 * @returns Authentication credentials object or null to cancel.
 */
const onAuth = async (
  url: string,
  storedCreds?: { username?: string | null; password?: string | null },
): Promise<any> => {
  const urlOrigin = new URL(url).origin;
  console.log(`[VFS Git Op] Auth requested for ${url}`);

  // 1. Use provided stored credentials if available
  if (storedCreds?.username && storedCreds?.password) {
    console.log(`[VFS Git Op] Using stored credentials for ${url}`);
    return {
      username: storedCreds.username,
      password: storedCreds.password,
      // IMPORTANT: Force basic auth scheme for tokens used as passwords
      // This might be necessary for GitHub PATs, etc.
      // Adjust if other auth methods are needed.
      authScheme: "Basic",
    };
  }

  // 2. Check session credentials
  const sessionCred = sessionCredentials.get(urlOrigin);
  if (sessionCred?.username && sessionCred?.password) {
    console.log(`[VFS Git Op] Using session credentials for ${url}`);
    return {
      username: sessionCred.username,
      password: sessionCred.password,
      authScheme: "Basic", // Assume basic for session too
    };
  }

  // 3. Prompt user if no credentials found
  console.log(
    `[VFS Git Op] No stored or session credentials found for ${url}. Prompting user.`,
  );
  const username = window.prompt(`Enter username for ${url}`);
  if (!username) {
    toast.error("Authentication cancelled: Username not provided.");
    return null; // Cancel auth
  }
  const password = window.prompt(
    `Enter password or token for ${username}@${url}`,
  );
  if (!password) {
    toast.error("Authentication cancelled: Password/token not provided.");
    return null; // Cancel auth
  }

  // Store prompted credentials in session map
  sessionCredentials.set(urlOrigin, { username, password });
  console.log(
    `[VFS Git Op] Stored prompted credentials in session for ${urlOrigin}`,
  );

  return { username, password, authScheme: "Basic" };
};

/**
 * Isomorphic-git authentication failure callback.
 * Clears potentially invalid session credentials.
 * @param url The URL for which authentication failed.
 * @param auth The credentials that failed.
 * @returns Null (indicates failure, no retry credentials provided here).
 */
const onAuthFailure = (url: string, auth: any): any => {
  const urlOrigin = new URL(url).origin;
  console.error(`[VFS Git Op] Auth FAILED for ${url}`, auth);
  // Clear potentially invalid session credentials
  if (sessionCredentials.has(urlOrigin)) {
    console.log(
      `[VFS Git Op] Clearing failed session credentials for ${urlOrigin}`,
    );
    sessionCredentials.delete(urlOrigin);
  }
  // Let the main operation handle the final error toast
  return null; // Indicate failure, don't retry automatically
};

/**
 * Isomorphic-git authentication success callback.
 * Logs success.
 * @param url The URL for which authentication succeeded.
 * @param auth The credentials that succeeded.
 */
const onAuthSuccess = (url: string, auth: any): void => {
  console.log(`[VFS Git Op] Auth SUCCESS for ${url}`, auth);
  // Optionally store successful session credentials if prompted
  const urlOrigin = new URL(url).origin;
  if (!sessionCredentials.has(urlOrigin) && auth.username && auth.password) {
    sessionCredentials.set(urlOrigin, {
      username: auth.username,
      password: auth.password,
    });
    console.log(
      `[VFS Git Op] Stored successful prompted credentials in session for ${urlOrigin}`,
    );
  }
};

/**
 * Formats Git HTTP errors for better user feedback.
 * @param error The error object, potentially an HttpError from isomorphic-git.
 * @returns A formatted error string.
 */
const formatGitHttpError = (error: any): string => {
  if (error.name === "HttpError" && error.data) {
    const { statusCode, statusMessage, body } = error.data;
    let details = "";
    if (body) {
      try {
        // Attempt to parse as JSON first
        const parsedBody = JSON.parse(body);
        details =
          parsedBody.message || parsedBody.error || JSON.stringify(parsedBody);
      } catch {
        // Fallback to plain text if not JSON
        details = body;
      }
    }
    return `HTTP ${statusCode} ${statusMessage}${details ? `: ${details}` : ""}`;
  }
  // Handle NotFoundError specifically
  if (error.name === "NotFoundError") {
    return `Not Found: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
};

// --- Exported Git Operations ---

/**
 * Checks if a directory is a Git repository by looking for a .git subdirectory.
 * @param path The directory path to check.
 * @returns True if it's a Git repository, false otherwise.
 */
export const isGitRepoOp = async (path: string): Promise<boolean> => {
  const normalized = normalizePath(path);
  const gitDirPath = joinPath(normalized, ".git");
  try {
    const stats = await fs.promises.stat(gitDirPath);
    return stats.isDirectory();
  } catch (err: unknown) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      return false; // .git directory doesn't exist
    }
    // Log other errors but return false
    console.error(
      `[VFS Git Op] Error checking for .git in ${normalized}:`,
      err,
    );
    return false;
  }
};

/**
 * Clones a Git repository into the specified target path and checks out the specified branch.
 * @param targetPath The directory path where the repo folder will be created/cloned into.
 * @param url The URL of the repository to clone.
 * @param branch The branch name to clone and checkout. Defaults to remote's default if not provided.
 * @param credentials Optional authentication credentials.
 * @throws Throws an error if cloning fails.
 */
export const gitCloneOp = async (
  targetPath: string, // This is the directory *for* the repo, e.g., /synced_repos/repoId
  url: string,
  branch?: string, // Branch is now optional, will use remote default if omitted
  credentials?: { username?: string | null; password?: string | null },
): Promise<void> => {
  const dir = normalizePath(targetPath); // Use targetPath directly as 'dir'
  console.log(`[VFS Git Op] Attempting to clone ${url} into ${dir}`);

  try {
    // Check if the target directory *already contains* a .git directory
    let isAlreadyCloned = false;
    try {
      await fs.promises.stat(joinPath(dir, ".git"));
      isAlreadyCloned = true;
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e; // Rethrow unexpected stat errors
    }

    if (isAlreadyCloned) {
      // If .git exists, the repo is already there. Maybe pull instead?
      // For now, we throw a specific error indicating it's already cloned.
      // The calling logic (initializeOrSyncRepoLogic) should handle this.
      console.warn(
        `[VFS Git Op] Clone target ${dir} already contains a .git directory.`,
      );
      throw new Error(`Repository already cloned at ${dir}.`);
    }

    // Ensure the parent directory exists before cloning into 'dir'
    const parentDir = dirname(dir);
    if (parentDir !== "/") {
      try {
        await fs.promises.mkdir(parentDir, { recursive: true });
      } catch (mkdirErr: any) {
        if (mkdirErr.code !== "EEXIST") throw mkdirErr; // Ignore if parent already exists
      }
    }

    // Determine the branch to checkout
    let branchToCheckout = branch;
    if (!branchToCheckout) {
      // If no branch specified, discover the remote's default branch (HEAD)
      try {
        const remoteInfo = await git.getRemoteInfo({
          http,
          url,
          corsProxy: CORS_PROXY,
          onAuth: (authUrl) => onAuth(authUrl, credentials),
          onAuthFailure,
          onAuthSuccess,
        });
        branchToCheckout = remoteInfo.HEAD?.replace("refs/heads/", ""); // Get default branch name
        if (!branchToCheckout) {
          throw new Error("Could not determine default branch from remote.");
        }
        console.log(
          `[VFS Git Op] No branch specified, using remote default: ${branchToCheckout}`,
        );
      } catch (infoErr) {
        console.error(
          `[VFS Git Op] Failed to get remote info to determine default branch:`,
          infoErr,
        );
        throw new Error(
          `Failed to determine default branch: ${formatGitHttpError(infoErr)}`,
        );
      }
    }

    // Proceed with clone, specifying the determined branch
    await git.clone({
      fs,
      http,
      dir, // Clone directly into the target directory
      corsProxy: CORS_PROXY,
      url,
      ref: branchToCheckout, // Use the determined branch for checkout
      singleBranch: true, // Only clone the specified branch
      depth: 10, // Consider making depth configurable or removing for full history
      onAuth: (authUrl) => onAuth(authUrl, credentials), // Pass credentials
      onAuthFailure,
      onAuthSuccess,
      onProgress: (e) => {
        // Basic progress logging
        if (e.phase === "counting objects" && e.total) {
          console.log(`Clone progress: ${e.phase} ${e.loaded}/${e.total}`);
        } else if (e.phase === "receiving objects" && e.total) {
          console.log(`Clone progress: ${e.phase} ${e.loaded}/${e.total}`);
        } else {
          console.log(`Clone progress: ${e.phase}`);
        }
      },
    });

    // Verify clone success by checking for .git directory *after* clone attempt
    await fs.promises.stat(joinPath(dir, ".git"));

    // Ensure the correct branch is checked out locally after clone
    // Although clone *should* check it out, double-check and fix if needed.
    const currentLocalBranch = await git
      .currentBranch({ fs, dir, fullname: false })
      .catch(() => null);
    if (currentLocalBranch !== branchToCheckout) {
      console.warn(
        `[VFS Git Op] Cloned repo HEAD is at ${currentLocalBranch}, expected ${branchToCheckout}. Checking out...`,
      );
      await git.checkout({
        fs,
        dir,
        ref: branchToCheckout,
      });
    }

    toast.success(
      `Repository cloned successfully into ${dir} (branch: ${branchToCheckout}).`,
    );
    console.log(`[VFS Git Op] Clone successful for ${url}`);
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git clone failed for ${url}:`, err);
    const errorMsg = formatGitHttpError(err);
    // Avoid redundant toast if the error is "already cloned"
    if (!(err instanceof Error && err.message.includes("already cloned"))) {
      toast.error(`Git clone failed: ${errorMsg}`);
    }
    // Attempt cleanup only if the error wasn't "already cloned"
    if (!(err instanceof Error && err.message.includes("already cloned"))) {
      try {
        console.log(`[VFS Git Op] Attempting cleanup of failed clone: ${dir}`);
        await fs.promises.rm(dir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn(
          `[VFS Git Op] Failed cleanup after clone error:`,
          cleanupErr,
        );
      }
    }
    throw err; // Re-throw the original error
  }
};

/**
 * Initializes an empty Git repository in the specified directory.
 * @param path The directory path to initialize.
 * @throws Throws an error if initialization fails.
 */
export const gitInitOp = async (path: string): Promise<void> => {
  const dir = normalizePath(path);
  try {
    await git.init({ fs, dir });
    toast.success(`Initialized empty Git repository in "${basename(dir)}"`);
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git init failed for ${dir}:`, err);
    toast.error(
      `Git init failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

/**
 * Stages all changes (new, modified, deleted) and commits them.
 * @param path The repository directory path.
 * @param message The commit message.
 * @throws Throws an error if commit fails.
 */
export const gitCommitOp = async (
  path: string,
  message: string,
): Promise<void> => {
  const dir = normalizePath(path);
  try {
    const configOK = await ensureGitConfig(dir);
    if (!configOK) {
      throw new Error("Git user configuration is missing or invalid.");
    }

    // Stage all changes (add new/modified, remove deleted)
    await git.add({ fs, dir, filepath: "." }); // Stage everything tracked/untracked
    // Check status *after* staging everything to see if anything was actually staged
    const status = await git.statusMatrix({ fs, dir });
    const hasStagedChanges = status.some(([, stage]) => stage !== 0); // Check if stage status is non-zero

    if (!hasStagedChanges) {
      toast.info("No changes detected to commit.");
      return;
    }

    const sha = await git.commit({
      fs,
      dir,
      message,
      author: {
        name: useSettingsStore.getState().gitUserName!,
        email: useSettingsStore.getState().gitUserEmail!,
      },
    });
    toast.success(`Changes committed: ${sha.substring(0, 7)}`);
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git commit failed for ${dir}:`, err);
    toast.error(
      `Git commit failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

/**
 * Pulls changes from the remote repository for the specified branch using fetch + merge.
 * Ensures the correct local branch is checked out before merging.
 * @param path The repository directory path.
 * @param branch The branch name to pull (from SyncRepo config).
 * @param credentials Optional authentication credentials.
 * @throws Throws an error if pull fails.
 */
export const gitPullOp = async (
  path: string,
  branch: string, // Branch name from SyncRepo config
  credentials?: { username?: string | null; password?: string | null },
): Promise<void> => {
  const dir = normalizePath(path);
  try {
    const configOK = await ensureGitConfig(dir);
    if (!configOK) {
      throw new Error("Git user configuration is missing or invalid.");
    }
    if (!branch) {
      throw new Error("Branch name must be provided for pull operation.");
    }

    // --- Ensure correct local branch is checked out ---
    const currentLocalBranch = await git
      .currentBranch({ fs, dir, fullname: false })
      .catch(() => null);

    if (currentLocalBranch !== branch) {
      console.log(
        `[VFS Git Op] Current branch is ${currentLocalBranch}, switching to ${branch} before pull...`,
      );
      try {
        await git.checkout({
          fs,
          dir,
          ref: branch,
        });
        console.log(`[VFS Git Op] Successfully checked out branch ${branch}.`);
      } catch (checkoutError: any) {
        // If checkout fails because the local branch doesn't exist, try creating it from remote
        if (checkoutError.code === "NotFoundError") {
          console.log(
            `[VFS Git Op] Local branch ${branch} not found. Attempting to create from origin/${branch}...`,
          );
          try {
            // Fetch first to ensure remote ref exists
            await git.fetch({
              fs,
              http,
              dir,
              corsProxy: CORS_PROXY,
              remote: "origin",
              ref: branch,
              depth: 1,
              singleBranch: true,
              tags: false,
              onAuth: (authUrl) => onAuth(authUrl, credentials),
              onAuthFailure,
              onAuthSuccess,
            });
            // Create local branch pointing to the fetched remote branch
            await git.branch({
              fs,
              dir,
              ref: branch,
              checkout: true, // Checkout after creating
            });
            console.log(
              `[VFS Git Op] Successfully created and checked out local branch ${branch}.`,
            );
          } catch (createBranchError) {
            console.error(
              `[VFS Git Op] Failed to create local branch ${branch} from remote:`,
              createBranchError,
            );
            throw new Error(
              `Failed to switch to or create local branch "${branch}": ${formatGitHttpError(createBranchError)}`,
            );
          }
        } else {
          // Rethrow other checkout errors
          console.error(
            `[VFS Git Op] Failed to checkout branch ${branch}:`,
            checkoutError,
          );
          throw new Error(
            `Failed to checkout branch "${branch}": ${formatGitHttpError(checkoutError)}`,
          );
        }
      }
    }
    // --- End Branch Checkout ---

    console.log(`[VFS Git Op] Fetching ${branch} for ${dir}`);

    // 1. Fetch the configured branch from the remote 'origin'
    await git.fetch({
      fs,
      http,
      dir,
      corsProxy: CORS_PROXY,
      remote: "origin",
      ref: branch, // Use the configured branch name
      depth: 1,
      singleBranch: true,
      tags: false,
      onAuth: (authUrl) => onAuth(authUrl, credentials),
      onAuthFailure,
      onAuthSuccess,
    });

    console.log("[VFS Git Op] Fetch successful.");

    // Check if FETCH_HEAD exists after fetch
    const fetchHeadOid = await git
      .resolveRef({ fs, dir, ref: "FETCH_HEAD" })
      .catch(() => null);
    if (!fetchHeadOid) {
      // This might happen if the branch is already up-to-date or remote branch doesn't exist
      // Let's check the remote ref directly
      try {
        const remoteRef = `refs/remotes/origin/${branch}`;
        const remoteOid = await git.resolveRef({ fs, dir, ref: remoteRef });
        const localOid = await git.resolveRef({ fs, dir, ref: branch });
        if (remoteOid === localOid) {
          toast.info(`Branch "${branch}" is already up-to-date.`);
          console.log(`[VFS Git Op] Branch ${branch} already up-to-date.`);
          return; // Exit successfully
        } else {
          // This case is less likely if fetch succeeded but FETCH_HEAD is missing
          console.warn(
            `[VFS Git Op] FETCH_HEAD missing after fetch, but remote ref ${remoteRef} exists. Proceeding with merge attempt.`,
          );
        }
      } catch (refError) {
        console.error(
          `[VFS Git Op] Error resolving refs after fetch:`,
          refError,
        );
        throw new Error(
          `Could not confirm remote branch "${branch}" state after fetch.`,
        );
      }
    }

    console.log(
      `[VFS Git Op] Merging FETCH_HEAD (${fetchHeadOid}) into ${branch}`,
    );

    // 2. Merge the fetched commit (FETCH_HEAD) into the current branch (which should be `branch`)
    const mergeResult = await git.merge({
      fs,
      dir,
      ours: branch, // Merge into the correct local branch
      theirs: "FETCH_HEAD",
      fastForward: false, // Allow merge commits if necessary
      author: {
        name: useSettingsStore.getState().gitUserName!,
        email: useSettingsStore.getState().gitUserEmail!,
      },
    });

    console.log("[VFS Git Op] Merge result:", mergeResult);

    if (mergeResult.oid) {
      // Check if it was a fast-forward or a merge commit
      const headOid = await git.resolveRef({ fs, dir, ref: "HEAD" });
      if (headOid === fetchHeadOid) {
        toast.success(
          `Pulled and fast-forwarded changes for "${basename(dir)}"`,
        );
        console.log(`[VFS Git Op] Pull/Fast-forward successful for ${dir}`);
      } else {
        toast.success(
          `Pulled and merged changes (merge commit created) for "${basename(dir)}"`,
        );
        console.log(
          `[VFS Git Op] Pull/Merge successful (merge commit) for ${dir}`,
        );
      }
    } else if (mergeResult.alreadyMerged) {
      toast.info(`Branch "${branch}" is already up-to-date.`);
      console.log(`[VFS Git Op] Branch ${branch} already up-to-date.`);
    } else {
      // Merge failed, likely conflicts
      console.error("[VFS Git Op] Merge failed after fetch:", mergeResult);
      throw new Error(
        `Merge failed after fetch. Conflicts likely occurred. Resolve manually.`,
      );
    }
  } catch (err: unknown) {
    console.error(
      `[VFS Git Op] Git pull (fetch/merge) failed for ${dir}:`,
      err,
    );
    toast.error(`Git pull failed: ${formatGitHttpError(err)}`);
    throw err;
  }
};

/**
 * Pushes committed changes from the specified local branch to the corresponding remote branch.
 * @param path The repository directory path.
 * @param branch The local branch name to push (from SyncRepo config).
 * @param credentials Optional authentication credentials.
 * @throws Throws an error if push fails.
 */
export const gitPushOp = async (
  path: string,
  branch: string, // Branch name from SyncRepo config
  credentials?: { username?: string | null; password?: string | null },
): Promise<void> => {
  const dir = normalizePath(path);
  try {
    if (!branch) {
      throw new Error("Branch name must be provided for push operation.");
    }
    console.log(`[VFS Git Op] Pushing local branch ${branch} for ${dir}`);
    const result = await git.push({
      fs,
      http,
      dir,
      corsProxy: CORS_PROXY,
      ref: branch, // Push the specified local branch
      remote: "origin", // Assuming standard remote name
      remoteRef: `refs/heads/${branch}`, // Explicitly target the remote branch
      force: false, // Default to non-force push
      onAuth: (authUrl) => onAuth(authUrl, credentials),
      onAuthFailure,
      onAuthSuccess,
    });

    if (result?.ok) {
      toast.success(`Pushed changes successfully for "${basename(dir)}"`);
    } else {
      // Check for specific "up-to-date" or "rejected" messages
      if (result?.error?.includes("up-to-date")) {
        toast.info(`Branch "${branch}" already up-to-date on remote.`);
      } else if (result?.error?.includes("rejected")) {
        toast.error(
          `Push rejected for "${basename(dir)}". Pull changes first.`,
        );
        throw new Error(result.error); // Re-throw rejection error
      } else {
        throw new Error(result?.error || "Push rejected by remote");
      }
    }
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git push failed for ${dir}:`, err);
    // Avoid double-toasting rejection errors handled above
    if (!(err instanceof Error && err.message.includes("rejected"))) {
      toast.error(`Git push failed: ${formatGitHttpError(err)}`);
    }
    throw err;
  }
};

/**
 * Gets and displays the Git status for the repository.
 * @param path The repository directory path.
 * @throws Throws an error if status check fails.
 */
export const gitStatusOp = async (path: string): Promise<void> => {
  const dir = normalizePath(path);
  console.log(`[VFS Git Op] Git Status on ${dir}`);
  try {
    const status = await git.statusMatrix({ fs, dir });
    console.log("Git Status Matrix:", status);

    // Format status for user display
    const formattedStatus = status
      .map(([filepath, head, workdir, stage]) => {
        // Determine status based on codes (refer to isomorphic-git docs)
        // Head: 0=absent, 1=present
        // Workdir: 0=absent, 1=unmodified, 2=modified
        // Stage: 0=absent, 1=unmodified, 2=modified, 3=added
        let statusText = "";

        // Staging area status
        if (stage === 2) statusText += "INDEX_Modified ";
        if (stage === 3) statusText += "INDEX_Added ";

        // Working directory status
        if (head === 0 && workdir === 2)
          statusText += "WT_New"; // Untracked
        else if (head === 1 && workdir === 2) statusText += "WT_Modified";
        else if (head === 1 && workdir === 0) statusText += "WT_Deleted";
        else if (head === 1 && workdir === 1 && stage === 0)
          statusText = "Unmodified"; // Only show if nothing staged

        // Fallback for unexpected combinations or unmerged states
        if (!statusText || statusText === "INDEX_Unmodified ") {
          statusText = `h:${head} w:${workdir} s:${stage}`;
        }

        return `${filepath}: ${statusText.trim()}`;
      })
      .filter((line) => !line.endsWith("Unmodified")) // Don't show unmodified files
      .join(`
`); // Use newline for readability in toast

    toast.info(
      `Git Status for "${basename(dir)}":
${formattedStatus || "No changes"}`,
      { duration: 15000 }, // Longer duration for status
    );
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git status failed for ${dir}:`, err);
    toast.error(
      `Git status failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

/**
 * Gets the current branch name.
 * @param path The repository directory path.
 * @returns The current branch name.
 * @throws Throws an error if unable to determine the branch.
 */
export const gitCurrentBranchOp = async (path: string): Promise<string> => {
  const dir = normalizePath(path);
  try {
    const branch = await git.currentBranch({ fs, dir, fullname: false });
    if (!branch) {
      throw new Error("Could not determine current branch (Detached HEAD?).");
    }
    toast.info(`Current branch in "${basename(dir)}": ${branch}`);
    return branch;
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git currentBranch failed for ${dir}:`, err);
    toast.error(
      `Failed to get current branch: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

/**
 * Lists local branches in the repository.
 * @param path The repository directory path.
 * @returns An array of local branch names.
 * @throws Throws an error if listing fails.
 */
export const gitListBranchesOp = async (path: string): Promise<string[]> => {
  const dir = normalizePath(path);
  try {
    const branches = await git.listBranches({ fs, dir });
    toast.info(`Local branches in "${basename(dir)}":
${branches.join(", ")}`);
    return branches;
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git listBranches failed for ${dir}:`, err);
    toast.error(
      `Failed to list branches: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

/**
 * Lists configured remotes in the repository.
 * @param path The repository directory path.
 * @returns An array of remote objects containing name and URL.
 * @throws Throws an error if listing fails.
 */
export const gitListRemotesOp = async (
  path: string,
): Promise<{ remote: string; url: string }[]> => {
  const dir = normalizePath(path);
  try {
    const remotes = await git.listRemotes({ fs, dir });
    toast.info(
      `Remotes in "${basename(dir)}":
${remotes.map((r) => `${r.remote}: ${r.url}`).join(`
`)}`,
    );
    return remotes;
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git listRemotes failed for ${dir}:`, err);
    toast.error(
      `Failed to list remotes: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};
