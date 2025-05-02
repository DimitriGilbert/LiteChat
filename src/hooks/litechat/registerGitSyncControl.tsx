// src/hooks/litechat/registerGitSyncControl.tsx
import React, { useState, useCallback } from "react";
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
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSyncIndicator } from "@/components/LiteChat/chat/control/conversation-list/SyncIndicator";

export function registerGitSyncControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const GitSyncControlTrigger: React.FC = () => {
    const {
      selectedItemId,
      selectedItemType,
      getConversationById,
      syncRepos,
      linkConversationToRepo,
      syncConversation,
      conversationSyncStatus,
    } = useConversationStore(
      useShallow((state) => ({
        selectedItemId: state.selectedItemId,
        selectedItemType: state.selectedItemType,
        getConversationById: state.getConversationById,
        syncRepos: state.syncRepos,
        linkConversationToRepo: state.linkConversationToRepo,
        syncConversation: state.syncConversation,
        conversationSyncStatus: state.conversationSyncStatus,
      })),
    );
    const isStreaming = useInteractionStore.getState().status === "streaming";
    const [isLinking, setIsLinking] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const conversation =
      selectedItemType === "conversation" && selectedItemId
        ? getConversationById(selectedItemId)
        : null;

    const currentRepoId = conversation?.syncRepoId ?? null;
    const currentStatus = conversation
      ? conversationSyncStatus[conversation.id]
      : "idle";
    const repoNameMap = React.useMemo(
      () => new Map(syncRepos.map((r) => [r.id, r.name])),
      [syncRepos],
    );
    const currentRepoName = currentRepoId
      ? repoNameMap.get(currentRepoId)
      : undefined;

    const handleLinkChange = useCallback(
      async (repoId: string) => {
        if (!conversation) return;
        setIsLinking(true);
        const newRepoId = repoId === "none" ? null : repoId;
        await linkConversationToRepo(conversation.id, newRepoId);
        setIsLinking(false);
      },
      [conversation, linkConversationToRepo],
    );

    const handleSyncNow = useCallback(async () => {
      if (!conversation || !currentRepoId) return;
      setIsSyncing(true);
      await syncConversation(conversation.id);
      setIsSyncing(false);
    }, [conversation, currentRepoId, syncConversation]);

    const syncIndicator = getSyncIndicator(currentStatus, currentRepoName);
    const isSyncButtonDisabled =
      !currentRepoId ||
      isSyncing ||
      isLinking ||
      isStreaming ||
      currentStatus === "syncing";

    if (selectedItemType !== "conversation") {
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

  registerPromptControl({
    id: "core-git-sync",
    // order removed
    triggerRenderer: () => React.createElement(GitSyncControlTrigger),
    show: () => useConversationStore.getState().syncRepos.length > 0,
  });

  console.log("[Function] Registered Core Git Sync Control");
}
