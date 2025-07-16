// src/controls/modules/GitToolsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import {
  type LiteChatModApi,
  type ReadonlyChatContextSnapshot,
} from "@/types/litechat/modding";
import { useSettingsStore } from "@/store/settings.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { z } from "zod";
import { Tool } from "ai";
import type { fs as FsType } from "@zenfs/core"; // Corrected import

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

// Corrected ToolContext to use FsType from @zenfs/core
type ToolContext = ReadonlyChatContextSnapshot & {
  fsInstance?: typeof FsType;
};

export class GitToolsModule implements ControlModule {
  readonly id = "core-git-tools";
  private unregisterCallbacks: (() => void)[] = [];

  async initialize(_modApi: LiteChatModApi): Promise<void> {
    // console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallbacks.length > 0) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    // console.log(`[${this.id}] Registering Core Git Tools...`);

    const gitInitTool: Tool<any> = {
      description: "Initialize an empty Git repository in a VFS directory.",
      inputSchema: gitInitSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitInit",
        gitInitTool,
        async (
          { path }: z.infer<typeof gitInitSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          try {
            await VfsOps.gitInitOp(path, { fsInstance });
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

    const gitCommitTool: Tool<any> = {
      description: "Stage all changes and commit them in a VFS Git repository.",
      inputSchema: gitCommitSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitCommit",
        gitCommitTool,
        async (
          { path, message }: z.infer<typeof gitCommitSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
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
            await VfsOps.gitCommitOp(path, message, { fsInstance });
            return { success: true, message: `Changes committed in ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    const gitPullTool: Tool<any> = {
      description:
        "Pull changes from the remote repository for the specified branch.",
      inputSchema: gitPullSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitPull",
        gitPullTool,
        async (
          { path, branch }: z.infer<typeof gitPullSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          try {
            await VfsOps.gitPullOp(path, branch || "main", undefined, {
              fsInstance,
            });
            return { success: true, message: `Pulled changes for ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    const gitPushTool: Tool<any> = {
      description:
        "Push committed changes from the local branch to the remote repository.",
      inputSchema: gitPushSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitPush",
        gitPushTool,
        async (
          { path, branch }: z.infer<typeof gitPushSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          try {
            await VfsOps.gitPushOp(path, branch || "main", undefined, {
              fsInstance,
            });
            return { success: true, message: `Pushed changes for ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        }
      )
    );

    const gitStatusTool: Tool<any> = {
      description: "Get the Git status for a VFS repository.",
      inputSchema: gitStatusSchema,
    };
    this.unregisterCallbacks.push(
      modApi.registerTool(
        "gitStatus",
        gitStatusTool,
        async (
          { path }: z.infer<typeof gitStatusSchema>,
          context: ToolContext
        ) => {
          const fsInstance = context?.fsInstance;
          if (!fsInstance) {
            return {
              success: false,
              error: "Filesystem instance not available in context.",
            };
          }
          try {
            await VfsOps.gitStatusOp(path, { fsInstance });
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
