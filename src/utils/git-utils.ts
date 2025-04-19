/* eslint-disable @typescript-eslint/no-unused-vars */
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';

// Types for git operations
export interface GitRepoInfo {
  url: string;
  branch: string;
  lastCommit?: string;
  lastCommitMessage?: string;
  lastCommitDate?: Date;
}

export interface GitCommitOptions {
  message: string;
  author: {
    name: string;
    email: string;
  };
}

export interface GitOperationResult {
  success: boolean;
  message: string;
  data?: any;
}

interface ReadBlobResult {
  blob: Uint8Array;
  oid: string;
  path: string;
}

/**
 * Git utility class for working with isomorphic-git and the VFS
 */
export class GitUtils {
  private fs: any; // This will be provided by the VFS

  constructor(fs: any, _: string | null) {
    this.fs = fs;
  }

  /**
   * Clone a git repository into the VFS
   */
  async clone(url: string, dir: string, options: { depth?: number; branch?: string } = {}): Promise<GitOperationResult> {
    try {
      const result = await git.clone({
        fs: this.fs,
        http,
        url,
        dir,
        depth: options.depth || 1,
        singleBranch: true,
        ref: options.branch || 'main',
        corsProxy: 'https://cors.isomorphic-git.org'
      });
      
      return {
        success: true,
        message: `Repository cloned successfully to ${dir}`,
        data: result
      };
    } catch (error) {
      console.error('Clone error:', error);
      return {
        success: false,
        message: `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Initialize a new git repository in the specified directory
   */
  async init(dir: string): Promise<GitOperationResult> {
    try {
      await git.init({ fs: this.fs, dir });
      return {
        success: true,
        message: `Git repository initialized in ${dir}`
      };
    } catch (error) {
      console.error('Init error:', error);
      return {
        success: false,
        message: `Failed to initialize repository: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get the status of files in a repository
   */
  async status(dir: string, filepath: string): Promise<GitOperationResult> {
    try {
      const status = await git.status({ fs: this.fs, dir, filepath });
      return {
        success: true,
        message: `Status retrieved for ${filepath}`,
        data: status
      };
    } catch (error) {
      console.error('Status error:', error);
      return {
        success: false,
        message: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Add files to the staging area
   */
  async add(dir: string, filepath: string): Promise<GitOperationResult> {
    try {
      await git.add({ fs: this.fs, dir, filepath });
      return {
        success: true,
        message: `Added ${filepath} to staging area`
      };
    } catch (error) {
      console.error('Add error:', error);
      return {
        success: false,
        message: `Failed to add file: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Commit staged changes
   */
  async commit(dir: string, options: GitCommitOptions): Promise<GitOperationResult> {
    try {
      const sha = await git.commit({
        fs: this.fs,
        dir,
        message: options.message,
        author: {
          name: options.author.name,
          email: options.author.email
        }
      });
      
      return {
        success: true,
        message: `Changes committed successfully`,
        data: { sha }
      };
    } catch (error) {
      console.error('Commit error:', error);
      return {
        success: false,
        message: `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Push commits to remote repository
   */
  async push(dir: string, options: { remote?: string, branch?: string, credentials?: { username: string, password: string } } = {}): Promise<GitOperationResult> {
    try {
      await git.push({
        fs: this.fs,
        http,
        dir,
        remote: options.remote || 'origin',
        ref: options.branch || 'main',
        onAuth: options.credentials ? () => options.credentials : undefined,
        corsProxy: 'https://cors.isomorphic-git.org'
      });
      
      return {
        success: true,
        message: `Changes pushed successfully to ${options.remote || 'origin'}/${options.branch || 'main'}`
      };
    } catch (error) {
      console.error('Push error:', error);
      return {
        success: false,
        message: `Failed to push changes: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Pull changes from remote repository
   */
  async pull(dir: string, options: { remote?: string, branch?: string, credentials?: { username: string, password: string } } = {}): Promise<GitOperationResult> {
    try {
      await git.pull({
        fs: this.fs,
        http,
        dir,
        remote: options.remote || 'origin',
        ref: options.branch || 'main',
        onAuth: options.credentials ? () => options.credentials : undefined,
        corsProxy: 'https://cors.isomorphic-git.org'
      });
      
      return {
        success: true,
        message: `Changes pulled successfully from ${options.remote || 'origin'}/${options.branch || 'main'}`
      };
    } catch (error) {
      console.error('Pull error:', error);
      return {
        success: false,
        message: `Failed to pull changes: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get information about a repository
   */
  async getRepoInfo(dir: string): Promise<GitOperationResult> {
    try {
      // Get the current branch
      const currentBranch = await git.currentBranch({ fs: this.fs, dir });
      
      // Get remote information
      const remote = await git.getConfig({
        fs: this.fs,
        dir,
        path: 'remote.origin.url'
      });
      
      // Get last commit
      const log = await git.log({ fs: this.fs, dir, depth: 1 });
      const lastCommit = log.length > 0 ? log[0] : null;
      
      return {
        success: true,
        message: 'Repository information retrieved',
        data: {
          url: remote || 'No remote configured',
          branch: currentBranch || 'Not on a branch',
          lastCommit: lastCommit ? {
            sha: lastCommit.oid,
            message: lastCommit.commit.message,
            author: lastCommit.commit.author,
            date: new Date(lastCommit.commit.author.timestamp * 1000)
          } : null
        }
      };
    } catch (error) {
      console.error('Getting repo info error:', error);
      return {
        success: false,
        message: `Failed to get repository information: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * List all branches in the repository
   */
  async listBranches(dir: string): Promise<GitOperationResult> {
    try {
      const branches = await git.listBranches({ fs: this.fs, dir });
      return {
        success: true,
        message: 'Branches listed successfully',
        data: branches
      };
    } catch (error) {
      console.error('List branches error:', error);
      return {
        success: false,
        message: `Failed to list branches: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get the diff between working directory and HEAD
   */
  async diff(dir: string, filepath: string): Promise<GitOperationResult> {
    try {
      // Read the file from the working directory
      const workingDirContent = await this.fs.promises.readFile(`${dir}/${filepath}`, { encoding: 'utf8' });
      
      // Get the file content from HEAD
      let headContent = '';
      try {
        const readResult = await git.readBlob({
          fs: this.fs,
          dir,
          oid: 'HEAD',
          filepath
        }) as ReadBlobResult;
        
        headContent = new TextDecoder().decode(readResult.blob);
      } catch (_) {
        // File might not exist in HEAD, that's ok
        headContent = '';
      }
      
      return {
        success: true,
        message: 'Diff generated successfully',
        data: {
          workingDir: workingDirContent,
          head: headContent
        }
      };
    } catch (error) {
      console.error('Diff error:', error);
      return {
        success: false,
        message: `Failed to generate diff: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Check if a directory is a git repository
   */
  async isGitRepo(dir: string): Promise<boolean> {
    try {
      await git.findRoot({ fs: this.fs, filepath: dir });
      return true;
    } catch (_) {
      return false;
    }
  }
}