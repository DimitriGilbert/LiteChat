// src/hooks/litechat/registerGitTools.ts
// FULL FILE
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { z } from "zod";
import { Tool } from "ai";
import type { ReadonlyChatContextSnapshot } from "@/types/litechat/modding";

// Schemas remain the same
const gitInitSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path within the VFS to initialize as a Git repository.",
    ),
});

const gitCommitSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to commit.",
    ),
  message: z.string().describe("The commit message."),
});

const gitPullSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to pull from.",
    ),
  branch: z.string().optional().describe("The branch name to pull."),
});

const gitPushSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to push.",
    ),
  branch: z.string().optional().describe("The branch name to push."),
});

const gitStatusSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to check status.",
    ),
});

// Convert the hook into a plain function
export function registerGitTools() {
  // Get actions/state directly from the store
  const registerTool = useControlRegistryStore.getState().registerTool;

  console.log("[Function] Registering Core Git Tools...");

  // --- Git Init ---
  const gitInitTool: Tool<typeof gitInitSchema> = {
    description: "Initialize an empty Git repository in a VFS directory.",
    parameters: gitInitSchema,
  };
  registerTool(
    "core",
    "gitInit",
    gitInitTool,
    // Update implementation signature
    async (
      { path },
      context: ReadonlyChatContextSnapshot & { fsInstance?: typeof VfsOps.VFS },
    ) => {
      const fsInstance = context?.fsInstance;
      if (!fsInstance) {
        return {
          success: false,
          error: "Filesystem instance not available in context.",
        };
      }
      try {
        // Pass fsInstance
        await VfsOps.gitInitOp(path, { fsInstance });
        return { success: true, message: `Repository initialized at ${path}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  );

  // --- Git Commit ---
  const gitCommitTool: Tool<typeof gitCommitSchema> = {
    description: "Stage all changes and commit them in a VFS Git repository.",
    parameters: gitCommitSchema,
  };
  registerTool(
    "core",
    "gitCommit",
    gitCommitTool,
    // Update implementation signature
    async (
      { path, message },
      context: ReadonlyChatContextSnapshot & { fsInstance?: typeof VfsOps.VFS },
    ) => {
      const fsInstance = context?.fsInstance;
      if (!fsInstance) {
        return {
          success: false,
          error: "Filesystem instance not available in context.",
        };
      }
      // Re-check settings state inside the implementation
      const currentSettings = useSettingsStore.getState();
      if (!currentSettings.gitUserName || !currentSettings.gitUserEmail) {
        return {
          success: false,
          error:
            "Git user name and email not configured in settings. Cannot commit.",
        };
      }
      try {
        // Pass fsInstance
        await VfsOps.gitCommitOp(path, message, { fsInstance });
        return { success: true, message: `Changes committed in ${path}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  );

  // --- Git Pull ---
  const gitPullTool: Tool<typeof gitPullSchema> = {
    description:
      "Pull changes from the remote repository for the specified branch.",
    parameters: gitPullSchema,
  };
  registerTool(
    "core",
    "gitPull",
    gitPullTool,
    // Update implementation signature
    async (
      { path, branch },
      context: ReadonlyChatContextSnapshot & { fsInstance?: typeof VfsOps.VFS },
    ) => {
      const fsInstance = context?.fsInstance;
      if (!fsInstance) {
        return {
          success: false,
          error: "Filesystem instance not available in context.",
        };
      }
      try {
        // Pass fsInstance
        await VfsOps.gitPullOp(path, branch || "main", undefined, {
          fsInstance,
        });
        return { success: true, message: `Pulled changes for ${path}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  );

  // --- Git Push ---
  const gitPushTool: Tool<typeof gitPushSchema> = {
    description:
      "Push committed changes from the local branch to the remote repository.",
    parameters: gitPushSchema,
  };
  registerTool(
    "core",
    "gitPush",
    gitPushTool,
    // Update implementation signature
    async (
      { path, branch },
      context: ReadonlyChatContextSnapshot & { fsInstance?: typeof VfsOps.VFS },
    ) => {
      const fsInstance = context?.fsInstance;
      if (!fsInstance) {
        return {
          success: false,
          error: "Filesystem instance not available in context.",
        };
      }
      try {
        // Pass fsInstance
        await VfsOps.gitPushOp(path, branch || "main", undefined, {
          fsInstance,
        });
        return { success: true, message: `Pushed changes for ${path}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  );

  // --- Git Status ---
  const gitStatusTool: Tool<typeof gitStatusSchema> = {
    description: "Get the Git status for a VFS repository.",
    parameters: gitStatusSchema,
  };
  registerTool(
    "core",
    "gitStatus",
    gitStatusTool,
    // Update implementation signature
    async (
      { path },
      context: ReadonlyChatContextSnapshot & { fsInstance?: typeof VfsOps.VFS },
    ) => {
      const fsInstance = context?.fsInstance;
      if (!fsInstance) {
        return {
          success: false,
          error: "Filesystem instance not available in context.",
        };
      }
      try {
        // Pass fsInstance
        await VfsOps.gitStatusOp(path, { fsInstance });
        return { success: true, message: `Status checked for ${path}` };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
  );

  console.log("[Function] Core Git Tools Registered.");
}
