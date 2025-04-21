// src/components/lite-chat/git-manager.tsx
import React, { useState, useEffect } from "react";
// Removed useChatContext import
// Import necessary store hooks
import { useVfsStore } from "@/store/vfs.store";
import { useGit } from "@/hooks/use-git"; // Keep useGit
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCwIcon,
  GitBranchIcon,
  GitCommitIcon,
  GitPullRequestIcon,
  FolderOpenIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { GitRepoInfoData } from "@/utils/git-utils";
import { fs } from "@zenfs/core"; // Import fs for useGit

export const GitManager: React.FC<{ className?: string }> = ({ className }) => {
  // Get VFS state from store
  const { isVfsReady, vfsKey } = useVfsStore((s) => ({
    isVfsReady: s.isVfsReady,
    vfsKey: s.vfsKey, // Needed to re-initialize git if VFS key changes
  }));

  // Initialize useGit with fs instance when ready
  const git = useGit(isVfsReady ? fs : null);

  // Local UI state remains
  const [currentPath] = useState("/"); // Assuming root for now
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState("");
  const [authorName, setAuthorName] = useState("LiteChat User");
  const [authorEmail, setAuthorEmail] = useState("user@example.com");
  const [isRepo, setIsRepo] = useState(false);
  const [repoInfo, setRepoInfo] = useState<GitRepoInfoData | null>(null);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [isAdvancedVisible, setIsAdvancedVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Effect to check repo status depends on git.initialized and vfsKey
  useEffect(() => {
    const checkIfRepo = async () => {
      if (git.initialized && currentPath) {
        setIsRefreshing(true);
        const isGitRepo = await git.isGitRepository(currentPath);
        setIsRepo(isGitRepo);

        if (isGitRepo) {
          const infoResult = await git.getRepoInfo(currentPath);
          if (infoResult.success) {
            setRepoInfo(infoResult.data);
          } else {
            setRepoInfo(null);
          }
        } else {
          setRepoInfo(null);
        }
        setIsRefreshing(false);
      } else {
        setIsRepo(false);
        setRepoInfo(null);
      }
    };

    checkIfRepo();
    // Re-run if git becomes initialized OR if the underlying VFS key changes
  }, [git, currentPath, vfsKey]);

  // Handlers remain the same, using the git hook instance
  const handleClone = async () => {
    if (!repoUrl) {
      toast.error("Please enter a repository URL");
      return;
    }
    if (!git.initialized) {
      toast.error("Git is not initialized. Please wait and try again.");
      return;
    }

    setIsCloning(true);
    const result = await git.cloneRepository(repoUrl, currentPath, {
      branch: branch || undefined,
    });
    setIsCloning(false);

    if (result.success) {
      setShowCloneForm(false);
      setRepoUrl("");
      setIsRepo(true);
      handleRefreshInfo();
    }
  };

  const handleInit = async () => {
    if (!git.initialized) {
      toast.error("Git is not initialized. Please wait and try again.");
      return;
    }
    const result = await git.initRepository(currentPath);
    if (result.success) {
      setIsRepo(true);
      handleRefreshInfo();
    }
  };

  const handleCommit = async () => {
    if (!commitMessage) {
      toast.error("Please enter a commit message");
      return;
    }
    if (!git.initialized) {
      toast.error("Git is not initialized. Please wait and try again.");
      return;
    }

    setIsCommitting(true);
    await git.addFile(currentPath, ".");
    const result = await git.commitChanges(currentPath, {
      message: commitMessage,
      author: {
        name: authorName,
        email: authorEmail,
      },
    });
    setIsCommitting(false);

    if (result.success) {
      setCommitMessage("");
      handleRefreshInfo();
    }
  };

  const handlePull = async () => {
    if (!git.initialized) {
      toast.error("Git is not initialized. Please wait and try again.");
      return;
    }
    const result = await git.pullChanges(currentPath);
    if (result.success) {
      handleRefreshInfo();
    }
  };

  const handlePush = async () => {
    if (!git.initialized) {
      toast.error("Git is not initialized. Please wait and try again.");
      return;
    }
    await git.pushChanges(currentPath);
  };

  const handleRefreshInfo = async () => {
    if (isRepo && git.initialized) {
      setIsRefreshing(true);
      const infoResult = await git.getRepoInfo(currentPath);
      if (infoResult.success) {
        setRepoInfo(infoResult.data);
      } else {
        setRepoInfo(null);
      }
      setIsRefreshing(false);
    } else if (!git.initialized) {
      toast.error("Git is not initialized.");
    }
  };

  const toggleAdvancedSettings = () => {
    setIsAdvancedVisible(!isAdvancedVisible);
  };

  // Render logic depends on VFS readiness and git initialization
  if (!isVfsReady || !git.initialized) {
    let message =
      "Virtual Filesystem not available or not enabled for this item.";
    if (isVfsReady && !git.initialized) {
      message = "Initializing Git functionality...";
    }
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        {message}
        {isVfsReady && !git.initialized && (
          <Loader2Icon className="inline-block ml-2 h-4 w-4 animate-spin" />
        )}
      </div>
    );
  }

  if (isRefreshing) {
    return (
      <div className={cn("p-4 space-y-2", className)}>
        <Skeleton className="h-8 w-1/2 bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
        <Skeleton className="h-10 w-full bg-gray-700" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col p-4 space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Git Repository</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshInfo}
            disabled={!isRepo || git.loading || isRefreshing}
          >
            {isRefreshing ? (
              <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4 mr-1" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {!isRepo ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCloneForm(!showCloneForm)}
              variant="secondary"
              disabled={git.loading || isCloning}
            >
              <GitBranchIcon className="h-4 w-4 mr-1" />
              Clone Repository
            </Button>
            <Button
              onClick={handleInit}
              variant="secondary"
              disabled={git.loading}
            >
              <FolderOpenIcon className="h-4 w-4 mr-1" />
              Initialize Repository
            </Button>
          </div>

          {showCloneForm && (
            <div className="border rounded-md p-4 space-y-3">
              <h4 className="font-medium">Clone Repository</h4>
              <div className="space-y-2">
                <Label htmlFor="repo-url">Repository URL</Label>
                <Input
                  id="repo-url"
                  placeholder="https://github.com/username/repo.git"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  disabled={isCloning}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  disabled={isCloning}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleClone}
                  disabled={!repoUrl || git.loading || isCloning}
                >
                  {isCloning ? (
                    <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  Clone
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCloneForm(false)}
                  disabled={isCloning}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Repository Info */}
          <div className="border rounded-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <GitBranchIcon className="h-4 w-4" />
              <span className="font-medium">Branch:</span>
              <span>{repoInfo?.branch ?? "Unknown"}</span>
            </div>

            {repoInfo?.url && (
              <div className="flex items-center gap-2">
                <span className="font-medium">Remote:</span>
                <span className="text-sm truncate max-w-xs">
                  {repoInfo.url}
                </span>
              </div>
            )}

            {repoInfo?.lastCommit && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <GitCommitIcon className="h-4 w-4" />
                  <span className="font-medium">Last Commit:</span>
                </div>
                <div className="text-sm pl-6 truncate">
                  {repoInfo.lastCommit?.message ?? "N/A"}
                </div>
                <div className="text-xs text-gray-400 pl-6">
                  {repoInfo.lastCommit?.author?.name ?? "Unknown Author"} •{" "}
                  {new Date(repoInfo.lastCommit.date).toLocaleString()}
                </div>
              </div>
            )}
            {!repoInfo && (
              <p className="text-sm text-gray-500">
                Repository details unavailable.
              </p>
            )}
          </div>

          {/* Git Actions */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handlePull}
                variant="secondary"
                disabled={git.loading}
              >
                {git.loading ? (
                  <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <GitBranchIcon className="h-4 w-4 mr-1" />
                )}
                Pull
              </Button>
              <Button
                onClick={handlePush}
                variant="secondary"
                disabled={git.loading}
              >
                {git.loading ? (
                  <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <GitPullRequestIcon className="h-4 w-4 mr-1" />
                )}
                Push
              </Button>
            </div>

            <Separator />

            {/* Commit Section */}
            <div className="space-y-3">
              <h4 className="font-medium">Commit Changes</h4>
              <div className="space-y-2">
                <Label htmlFor="commit-message">Commit Message</Label>
                <Input
                  id="commit-message"
                  placeholder="Describe your changes"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  disabled={isCommitting || git.loading}
                />
              </div>

              <Button
                onClick={toggleAdvancedSettings}
                variant="ghost"
                size="sm"
                disabled={isCommitting || git.loading}
              >
                {isAdvancedVisible ? "Hide" : "Show"} Advanced Settings
              </Button>

              {isAdvancedVisible && (
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="author-name">Author Name</Label>
                    <Input
                      id="author-name"
                      placeholder="Your Name"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      disabled={isCommitting || git.loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="author-email">Author Email</Label>
                    <Input
                      id="author-email"
                      placeholder="your.email@example.com"
                      value={authorEmail}
                      onChange={(e) => setAuthorEmail(e.target.value)}
                      disabled={isCommitting || git.loading}
                    />
                  </div>
                </div>
              )}

              <Button
                onClick={handleCommit}
                disabled={!commitMessage || isCommitting || git.loading}
                className="w-full"
              >
                {isCommitting ? (
                  <Loader2Icon className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <GitCommitIcon className="h-4 w-4 mr-1" />
                )}
                Commit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
