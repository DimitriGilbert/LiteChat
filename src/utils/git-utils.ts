// src/utils/git-utils.ts

/* eslint-disable @typescript-eslint/no-unused-vars */
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";

export interface GitRepoInfoData {
  url: string | null;
  branch: string | null;
  lastCommit: {
    sha: string;
    message: string;
    author: {
      name?: string;
      email?: string;
      timestamp: number;
      timezoneOffset: number;
    };
    date: Date;
  } | null;
}

export interface GitCommitOptions {
  message: string;
  author: {
    name: string;
    email: string;
  };
}

export type GitOperationResult<T = void> = T extends void
  ? { success: true; message: string } | { success: false; message: string }
  :
      | { success: true; message: string; data: T }
      | { success: false; message: string };

interface ReadBlobResult {
  blob: Uint8Array;
  oid: string;
  path: string;
}

/**
 * Git utility class for working with isomorphic-git and the VFS
 */
export class GitUtils {
  private fs: any;

  constructor(fs: any, _: string | null) {
    this.fs = fs;
  }

  /**
   * Clone a git repository into the VFS
   */
  async clone(
    url: string,
    dir: string,
    options: { depth?: number; branch?: string } = {},
  ): Promise<GitOperationResult<void>> {
    try {
      await git.clone({
        fs: this.fs,
        http,
        url,
        dir,
        depth: options.depth || 1,
        singleBranch: true,
        ref: options.branch || "main",
        corsProxy: "https://cors.isomorphic-git.org",
      });
      return {
        success: true,
        message: `Repository cloned successfully into ${dir}`,
      };
    } catch (error) {
      console.error("Clone error:", error);
      return {
        success: false,
        message: `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Initialize a new git repository in the specified directory
   */
  async init(dir: string): Promise<GitOperationResult<void>> {
    try {
      await git.init({ fs: this.fs, dir });
      return {
        success: true,
        message: `Git repository initialized in ${dir}`,
      };
    } catch (error) {
      console.error("Init error:", error);
      return {
        success: false,
        message: `Failed to initialize repository: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get the status of files in a repository
   */
  async status(
    dir: string,
    filepath: string,
  ): Promise<GitOperationResult<string>> {
    try {
      const status = await git.status({ fs: this.fs, dir, filepath });
      return {
        success: true,
        message: `Status retrieved for ${filepath}`,
        data: status,
      };
    } catch (error) {
      console.error("Status error:", error);
      return {
        success: false,
        message: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Add files to the staging area
   */
  async add(dir: string, filepath: string): Promise<GitOperationResult<void>> {
    try {
      await git.add({ fs: this.fs, dir, filepath });
      return {
        success: true,
        message: `Added ${filepath} to staging area`,
      };
    } catch (error) {
      console.error("Add error:", error);
      return {
        success: false,
        message: `Failed to add file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Commit staged changes
   */
  async commit(
    dir: string,
    options: GitCommitOptions,
  ): Promise<GitOperationResult<{ sha: string }>> {
    try {
      const sha = await git.commit({
        fs: this.fs,
        dir,
        message: options.message,
        author: {
          name: options.author.name,
          email: options.author.email,
        },
      });
      return {
        success: true,
        message: `Changes committed successfully`,
        data: { sha },
      };
    } catch (error) {
      console.error("Commit error:", error);
      return {
        success: false,
        message: `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Push commits to remote repository
   */
  // Using 'any' for PushResult structure as it's complex/not directly exported easily
  async push(
    dir: string,
    options: {
      remote?: string;
      branch?: string;
      credentials?: { username: string; password: string };
    } = {},
  ): Promise<GitOperationResult<any>> {
    try {
      const result = await git.push({
        fs: this.fs,
        http,
        dir,
        remote: options.remote || "origin",
        ref: options.branch || "main",
        onAuth: options.credentials ? () => options.credentials : undefined,
        corsProxy: "https://cors.isomorphic-git.org",
      });
      return {
        success: true,
        message: `Changes pushed successfully to ${options.remote || "origin"}/${options.branch || "main"}`,
        data: result,
      };
    } catch (error) {
      console.error("Push error:", error);
      return {
        success: false,
        message: `Failed to push changes: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Pull changes from remote repository
   */
  // Using 'any' for PullResult structure
  async pull(
    dir: string,
    options: {
      remote?: string;
      branch?: string;
      credentials?: { username: string; password: string };
    } = {},
  ): Promise<GitOperationResult<any>> {
    try {
      const result = await git.pull({
        fs: this.fs,
        http,
        dir,
        remote: options.remote || "origin",
        ref: options.branch || "main",
        singleBranch: true, // Often useful with pull
        // Provide default author info for potential merge commits
        author: {
          name: "LiteChat User",
          email: "user@litechat.dev",
        },
        onAuth: options.credentials ? () => options.credentials : undefined,
        corsProxy: "https://cors.isomorphic-git.org",
      });
      return {
        success: true,
        message: `Changes pulled successfully from ${options.remote || "origin"}/${options.branch || "main"}`,
        data: result,
      };
    } catch (error) {
      console.error("Pull error:", error);
      return {
        success: false,
        message: `Failed to pull changes: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get information about a repository
   */
  async getRepoInfo(dir: string): Promise<GitOperationResult<GitRepoInfoData>> {
    try {
      let currentBranch: string | null = null;
      try {
        // Use '?? null' to convert potential undefined to null
        currentBranch =
          (await git.currentBranch({ fs: this.fs, dir, fullname: false })) ??
          null;
      } catch (branchError) {
        console.warn(`Could not get current branch for ${dir}:`, branchError);
        currentBranch = null;
      }

      let remote: string | null = null;
      try {
        // Use '?? null' to convert potential undefined to null
        remote =
          (await git.getConfig({
            fs: this.fs,
            dir,
            path: "remote.origin.url",
          })) ?? null;
      } catch (configError) {
        console.warn(`Could not get remote URL for ${dir}:`, configError);
        remote = null;
      }

      let lastCommitData: GitRepoInfoData["lastCommit"] = null;
      try {
        const log = await git.log({ fs: this.fs, dir, depth: 1 });
        if (log.length > 0) {
          const lastCommitEntry = log[0];
          lastCommitData = {
            sha: lastCommitEntry.oid,
            message: lastCommitEntry.commit.message,
            author: lastCommitEntry.commit.author,
            date: new Date(lastCommitEntry.commit.author.timestamp * 1000),
          };
        }
      } catch (logError) {
        console.warn(`Could not get commit log for ${dir}:`, logError);
        lastCommitData = null;
      }

      return {
        success: true,
        message: "Repository information retrieved",
        data: {
          url: remote,
          branch: currentBranch,
          lastCommit: lastCommitData,
        },
      };
    } catch (error) {
      console.error("Getting repo info error:", error);
      return {
        success: false,
        message: `Failed to get repository information: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * List all branches in the repository
   */
  async listBranches(dir: string): Promise<GitOperationResult<string[]>> {
    try {
      const branches = await git.listBranches({ fs: this.fs, dir });
      return {
        success: true,
        message: "Branches listed successfully",
        data: branches,
      };
    } catch (error) {
      console.error("List branches error:", error);
      return {
        success: false,
        message: `Failed to list branches: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get the diff between working directory and HEAD
   */
  async diff(
    dir: string,
    filepath: string,
  ): Promise<GitOperationResult<{ workingDir: string; head: string }>> {
    try {
      const workingDirContent = await this.fs.promises.readFile(
        `${dir}/${filepath}`,
        { encoding: "utf8" },
      );
      let headContent = "";
      try {
        const readResult = (await git.readBlob({
          fs: this.fs,
          dir,
          oid: "HEAD",
          filepath,
        })) as ReadBlobResult;
        headContent = new TextDecoder().decode(readResult.blob);
      } catch (_) {
        headContent = "";
      }
      return {
        success: true,
        message: "Diff generated successfully",
        data: {
          workingDir: workingDirContent,
          head: headContent,
        },
      };
    } catch (error) {
      console.error("Diff error:", error);
      return {
        success: false,
        message: `Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepo(dir: string): Promise<boolean> {
    try {
      await this.fs.promises.stat(`${dir}/.git`);
      return true;
    } catch (_) {
      return false;
    }
  }
}
