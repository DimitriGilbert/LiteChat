// src/hooks/litechat/useGitToolsRegistration.tsx
import { useEffect, useState } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { z } from "zod";
import { Tool } from "ai";

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
  // Add credentials later if needed
});

const gitPushSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to push.",
    ),
  branch: z.string().optional().describe("The branch name to push."),
  // Add credentials later if needed
});

const gitStatusSchema = z.object({
  path: z
    .string()
    .describe(
      "The directory path of the Git repository within the VFS to check status.",
    ),
});

export function useGitToolsRegistration() {
  const registerTool = useControlRegistryStore((state) => state.registerTool);
  const { gitUserName, gitUserEmail } = useSettingsStore(
    useShallow((state) => ({
      gitUserName: state.gitUserName,
      gitUserEmail: state.gitUserEmail,
    })),
  );
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (isRegistered) return;

    const unregisterFuncs: (() => void)[] = [];

    // --- Git Init ---
    const gitInitTool: Tool<typeof gitInitSchema> = {
      description: "Initialize an empty Git repository in a VFS directory.",
      parameters: gitInitSchema,
    };
    unregisterFuncs.push(
      registerTool("core", "gitInit", gitInitTool, async ({ path }) => {
        try {
          await VfsOps.gitInitOp(path);
          return {
            success: true,
            message: `Repository initialized at ${path}`,
          };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }),
    );

    // --- Git Commit ---
    const gitCommitTool: Tool<typeof gitCommitSchema> = {
      description: "Stage all changes and commit them in a VFS Git repository.",
      parameters: gitCommitSchema,
    };
    unregisterFuncs.push(
      registerTool(
        "core",
        "gitCommit",
        gitCommitTool,
        async ({ path, message }) => {
          if (!gitUserName || !gitUserEmail) {
            return {
              success: false,
              error:
                "Git user name and email not configured in settings. Cannot commit.",
            };
          }
          try {
            // Pass both path and message
            await VfsOps.gitCommitOp(path, message);
            return { success: true, message: `Changes committed in ${path}` };
          } catch (e: any) {
            return { success: false, error: e.message };
          }
        },
      ),
    );

    // --- Git Pull ---
    const gitPullTool: Tool<typeof gitPullSchema> = {
      description:
        "Pull changes from the remote repository for the specified branch.",
      parameters: gitPullSchema,
    };
    unregisterFuncs.push(
      registerTool("core", "gitPull", gitPullTool, async ({ path, branch }) => {
        // TODO: Get credentials if needed
        try {
          await VfsOps.gitPullOp(path, branch || "main"); // Use main if branch omitted
          return { success: true, message: `Pulled changes for ${path}` };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }),
    );

    // --- Git Push ---
    const gitPushTool: Tool<typeof gitPushSchema> = {
      description:
        "Push committed changes from the local branch to the remote repository.",
      parameters: gitPushSchema,
    };
    unregisterFuncs.push(
      registerTool("core", "gitPush", gitPushTool, async ({ path, branch }) => {
        // TODO: Get credentials if needed
        try {
          await VfsOps.gitPushOp(path, branch || "main"); // Use main if branch omitted
          return { success: true, message: `Pushed changes for ${path}` };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }),
    );

    // --- Git Status ---
    const gitStatusTool: Tool<typeof gitStatusSchema> = {
      description: "Get the Git status for a VFS repository.",
      parameters: gitStatusSchema,
    };
    unregisterFuncs.push(
      registerTool("core", "gitStatus", gitStatusTool, async ({ path }) => {
        try {
          // gitStatusOp handles its own toast, just return success/error
          await VfsOps.gitStatusOp(path);
          return { success: true, message: `Status checked for ${path}` };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }),
    );

    setIsRegistered(true);
    console.log("[Hook] Registered Core Git Tools");

    // Cleanup function
    return () => {
      unregisterFuncs.forEach((unregister) => unregister());
      setIsRegistered(false);
      console.log("[Hook] Unregistered Core Git Tools");
    };
  }, [registerTool, isRegistered, gitUserName, gitUserEmail]);
}
