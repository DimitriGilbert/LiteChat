// src/hooks/litechat/useGitToolsRegistration.tsx
import { useEffect } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { z } from "zod";
import git from "isomorphic-git"; // Import git directly
import { fs } from "@zenfs/core"; // Import fs for type checking

export function useGitToolsRegistration() {
  const registerTool = useControlRegistryStore((state) => state.registerTool);

  useEffect(() => {
    const unregisterFuncs: (() => void)[] = [];

    // --- Git Status Tool ---
    const statusTool = registerTool(
      "git",
      "git_status",
      {
        description:
          "Get the status of a Git repository within the Virtual File System (VFS). Shows untracked, modified, or deleted files.",
        parameters: z.object({
          path: z
            .string()
            .describe(
              "The absolute path to the directory within the VFS that is a Git repository.",
            ),
        }),
      },
      async (args) => {
        try {
          // Use git.statusMatrix directly
          const status = await git.statusMatrix({ fs, dir: args.path });
          const formattedStatus = status.map(
            ([file, head, workdir]: [
              string,
              number,
              number,
              number, // Add type for stage status
            ]) => {
              let statusText = "";
              if (workdir === 0) statusText = "deleted";
              else if (head === 0 && workdir === 2) statusText = "new file";
              else if (head === 1 && workdir === 2) statusText = "modified";
              else if (head === 1 && workdir === 1) statusText = "unmodified";
              else statusText = `h:${head} w:${workdir}`; // Fallback
              return `${file}: ${statusText}`;
            },
          ).join(`
`);
          return formattedStatus || "No changes detected.";
        } catch (e: any) {
          return { error: `Failed to get Git status: ${e.message}` };
        }
      },
    );
    unregisterFuncs.push(statusTool);

    // --- Git Commit Tool ---
    const commitTool = registerTool(
      "git",
      "git_commit",
      {
        description:
          "Stage all changes (new, modified, deleted) and commit them to a Git repository within the VFS.",
        parameters: z.object({
          path: z
            .string()
            .describe(
              "The absolute path to the directory within the VFS that is a Git repository.",
            ),
          message: z.string().describe("The commit message."),
        }),
      },
      async (args) => {
        try {
          await VfsOps.gitCommitOp(args.path, args.message);
          return "Changes committed successfully.";
        } catch (e: any) {
          return { error: `Failed to commit changes: ${e.message}` };
        }
      },
    );
    unregisterFuncs.push(commitTool);

    // --- Git Pull Tool ---
    const pullTool = registerTool(
      "git",
      "git_pull",
      {
        description:
          "Fetch changes from the remote repository and merge them into the current branch for a Git repository within the VFS.",
        parameters: z.object({
          path: z
            .string()
            .describe(
              "The absolute path to the directory within the VFS that is a Git repository.",
            ),
        }),
      },
      async (args) => {
        try {
          await VfsOps.gitPullOp(args.path);
          return "Pulled latest changes successfully.";
        } catch (e: any) {
          return { error: `Failed to pull changes: ${e.message}` };
        }
      },
    );
    unregisterFuncs.push(pullTool);

    // --- Git Push Tool ---
    const pushTool = registerTool(
      "git",
      "git_push",
      {
        description:
          "Push committed changes from the local Git repository within the VFS to the configured remote repository.",
        parameters: z.object({
          path: z
            .string()
            .describe(
              "The absolute path to the directory within the VFS that is a Git repository.",
            ),
        }),
      },
      async (args) => {
        try {
          await VfsOps.gitPushOp(args.path);
          return "Pushed changes successfully.";
        } catch (e: any) {
          return { error: `Failed to push changes: ${e.message}` };
        }
      },
    );
    unregisterFuncs.push(pushTool);

    // --- Git Clone Tool ---
    const cloneTool = registerTool(
      "git",
      "git_clone",
      {
        description:
          "Clone a remote Git repository into a specified target directory within the VFS.",
        parameters: z.object({
          targetPath: z
            .string()
            .describe(
              "The absolute path within the VFS where the repository folder should be created.",
            ),
          url: z.string().url().describe("The URL of the remote repository."),
          branch: z
            .string()
            .optional()
            .describe("The specific branch to clone (optional)."),
        }),
      },
      async (args) => {
        try {
          await VfsOps.gitCloneOp(args.targetPath, args.url, args.branch);
          return `Repository cloned successfully into ${args.targetPath}.`;
        } catch (e: any) {
          return { error: `Failed to clone repository: ${e.message}` };
        }
      },
    );
    unregisterFuncs.push(cloneTool);

    // --- Git Init Tool ---
    const initTool = registerTool(
      "git",
      "git_init",
      {
        description:
          "Initialize an empty Git repository in the specified directory within the VFS.",
        parameters: z.object({
          path: z
            .string()
            .describe(
              "The absolute path to the directory within the VFS to initialize.",
            ),
        }),
      },
      async (args) => {
        try {
          await VfsOps.gitInitOp(args.path);
          return "Git repository initialized successfully.";
        } catch (e: any) {
          return { error: `Failed to initialize Git repository: ${e.message}` };
        }
      },
    );
    unregisterFuncs.push(initTool);

    // Cleanup function
    return () => {
      unregisterFuncs.forEach((unregister) => unregister());
    };
  }, [registerTool]); // Dependency array
}
