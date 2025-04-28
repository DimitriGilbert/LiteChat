// src/hooks/litechat/useGitToolsRegistration.tsx
import { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { tool } from "ai";
import { z } from "zod";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { toast } from "sonner";
import { normalizePath, basename } from "@/lib/litechat/file-manager-utils";
import { useSettingsStore } from "@/store/settings.store";

const MOD_ID = "core-git-tools";

export function useGitToolsRegistration() {
  const { registerTool, unregisterTool } = useControlRegistryStore.getState();

  useEffect(() => {
    const unregisterFunctions: (() => void)[] = [];

    const checkGitConfig = (): boolean => {
      const { gitUserName, gitUserEmail } = useSettingsStore.getState();
      if (!gitUserName || !gitUserEmail) {
        toast.error(
          "Git user name and email must be configured in Settings before using Git tools.",
        );
        return false;
      }
      return true;
    };

    // --- git_clone ---
    const cloneTool = tool({
      description:
        "Clones a remote Git repository into a specified parent directory within the VFS. Creates a new folder named after the repository.",
      parameters: z.object({
        parentPath: z
          .string()
          .describe(
            "The absolute path of the directory *where* the new repository folder should be created (e.g., '/', '/projects').",
          ),
        repoUrl: z
          .string()
          .url()
          .describe("The HTTPS URL of the remote Git repository to clone."),
        branch: z
          .string()
          .optional()
          .describe(
            "Optional specific branch to clone (defaults to the repository's default branch).",
          ),
      }),
      execute: async ({ parentPath, repoUrl, branch }) => {
        const normalizedParentPath = normalizePath(parentPath);
        try {
          await VfsOps.gitCloneOp(normalizedParentPath, repoUrl, branch);
          const repoName = basename(
            repoUrl.replace(/\/$/, "").replace(/\.git$/, ""),
          );
          const finalPath = normalizePath(
            `${normalizedParentPath}/${repoName}`,
          );
          return { status: "success", path: finalPath }; // Return path of cloned repo
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred during clone.";
          // Toast is handled by gitCloneOp
          return { status: "error", message: errorMessage };
        }
      },
    });
    unregisterFunctions.push(registerTool(MOD_ID, "git_clone", cloneTool));

    // --- git_pull ---
    const pullTool = tool({
      description:
        "Pulls the latest changes from the remote repository for a specified local Git repository path within the VFS.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the local Git repository directory in the VFS.",
          ),
      }),
      execute: async ({ path }) => {
        if (!checkGitConfig())
          return {
            status: "error",
            message: "Git user config missing.",
          };
        const normalizedPath = normalizePath(path);
        try {
          await VfsOps.gitPullOp(normalizedPath);
          return { status: "success", path: normalizedPath };
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred during pull.";
          // Toast handled by gitPullOp
          return { status: "error", message: errorMessage };
        }
      },
    });
    unregisterFunctions.push(registerTool(MOD_ID, "git_pull", pullTool));

    // --- git_push ---
    const pushTool = tool({
      description:
        "Pushes local commits from a specified local Git repository path within the VFS to its configured remote repository.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the local Git repository directory in the VFS.",
          ),
      }),
      execute: async ({ path }) => {
        const normalizedPath = normalizePath(path);
        try {
          await VfsOps.gitPushOp(normalizedPath);
          return { status: "success", path: normalizedPath };
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred during push.";
          // Toast handled by gitPushOp
          return { status: "error", message: errorMessage };
        }
      },
    });
    unregisterFunctions.push(registerTool(MOD_ID, "git_push", pushTool));

    // --- git_commit ---
    const commitTool = tool({
      description:
        "Stages all changes (new, modified, deleted files) and commits them with a message to the specified local Git repository path within the VFS.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the local Git repository directory in the VFS.",
          ),
        message: z.string().describe("The commit message."),
      }),
      execute: async ({ path, message }) => {
        if (!checkGitConfig())
          return {
            status: "error",
            message: "Git user config missing.",
          };
        const normalizedPath = normalizePath(path);
        if (!message.trim()) {
          return {
            status: "error",
            message: "Commit message cannot be empty.",
          };
        }
        try {
          await VfsOps.gitCommitOp(normalizedPath, message);
          // CommitOp handles success toast with SHA
          return { status: "success", path: normalizedPath };
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred during commit.";
          // Toast handled by gitCommitOp
          return { status: "error", message: errorMessage };
        }
      },
    });
    unregisterFunctions.push(registerTool(MOD_ID, "git_commit", commitTool));

    // --- git_status ---
    const statusTool = tool({
      description:
        "Shows the working tree status (changes not staged for commit) for a specified local Git repository path within the VFS.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the local Git repository directory in the VFS.",
          ),
      }),
      execute: async ({ path }) => {
        const normalizedPath = normalizePath(path);
        try {
          // gitStatusOp shows a toast, we just return success/fail here
          await VfsOps.gitStatusOp(normalizedPath);
          // We don't return the status matrix itself to the LLM, toast is for user
          return { status: "success", path: normalizedPath };
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred checking status.";
          // Toast handled by gitStatusOp
          return { status: "error", message: errorMessage };
        }
      },
    });
    unregisterFunctions.push(registerTool(MOD_ID, "git_status", statusTool));

    // --- git_init ---
    const initTool = tool({
      description:
        "Initializes a new, empty Git repository at the specified directory path within the VFS.",
      parameters: z.object({
        path: z
          .string()
          .describe(
            "The absolute path of the directory to initialize as a Git repository.",
          ),
      }),
      execute: async ({ path }) => {
        const normalizedPath = normalizePath(path);
        try {
          await VfsOps.gitInitOp(normalizedPath);
          return { status: "success", path: normalizedPath };
        } catch (error: any) {
          const errorMessage =
            error.message || "An unknown error occurred during git init.";
          // Toast handled by gitInitOp
          return { status: "error", message: errorMessage };
        }
      },
    });
    unregisterFunctions.push(registerTool(MOD_ID, "git_init", initTool));

    return () => {
      unregisterFunctions.forEach((unregister) => unregister());
      console.log("[useGitToolsRegistration] Git tools unregistered");
    };
  }, [registerTool, unregisterTool]); // Ensure dependencies are correct
}
