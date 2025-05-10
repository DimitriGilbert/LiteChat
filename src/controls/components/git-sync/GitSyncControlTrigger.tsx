// src/controls/components/git-sync/GitSyncControlTrigger.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GitBranchIcon, GitPullRequestIcon, Loader2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSyncIndicator } from "@/controls/components/conversation-list/SyncIndicator";
import type { SyncStatus } from "@/types/litechat/sync";
import type { GitSyncControlModule } from "@/controls/modules/GitSyncControlModule";

interface GitSyncControlTriggerProps {
  module: GitSyncControlModule;
}

export const GitSyncControlTrigger: React.FC<GitSyncControlTriggerProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const selectedItemId = module.selectedItemId;
  const selectedItemType = module.selectedItemType;
  const syncRepos = module.syncRepos;
  const conversationSyncStatus = module.conversationSyncStatus;
  const isStreaming = module.isStreaming;

  const [currentRepoId, setCurrentRepoId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<SyncStatus>("idle");
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      const conversation = module.getConversationById(selectedItemId);
      setCurrentRepoId(conversation?.syncRepoId ?? null);
      setCurrentStatus(conversationSyncStatus[selectedItemId] ?? "idle");
    } else {
      setCurrentRepoId(null);
      setCurrentStatus("idle");
    }
  }, [selectedItemId, selectedItemType, conversationSyncStatus, module]);

  const repoNameMap = React.useMemo(
    () => new Map(syncRepos.map((r) => [r.id, r.name])),
    [syncRepos]
  );
  const currentRepoName = currentRepoId
    ? repoNameMap.get(currentRepoId)
    : undefined;

  const handleLinkChange = useCallback(
    async (repoId: string) => {
      if (!selectedItemId || selectedItemType !== "conversation") return;
      setIsLinking(true);
      const newRepoId = repoId === "none" ? null : repoId;
      await module.linkConversationToRepo(selectedItemId, newRepoId);
      setIsLinking(false);
    },
    [selectedItemId, selectedItemType, module]
  );

  const handleSyncNow = useCallback(async () => {
    if (!selectedItemId || !currentRepoId) return;
    setIsSyncing(true);
    await module.syncConversation(selectedItemId);
    setIsSyncing(false);
  }, [selectedItemId, currentRepoId, module]);

  const syncIndicator = getSyncIndicator(currentStatus, currentRepoName);
  const isSyncButtonDisabled =
    !currentRepoId ||
    isSyncing ||
    isLinking ||
    isStreaming ||
    currentStatus === "syncing";

  const isVisible = selectedItemType === "conversation" && syncRepos.length > 0;

  if (!isVisible) {
    return null;
  }

  return (
    <Popover>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant={currentRepoId ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                disabled={isStreaming || isLinking || isSyncing}
                aria-label="Configure Git Sync"
              >
                {currentStatus === "syncing" || isSyncing || isLinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranchIcon className="h-4 w-4" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {currentRepoId
              ? `Sync Status: ${currentStatus}`
              : "Link to Sync Repo"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-64 p-4 space-y-3" align="start">
        <Label htmlFor="sync-repo-select" className="text-sm font-medium">
          Link to Repository
        </Label>
        <Select
          value={currentRepoId ?? "none"}
          onValueChange={handleLinkChange}
          disabled={isLinking || isSyncing || isStreaming}
        >
          <SelectTrigger id="sync-repo-select" className="w-full h-9">
            <SelectValue placeholder="Select repository..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">None</span>
            </SelectItem>
            {syncRepos.map((repo) => (
              <SelectItem key={repo.id} value={repo.id}>
                {repo.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Status: {syncIndicator || "Not Linked"}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSyncNow}
            disabled={isSyncButtonDisabled}
            className="h-8"
          >
            {isSyncing || currentStatus === "syncing" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <GitPullRequestIcon className="h-4 w-4 mr-1" />
            )}
            Sync Now
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
