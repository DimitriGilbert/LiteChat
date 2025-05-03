// src/lib/litechat/vfs-git-operations.ts
// FULL FILE
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
const CORS_PROXY = "https://cors.isomorphic-git.org";

// --- Session Credentials Store ---
const sessionCredentials = new Map<
  string,
  { username?: string; password?: string }
>();

// --- Helper Functions ---

const ensureGitConfig = async (
  dir: string,
  fsInstance: typeof fs,
): Promise<boolean> => {
  const { gitUserName, gitUserEmail } = useSettingsStore.getState();
  if (!gitUserName || !gitUserEmail) {
    toast.error(
      "Git user name and email must be configured in Settings before committing.",
    );
    return false;
  }
  try {
    const currentName = await git
      .getConfig({ fs: fsInstance, dir, path: "user.name" })
      .catch(() => null);
    const currentEmail = await git
      .getConfig({ fs: fsInstance, dir, path: "user.email" })
      .catch(() => null);

    if (currentName !== gitUserName) {
      await git.setConfig({
        fs: fsInstance,
        dir,
        path: "user.name",
        value: gitUserName,
      });
    }
    if (currentEmail !== gitUserEmail) {
      await git.setConfig({
        fs: fsInstance,
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

const onAuth = async (
  url: string,
  storedCreds?: { username?: string | null; password?: string | null },
): Promise<any> => {
  const urlOrigin = new URL(url).origin;
  console.log(`[VFS Git Op] Auth requested for ${url}`);

  if (storedCreds?.username && storedCreds?.password) {
    console.log(`[VFS Git Op] Using stored credentials for ${url}`);
    return {
      username: storedCreds.username,
      password: storedCreds.password,
      authScheme: "Basic",
    };
  }

  const sessionCred = sessionCredentials.get(urlOrigin);
  if (sessionCred?.username && sessionCred?.password) {
    console.log(`[VFS Git Op] Using session credentials for ${url}`);
    return {
      username: sessionCred.username,
      password: sessionCred.password,
      authScheme: "Basic",
    };
  }

  console.log(
    `[VFS Git Op] No stored or session credentials found for ${url}. Prompting user.`,
  );
  const username = window.prompt(`Enter username for ${url}`);
  if (!username) {
    toast.error("Authentication cancelled: Username not provided.");
    return null;
  }
  const password = window.prompt(
    `Enter password or token for ${username}@${url}`,
  );
  if (!password) {
    toast.error("Authentication cancelled: Password/token not provided.");
    return null;
  }

  sessionCredentials.set(urlOrigin, { username, password });
  console.log(
    `[VFS Git Op] Stored prompted credentials in session for ${urlOrigin}`,
  );

  return { username, password, authScheme: "Basic" };
};

const onAuthFailure = (url: string, auth: any): any => {
  const urlOrigin = new URL(url).origin;
  console.error(`[VFS Git Op] Auth FAILED for ${url}`, auth);
  if (sessionCredentials.has(urlOrigin)) {
    console.log(
      `[VFS Git Op] Clearing failed session credentials for ${urlOrigin}`,
    );
    sessionCredentials.delete(urlOrigin);
  }
  return null;
};

const onAuthSuccess = (url: string, auth: any): void => {
  console.log(`[VFS Git Op] Auth SUCCESS for ${url}`, auth);
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

const formatGitHttpError = (error: any): string => {
  if (error.name === "HttpError" && error.data) {
    const { statusCode, statusMessage, body } = error.data;
    let details = "";
    if (body) {
      try {
        const parsedBody = JSON.parse(body);
        details =
          parsedBody.message || parsedBody.error || JSON.stringify(parsedBody);
      } catch {
        details = body;
      }
    }
    return `HTTP ${statusCode} ${statusMessage}${details ? `: ${details}` : ""}`;
  }
  if (error.name === "NotFoundError") {
    return `Not Found: ${error.message}`;
  }
  if (error.code === "CheckoutConflictError") {
    return "Checkout conflict: Local changes would be overwritten.";
  }
  if (error.code === "MergeConflictError") {
    return "Merge conflict: Resolve conflicts manually.";
  }
  return error instanceof Error ? error.message : String(error);
};

// --- Exported Git Operations ---

export const isGitRepoOp = async (
  path: string,
  options?: { fsInstance?: typeof fs },
): Promise<boolean> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const normalized = normalizePath(path);
  const gitDirPath = joinPath(normalized, ".git");
  try {
    const stats = await fsToUse.promises.stat(gitDirPath);
    return stats.isDirectory();
  } catch (err: unknown) {
    if (err instanceof Error && (err as any).code === "ENOENT") {
      return false;
    }
    console.error(
      `[VFS Git Op] Error checking for .git in ${normalized}:`,
      err,
    );
    return false;
  }
};

export const gitCloneOp = async (
  targetPath: string,
  url: string,
  branch?: string,
  credentials?: { username?: string | null; password?: string | null },
  options?: { fsInstance?: typeof fs },
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(targetPath);
  console.log(`[VFS Git Op] Attempting to clone ${url} into ${dir}`);

  try {
    let isAlreadyCloned = false;
    try {
      await fsToUse.promises.stat(joinPath(dir, ".git"));
      isAlreadyCloned = true;
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
    }

    if (isAlreadyCloned) {
      console.warn(
        `[VFS Git Op] Clone target ${dir} already contains a .git directory.`,
      );
      throw new Error(`Repository already cloned at ${dir}.`);
    }

    const parentDir = dirname(dir);
    if (parentDir !== "/") {
      try {
        await fsToUse.promises.mkdir(parentDir, { recursive: true });
      } catch (mkdirErr: any) {
        if (mkdirErr.code !== "EEXIST") throw mkdirErr;
      }
    }

    let branchToCheckout = branch;
    if (!branchToCheckout) {
      try {
        const remoteInfo = await git.getRemoteInfo({
          http,
          url,
          corsProxy: CORS_PROXY,
          onAuth: (authUrl) => onAuth(authUrl, credentials),
          onAuthFailure,
          onAuthSuccess,
        });
        branchToCheckout = remoteInfo.HEAD?.replace("refs/heads/", "");
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

    await git.clone({
      fs: fsToUse,
      http,
      dir,
      corsProxy: CORS_PROXY,
      url,
      ref: branchToCheckout,
      singleBranch: true,
      depth: 10,
      onAuth: (authUrl) => onAuth(authUrl, credentials),
      onAuthFailure,
      onAuthSuccess,
      onProgress: (e) => {
        if (e.phase === "counting objects" && e.total) {
          console.log(`Clone progress: ${e.phase} ${e.loaded}/${e.total}`);
        } else if (e.phase === "receiving objects" && e.total) {
          console.log(`Clone progress: ${e.phase} ${e.loaded}/${e.total}`);
        } else {
          console.log(`Clone progress: ${e.phase}`);
        }
      },
    });

    await fsToUse.promises.stat(joinPath(dir, ".git"));

    const currentLocalBranch = await git
      .currentBranch({ fs: fsToUse, dir, fullname: false })
      .catch(() => null);
    if (currentLocalBranch !== branchToCheckout) {
      console.warn(
        `[VFS Git Op] Cloned repo HEAD is at ${currentLocalBranch}, expected ${branchToCheckout}. Checking out...`,
      );
      await git.checkout({
        fs: fsToUse,
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
    if (!(err instanceof Error && err.message.includes("already cloned"))) {
      toast.error(`Git clone failed: ${errorMsg}`);
    }
    if (!(err instanceof Error && err.message.includes("already cloned"))) {
      try {
        console.log(`[VFS Git Op] Attempting cleanup of failed clone: ${dir}`);
        await fsToUse.promises.rm(dir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.warn(
          `[VFS Git Op] Failed cleanup after clone error:`,
          cleanupErr,
        );
      }
    }
    throw err;
  }
};

export const gitInitOp = async (
  path: string,
  options?: { fsInstance?: typeof fs },
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  try {
    await git.init({ fs: fsToUse, dir });
    toast.success(`Initialized empty Git repository in "${basename(dir)}"`);
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git init failed for ${dir}:`, err);
    toast.error(
      `Git init failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

export const gitCommitOp = async (
  path: string,
  message: string,
  options?: { fsInstance?: typeof fs },
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  try {
    const configOK = await ensureGitConfig(dir, fsToUse);
    if (!configOK) {
      throw new Error("Git user configuration is missing or invalid.");
    }

    await git.add({ fs: fsToUse, dir, filepath: "." });
    const status = await git.statusMatrix({ fs: fsToUse, dir });
    const hasStagedChanges = status.some(([, , stage]) => stage !== 0);

    if (!hasStagedChanges) {
      toast.info("No changes detected to commit.");
      return;
    }

    const sha = await git.commit({
      fs: fsToUse,
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
 * Pulls changes from the remote repository for the specified branch.
 * Uses `git.pull` which handles fetch and merge/rebase internally.
 * @param path The repository directory path.
 * @param branch The branch name to pull (from SyncRepo config).
 * @param credentials Optional authentication credentials.
 * @param options Optional parameters, including fsInstance.
 * @throws Throws an error if pull fails.
 */
export const gitPullOp = async (
  path: string,
  branch: string,
  credentials?: { username?: string | null; password?: string | null },
  options?: { fsInstance?: typeof fs },
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  try {
    const configOK = await ensureGitConfig(dir, fsToUse);
    if (!configOK) {
      throw new Error("Git user configuration is missing or invalid.");
    }
    if (!branch) {
      throw new Error("Branch name must be provided for pull operation.");
    }

    console.log(`[VFS Git Op] Pulling branch ${branch} for ${dir}`);

    // Ensure the target branch exists locally and is checked out
    const currentLocalBranch = await git
      .currentBranch({ fs: fsToUse, dir, fullname: false })
      .catch(() => null);

    if (currentLocalBranch !== branch) {
      console.log(
        `[VFS Git Op] Current branch is ${currentLocalBranch}, switching to ${branch} before pull...`,
      );
      try {
        // Try checking out existing local branch
        await git.checkout({ fs: fsToUse, dir, ref: branch });
      } catch (checkoutError: any) {
        // If checkout fails because local branch doesn't exist, try creating it from remote
        if (checkoutError.code === "NotFoundError") {
          console.log(
            `[VFS Git Op] Local branch ${branch} not found. Attempting to fetch and create...`,
          );
          try {
            // Fetch the specific branch first to ensure remote ref exists
            await git.fetch({
              fs: fsToUse,
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
              fs: fsToUse,
              dir,
              ref: branch,
              checkout: true,
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

    // Now perform the pull operation on the (now checked out) branch
    await git.pull({
      fs: fsToUse,
      http,
      dir,
      ref: branch,
      singleBranch: true,
      author: {
        // Required for potential merge commits
        name: useSettingsStore.getState().gitUserName!,
        email: useSettingsStore.getState().gitUserEmail!,
      },
      corsProxy: CORS_PROXY,
      onAuth: (authUrl) => onAuth(authUrl, credentials),
      onAuthFailure,
      onAuthSuccess,
    });

    toast.success(`Pulled changes successfully for "${basename(dir)}"`);
    console.log(`[VFS Git Op] Pull successful for ${dir}`);
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git pull failed for ${dir}:`, err);
    // Check for "already up-to-date" which isn't an error
    if (
      err instanceof Error &&
      err.message.toLowerCase().includes("already up-to-date")
    ) {
      toast.info(`Branch "${branch}" is already up-to-date.`);
    } else {
      toast.error(`Git pull failed: ${formatGitHttpError(err)}`);
    }
    // Re-throw only if it's not an "already up-to-date" message
    if (
      !(
        err instanceof Error &&
        err.message.toLowerCase().includes("already up-to-date")
      )
    ) {
      throw err;
    }
  }
};

export const gitPushOp = async (
  path: string,
  branch: string,
  credentials?: { username?: string | null; password?: string | null },
  options?: { fsInstance?: typeof fs },
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  try {
    if (!branch) {
      throw new Error("Branch name must be provided for push operation.");
    }
    console.log(`[VFS Git Op] Pushing local branch ${branch} for ${dir}`);
    const result = await git.push({
      fs: fsToUse,
      http,
      dir,
      corsProxy: CORS_PROXY,
      ref: branch,
      remote: "origin",
      remoteRef: `refs/heads/${branch}`,
      force: false,
      onAuth: (authUrl) => onAuth(authUrl, credentials),
      onAuthFailure,
      onAuthSuccess,
    });

    if (result?.ok) {
      toast.success(`Pushed changes successfully for "${basename(dir)}"`);
    } else {
      if (result?.error?.includes("up-to-date")) {
        toast.info(`Branch "${branch}" already up-to-date on remote.`);
      } else if (result?.error?.includes("rejected")) {
        toast.error(
          `Push rejected for "${basename(dir)}". Pull changes first.`,
        );
        throw new Error(result.error);
      } else {
        throw new Error(result?.error || "Push rejected by remote");
      }
    }
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git push failed for ${dir}:`, err);
    if (!(err instanceof Error && err.message.includes("rejected"))) {
      toast.error(`Git push failed: ${formatGitHttpError(err)}`);
    }
    throw err;
  }
};

export const gitStatusOp = async (
  path: string,
  options?: { fsInstance?: typeof fs },
): Promise<void> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  console.log(`[VFS Git Op] Git Status on ${dir}`);
  try {
    const status = await git.statusMatrix({ fs: fsToUse, dir });
    console.log("Git Status Matrix:", status);

    const formattedStatus = status
      .map(([filepath, head, workdir, stage]) => {
        let statusText = "";
        if (stage === 2) statusText += "INDEX_Modified ";
        if (stage === 3) statusText += "INDEX_Added ";
        if (head === 0 && workdir === 2) statusText += "WT_New";
        else if (head === 1 && workdir === 2) statusText += "WT_Modified";
        else if (head === 1 && workdir === 0) statusText += "WT_Deleted";
        else if (head === 1 && workdir === 1 && stage === 0)
          statusText = "Unmodified";
        if (!statusText || statusText === "INDEX_Unmodified ") {
          statusText = `h:${head} w:${workdir} s:${stage}`;
        }
        return `${filepath}: ${statusText.trim()}`;
      })
      .filter((line) => !line.endsWith("Unmodified")).join(`
`);

    toast.info(
      `Git Status for "${basename(dir)}":
${formattedStatus || "No changes"}`,
      { duration: 15000 },
    );
  } catch (err: unknown) {
    console.error(`[VFS Git Op] Git status failed for ${dir}:`, err);
    toast.error(
      `Git status failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  }
};

export const gitCurrentBranchOp = async (
  path: string,
  options?: { fsInstance?: typeof fs },
): Promise<string> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  try {
    const branch = await git.currentBranch({
      fs: fsToUse,
      dir,
      fullname: false,
    });
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

export const gitListBranchesOp = async (
  path: string,
  options?: { fsInstance?: typeof fs },
): Promise<string[]> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  try {
    const branches = await git.listBranches({ fs: fsToUse, dir });
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

export const gitListRemotesOp = async (
  path: string,
  options?: { fsInstance?: typeof fs },
): Promise<{ remote: string; url: string }[]> => {
  const fsToUse = options?.fsInstance ?? fs; // Use provided or global fs
  const dir = normalizePath(path);
  try {
    const remotes = await git.listRemotes({ fs: fsToUse, dir });
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
