// src/controls/modules/GitToolsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  type ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import { useSettingsStore } from "@/store/settings.store";
import { VfsService } from "@/services/vfs.service";
import { VfsWorkerManager } from "@/services/vfs.worker.manager";
import { z } from "zod";
import { Tool } from "ai";

const gitInitSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path within the VFS to initialize as a Git repository."
    ),
});
const gitCommitSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to commit."
    ),
  message: z.string().describe("The commit message."),
});
const gitPullSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to pull from."
    ),
  branch: z.string().optional().describe("The branch name to pull."),
});
const gitPushSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to push."
    ),
  branch: z.string().optional().describe("The branch name to push."),
});
const gitStatusSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to check status."
    ),
});

// Git tools context uses vfsKey to route through VfsService
type ToolContext = ReadonlyChatContextSnapshot & {
  vfsKey?: string;
};

export class GitToolsModule implements ControlModule {
  readonly id = "core-git-tools";
  private unregisterCallbacks: (() => void)[] = [];
  private isInWorker = typeof (globalThis as any).importScripts === 'function';
  private vfsWorkerManager: VfsWorkerManager | null = null;

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // console.log(`[${this.id}] Initialized. Worker context: ${this.isInWorker}`);
    if (this.isInWorker) {
      this.vfsWorkerManager = VfsWorkerManager.getInstance();
    }
  }

  private async performGitOperation(vfsKey: string, operation: string, ...args: any[]): Promise<any> {
    if (this.isInWorker && this.vfsWorkerManager) {
      // Direct worker operations for AI tools running in worker
      switch (operation) {
        case 'gitInit':
          return await this.vfsWorkerManager.gitInit(vfsKey, args[0]);
        case 'gitCommit':
          return await this.vfsWorkerManager.gitCommit(vfsKey, args[0], args[1], args[2]);
        case 'gitPull':
          return await this.vfsWorkerManager.gitPull(vfsKey, args[0], args[1], args[2]);
        case 'gitPush':
          return await this.vfsWorkerManager.gitPush(vfsKey, args[0], args[1]);
        case 'gitStatus':
          return await this.vfsWorkerManager.gitStatus(vfsKey, args[0]);
        default:
          throw new Error(`Unknown Git operation: ${operation}`);
      }
    } else {
      // Use VfsService for UI context operations
      switch (operation) {
        case 'gitInit':
          return await VfsService.gitInitOp(vfsKey, args[0]);
        case 'gitCommit':
          return await VfsService.gitCommitOp(vfsKey, args[0], args[1]);
        case 'gitPull':
          return await VfsService.gitPullOp(vfsKey, args[0], args[1]);
        case 'gitPush':
          return await VfsService.gitPushOp(vfsKey, args[0], args[1]);
        case 'gitStatus':
          return await VfsService.gitStatusOp(vfsKey, args[0]);
        default:
          throw new Error(`Unknown Git operation: ${operation}`);
      }
    }
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    // console.log(`[${this.id}] Registering Core Git Tools...`);

    const gitInitTool: Tool<typeof gitInitSchema> = {
      description: "Initialize an empty Git repository in a VFS directory.",
      parameters: gitInitSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitInit",
        gitInitTool,
        async (
          { path }: z.infer<typeof gitInitSchema>,
          context: ToolContext
        ) => {
          const vfsKey = context?.vfsKey;
          if (!vfsKey) {
            return {
              success: false,
              error: "VFS key not available in context.",
            };
          }
          try {
            await this.performGitOperation(vfsKey, 'gitInit', path);
            return {
              success: true,
              message: `Repository initialized at ${path}`,
            };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    const gitCommitTool: Tool<typeof gitCommitSchema> = {
      description: "Stage all changes and commit them in a VFS Git repository.",
      parameters: gitCommitSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitCommit",
        gitCommitTool,
        async (
          { path, message }: z.infer<typeof gitCommitSchema>,
          context: ToolContext
        ) => {
          const vfsKey = context?.vfsKey;
          if (!vfsKey) {
            return {
              success: false,
              error: "VFS key not available in context.",
            };
          }
          const currentSettings = useSettingsStore.getState();
          if (!currentSettings.gitUserName || !currentSettings.gitUserEmail) {
            return {
              success: false,
              error:
                "Git user name and email not configured in settings. Cannot commit.",
            };
          }
          try {
            const gitUser = { name: currentSettings.gitUserName, email: currentSettings.gitUserEmail };
            await this.performGitOperation(vfsKey, 'gitCommit', path, message, gitUser);
            return { success: true, message: `Changes committed in ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    const gitPullTool: Tool<typeof gitPullSchema> = {
      description:
        "Pull changes from the remote repository for the specified branch.",
      parameters: gitPullSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitPull",
        gitPullTool,
        async (
          { path, branch }: z.infer<typeof gitPullSchema>,
          context: ToolContext
        ) => {
          const vfsKey = context?.vfsKey;
          if (!vfsKey) {
            return {
              success: false,
              error: "VFS key not available in context.",
            };
          }
          try {
            const currentSettings = useSettingsStore.getState();
            const gitUser = { name: currentSettings.gitUserName || 'User', email: currentSettings.gitUserEmail || 'user@example.com' };
            await this.performGitOperation(vfsKey, 'gitPull', path, branch || "main", gitUser);
            return { success: true, message: `Pulled changes for ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    const gitPushTool: Tool<typeof gitPushSchema> = {
      description:
        "Push committed changes from the local branch to the remote repository.",
      parameters: gitPushSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitPush",
        gitPushTool,
        async (
          { path, branch }: z.infer<typeof gitPushSchema>,
          context: ToolContext
        ) => {
          const vfsKey = context?.vfsKey;
          if (!vfsKey) {
            return {
              success: false,
              error: "VFS key not available in context.",
            };
          }
          try {
            await this.performGitOperation(vfsKey, 'gitPush', path, branch || "main");
            return { success: true, message: `Pushed changes for ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    const gitStatusTool: Tool<typeof gitStatusSchema> = {
      description: "Get the Git status for a VFS repository.",
      parameters: gitStatusSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitStatus",
        gitStatusTool,
        async (
          { path }: z.infer<typeof gitStatusSchema>,
          context: ToolContext
        ) => {
          const vfsKey = context?.vfsKey;
          if (!vfsKey) {
            return {
              success: false,
              error: "VFS key not available in context.",
            };
          }
          try {
            await this.performGitOperation(vfsKey, 'gitStatus', path);
            return { success: true, message: `Status checked for ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    // console.log(`[${this.id}] Core Git Tools Registered.`);
  }

  destroy(): void {
    this.unregisterCallbacks.forEach((unsub) => unsub());
    this.unregisterCallbacks = [];
    console.log(`[${this.id}] Destroyed.`);
  }
}
