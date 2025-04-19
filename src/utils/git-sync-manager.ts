import { DbProject } from '@/lib/types';
import { GitUtils } from '@/utils/git-utils';
import { toast } from 'sonner';

/**
 * Class to handle syncing between git repositories and the VFS
 */
export class GitSyncManager {
  private fs: any;
  private gitUtils: GitUtils | null = null;

  constructor(fs: any, vfsKey: string | null) {
    this.fs = fs;
    
    if (fs) {
      this.gitUtils = new GitUtils(fs, vfsKey);
    }
  }

  /**
   * Initialize a git repository for a project 
   */
  async initializeProjectRepo(project: DbProject): Promise<boolean> {
    if (!this.gitUtils || !project.gitRepoEnabled || !project.gitRepoUrl) {
      return false;
    }

    try {
      // Check if project path already exists and is a git repo
      const projectPath = `/projects/${project.id}`;
      const isRepo = await this.gitUtils.isGitRepo(projectPath);

      if (isRepo) {
        // Repo already exists, just pull latest changes
        await this.pullProjectChanges(project);
        return true;
      }

      // Create the directory if it doesn't exist
      try {
        const entries = await this.fs.promises.readdir(projectPath);
        // If directory exists and has items, we'll clone into it
        if (entries && entries.length > 0) {
          toast.info('Directory already exists. Will try to clone into it.');
        }
      } catch { // Directory doesn't exist
        // Directory doesn't exist, create it
        await this.fs.promises.mkdir(projectPath, { recursive: true });
      }

      // Clone the repository
      const result = await this.gitUtils.clone(
        project.gitRepoUrl, 
        projectPath, 
        { 
          branch: project.gitRepoBranch || 'main'
        }
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success(`Repository cloned successfully for project ${project.name}`);
      return true;
    } catch (error) {
      console.error('Failed to initialize project repo:', error);
      toast.error(`Failed to initialize git repository: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Initialize a git repository for root conversations
   */
  async initializeRootRepo(rootConfig: { gitRepoEnabled: boolean, gitRepoUrl: string, gitRepoBranch: string }): Promise<boolean> {
    if (!this.gitUtils || !rootConfig.gitRepoEnabled || !rootConfig.gitRepoUrl) {
      return false;
    }

    try {
      // Root conversations are stored in the root of VFS
      const rootPath = '/';
      const isRepo = await this.gitUtils.isGitRepo(rootPath);

      if (isRepo) {
        // Repo already exists, just pull latest changes
        await this.pullRootChanges(rootConfig);
        return true;
      }

      // Clone the repository
      const result = await this.gitUtils.clone(
        rootConfig.gitRepoUrl, 
        rootPath, 
        { 
          branch: rootConfig.gitRepoBranch || 'main'
        }
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success('Root repository initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize root repo:', error);
      toast.error(`Failed to initialize root git repository: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Pull latest changes for a project repository
   */
  async pullProjectChanges(project: DbProject): Promise<boolean> {
    if (!this.gitUtils || !project.gitRepoEnabled) {
      return false;
    }

    try {
      const projectPath = `/projects/${project.id}`;
      const isRepo = await this.gitUtils.isGitRepo(projectPath);

      if (!isRepo) {
        // Not a repo, try to initialize it
        return this.initializeProjectRepo(project);
      }

      // Pull the latest changes
      const result = await this.gitUtils.pull(projectPath);
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success(`Project ${project.name} updated from repository`);
      return true;
    } catch (error) {
      console.error('Failed to pull project changes:', error);
      toast.error(`Failed to pull project changes: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Pull latest changes for the root repository
   */
  async pullRootChanges(rootConfig: { gitRepoEnabled: boolean, gitRepoUrl: string, gitRepoBranch: string }): Promise<boolean> {
    if (!this.gitUtils || !rootConfig.gitRepoEnabled) {
      return false;
    }

    try {
      const rootPath = '/';
      const isRepo = await this.gitUtils.isGitRepo(rootPath);

      if (!isRepo) {
        // Not a repo, try to initialize it
        return this.initializeRootRepo(rootConfig);
      }

      // Pull the latest changes
      const result = await this.gitUtils.pull(rootPath);
      if (!result.success) {
        throw new Error(result.message);
      }

      toast.success('Root repository updated');
      return true;
    } catch (error) {
      console.error('Failed to pull root changes:', error);
      toast.error(`Failed to pull root changes: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Commit and push changes for a project
   */
  async commitAndPushProjectChanges(project: DbProject, message: string, author: { name: string, email: string }): Promise<boolean> {
    if (!this.gitUtils || !project.gitRepoEnabled) {
      return false;
    }

    try {
      const projectPath = `/projects/${project.id}`;
      const isRepo = await this.gitUtils.isGitRepo(projectPath);

      if (!isRepo) {
        throw new Error('Not a git repository');
      }

      // Add all changes
      await this.gitUtils.add(projectPath, '.');

      // Commit changes
      const commitResult = await this.gitUtils.commit(projectPath, {
        message,
        author
      });

      if (!commitResult.success) {
        throw new Error(commitResult.message);
      }

      // Push changes
      const pushResult = await this.gitUtils.push(projectPath);
      if (!pushResult.success) {
        throw new Error(pushResult.message);
      }

      toast.success(`Project ${project.name} changes committed and pushed`);
      return true;
    } catch (error) {
      console.error('Failed to commit and push project changes:', error);
      toast.error(`Failed to commit and push: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Commit and push changes for root repository
   */
  async commitAndPushRootChanges(rootConfig: { gitRepoEnabled: boolean }, message: string, author: { name: string, email: string }): Promise<boolean> {
    if (!this.gitUtils || !rootConfig.gitRepoEnabled) {
      return false;
    }

    try {
      const rootPath = '/';
      const isRepo = await this.gitUtils.isGitRepo(rootPath);

      if (!isRepo) {
        throw new Error('Not a git repository');
      }

      // Add all changes
      await this.gitUtils.add(rootPath, '.');

      // Commit changes
      const commitResult = await this.gitUtils.commit(rootPath, {
        message,
        author
      });

      if (!commitResult.success) {
        throw new Error(commitResult.message);
      }

      // Push changes
      const pushResult = await this.gitUtils.push(rootPath);
      if (!pushResult.success) {
        throw new Error(pushResult.message);
      }

      toast.success('Root repository changes committed and pushed');
      return true;
    } catch (error) {
      console.error('Failed to commit and push root changes:', error);
      toast.error(`Failed to commit and push: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}