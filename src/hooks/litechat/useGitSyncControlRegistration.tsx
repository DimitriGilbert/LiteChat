// src/hooks/litechat/useGitSyncControlRegistration.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import { useUIStateStore } from "@/store/ui.store"; // Import UI store
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import {
  GitBranchIcon,
  GitPullRequestIcon,
  GitCommitIcon,
  Loader2,
  AlertCircleIcon,
  CheckCircle2Icon,
  LinkIcon,
  UnlinkIcon,
  SettingsIcon, // Import SettingsIcon
} from "lucide-react";
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
import { toast } from "sonner";
import type { SyncStatus } from "@/types/litechat/sync";

const GitSyncControlComponent: React.FC = () => {
  const {
    selectedItemId,
    selectedItemType,
    conversations,
    syncRepos,
    conversationSyncStatus,
    linkConversationToRepo,
    syncConversation,
    loadSyncRepos, // Load repos if needed
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      conversations: state.conversations,
      syncRepos: state.syncRepos,
      conversationSyncStatus: state.conversationSyncStatus,
      linkConversationToRepo: state.linkConversationToRepo,
      syncConversation: state.syncConversation,
      loadSyncRepos: state.loadSyncRepos,
    })),
  );

  // Get actions from UI store
  const { toggleChatControlPanel, setInitialSettingsTabs } = useUIStateStore(
    useShallow((state) => ({
      toggleChatControlPanel: state.toggleChatControlPanel,
      setInitialSettingsTabs: state.setInitialSettingsTabs,
    })),
  );

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);

  const currentConversation = conversations.find(
    (c) => c.id === selectedItemId && selectedItemType === "conversation",
  );
  const currentSyncStatus: SyncStatus = currentConversation
    ? (conversationSyncStatus[currentConversation.id] ?? "idle")
    : "idle";
  const currentRepoId = currentConversation?.syncRepoId ?? null;
  const currentRepo = syncRepos.find((r) => r.id === currentRepoId);

  useEffect(() => {
    if (syncRepos.length === 0) {
      loadSyncRepos(); // Load repos if the list is empty
    }
  }, [syncRepos.length, loadSyncRepos]);

  useEffect(() => {
    if (popoverOpen && currentConversation) {
      setSelectedRepoId(currentConversation.syncRepoId ?? "none");
    }
  }, [popoverOpen, currentConversation]);

  const handleLink = useCallback(async () => {
    if (!currentConversation) return;
    const repoIdToLink = selectedRepoId === "none" ? null : selectedRepoId;
    try {
      await linkConversationToRepo(currentConversation.id, repoIdToLink);
      setPopoverOpen(false);
    } catch (error) {
      console.error("Failed to link conversation:", error);
      // Toast handled by store action
    }
  }, [currentConversation, selectedRepoId, linkConversationToRepo]);

  const handleSync = useCallback(async () => {
    if (!currentConversation || !currentRepoId) return;
    try {
      await syncConversation(currentConversation.id);
    } catch (error) {
      console.error("Failed to sync conversation:", error);
      // Toast handled by store action
    }
  }, [currentConversation, currentRepoId, syncConversation]);

  const handleOpenSettings = () => {
    setInitialSettingsTabs("git", "sync"); // Set target tab and sub-tab
    toggleChatControlPanel("settingsModal", true); // Open the modal
    setPopoverOpen(false); // Close the popover
  };

  const renderIcon = () => {
    if (!currentConversation) {
      return <GitBranchIcon className="h-4 w-4 text-muted-foreground/50" />;
    }
    if (!currentRepoId) {
      return <UnlinkIcon className="h-4 w-4 text-muted-foreground" />;
    }
    switch (currentSyncStatus) {
      case "syncing":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "error":
        return <AlertCircleIcon className="h-4 w-4 text-destructive" />;
      case "needs-sync":
        return <AlertCircleIcon className="h-4 w-4 text-orange-500" />;
      case "idle":
      default:
        return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
    }
  };

  const getTooltipText = () => {
    if (!currentConversation) return "Select a conversation to manage sync";
    if (!currentRepoId) return "Link conversation to a Git repository";
    switch (currentSyncStatus) {
      case "syncing":
        return `Syncing with ${currentRepo?.name}...`;
      case "error":
        return `Sync error with ${currentRepo?.name}`;
      case "needs-sync":
        return `Needs sync with ${currentRepo?.name}`;
      case "idle":
      default:
        return `Synced with ${currentRepo?.name}`;
    }
  };

  // const handleNoReposConfigured = () => {
  //   // Show actionable toast
  //   toast("No Sync Repositories Found", {
  //     description:
  //       "Please configure a repository in settings to enable conversation sync.",
  //     action: {
  //       label: "Go to Settings",
  //       onClick: handleOpenSettings,
  //     },
  //   });
  // };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!currentConversation}
          aria-label="Git Sync Status"
          title={getTooltipText()}
        >
          {renderIcon()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3">
        <Label className="text-xs font-medium">Conversation Sync</Label>
        {syncRepos.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center space-y-2">
            <p>No sync repositories configured.</p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleOpenSettings}
            >
              <SettingsIcon className="h-3 w-3 mr-1" /> Configure Repos
            </Button>
          </div>
        ) : (
          <>
            <Select
              value={selectedRepoId ?? "none"}
              onValueChange={setSelectedRepoId}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select Repository..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">None (Unlink)</span>
                </SelectItem>
                {syncRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={handleLink}
              disabled={
                !selectedRepoId || selectedRepoId === currentRepoId // Disable if selection hasn't changed
              }
            >
              {selectedRepoId === "none" ? (
                <UnlinkIcon className="h-3 w-3 mr-1" />
              ) : (
                <LinkIcon className="h-3 w-3 mr-1" />
              )}
              {selectedRepoId === "none" ? "Unlink" : "Link"} Repository
            </Button>
          </>
        )}

        {currentRepoId && (
          <div className="border-t pt-3 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={handleSync}
              disabled={currentSyncStatus === "syncing"}
            >
              {currentSyncStatus === "syncing" ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : currentSyncStatus === "needs-sync" ? (
                <GitPullRequestIcon className="h-3 w-3 mr-1" />
              ) : (
                <GitCommitIcon className="h-3 w-3 mr-1" />
              )}
              {currentSyncStatus === "syncing" ? "Syncing..." : "Sync Now"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {getTooltipText()}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const useGitSyncControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const syncRepos = useConversationStore((state) => state.syncRepos);

  useEffect(() => {
    const unregister = register({
      id: "core-git-sync",
      order: 50, // Adjust order as needed
      triggerRenderer: () => <GitSyncControlComponent />,
      show: () => true, // Always show the trigger
    });

    return unregister;
  }, [register, syncRepos]); // Re-register if syncRepos change (might not be necessary)
};
