// src/components/LiteChat/prompt/control/GitSyncControlRegistration.tsx
import React from "react";
import { Button } from "@/components/ui/button";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  Loader2,
  Settings2Icon,
  XIcon,
  FolderSyncIcon,
} from "lucide-react";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
import type { PromptControl } from "@/types/litechat/prompt";
import type { SyncStatus } from "@/types/litechat/sync";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";

const GitSyncControlComponent: React.FC = () => {
  const {
    selectedItemId, // Use selectedItemId
    selectedItemType, // Use selectedItemType
    conversations,
    syncRepos,
    conversationSyncStatus,
    linkConversationToRepo,
    syncConversation,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      conversations: state.conversations,
      syncRepos: state.syncRepos,
      conversationSyncStatus: state.conversationSyncStatus,
      linkConversationToRepo: state.linkConversationToRepo,
      syncConversation: state.syncConversation,
    })),
  );

  // Determine the current conversation ID only if a conversation is selected
  const currentConversationId =
    selectedItemType === "conversation" ? selectedItemId : null;

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId,
  );
  const currentRepoId = currentConversation?.syncRepoId;
  const currentRepo = syncRepos.find((r) => r.id === currentRepoId);
  const currentStatus: SyncStatus = currentConversationId
    ? (conversationSyncStatus[currentConversationId] ?? "idle")
    : "idle";

  const handleLinkRepo = (repoId: string | null) => {
    if (currentConversationId) {
      linkConversationToRepo(currentConversationId, repoId);
    }
  };

  const handleSyncClick = () => {
    if (currentConversationId && currentRepoId) {
      syncConversation(currentConversationId);
    }
  };

  const handleConfigureClick = () => {
    // TODO: Ideally, open the Settings modal directly to the Git->Sync tab
    // For now, just inform the user.
    alert(
      "Please go to Settings -> Git -> Sync Repositories to configure sync.",
    );
  };

  const getStatusInfo = (): {
    icon: React.ReactNode;
    tooltip: string;
    colorClass: string;
  } => {
    switch (currentStatus) {
      case "syncing":
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
          tooltip: `Syncing with ${currentRepo?.name}...`,
          colorClass: "text-blue-500",
        };
      case "error":
        return {
          icon: (
            <AlertCircleIcon className="h-3 w-3 text-destructive fill-destructive/30" />
          ),
          tooltip: `Sync error with ${currentRepo?.name}. Check console/logs.`,
          colorClass: "text-destructive",
        };
      case "needs-sync":
        return {
          icon: (
            <AlertCircleIcon className="h-3 w-3 text-orange-500 fill-orange-300" />
          ),
          tooltip: `Local changes need sync with ${currentRepo?.name}.`,
          colorClass: "text-orange-500",
        };
      case "idle":
      default:
        return {
          icon: <CheckCircle2Icon className="h-3 w-3 text-green-500" />,
          tooltip: `Synced with ${currentRepo?.name}.`,
          colorClass: "text-green-500",
        };
    }
  };

  const statusInfo = currentRepo ? getStatusInfo() : null;
  const isButtonDisabled = !currentConversationId; // Disable if no conversation selected

  return (
    <DropdownMenu>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Ensure DropdownMenuTrigger wraps the Button */}
            <DropdownMenuTrigger asChild disabled={isButtonDisabled}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-full relative",
                  !currentRepo && "text-muted-foreground hover:text-foreground",
                  statusInfo?.colorClass,
                  isButtonDisabled && "opacity-50 cursor-not-allowed", // Style when disabled
                )}
                aria-label="Conversation Git Sync Status"
                // disabled prop is handled by the trigger now
              >
                <FolderSyncIcon className="h-5 w-5" />
                {statusInfo && (
                  <span className="absolute top-0 right-0">
                    {statusInfo.icon}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isButtonDisabled
              ? "Select a conversation to manage sync"
              : currentRepo
                ? statusInfo?.tooltip
                : "Link conversation to sync repository"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Content is only rendered when the trigger is clicked */}
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Conversation Sync</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {syncRepos.map((repo) => (
          <DropdownMenuItem
            key={repo.id}
            onClick={() => handleLinkRepo(repo.id)}
            disabled={!currentConversationId || currentStatus === "syncing"}
          >
            {currentRepoId === repo.id && (
              <CheckCircle2Icon className="mr-2 h-4 w-4 text-green-500" />
            )}
            Link to: {repo.name}
          </DropdownMenuItem>
        ))}
        {currentRepoId && (
          <DropdownMenuItem
            onClick={() => handleLinkRepo(null)}
            disabled={!currentConversationId || currentStatus === "syncing"}
          >
            <XIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            Unlink Repository
          </DropdownMenuItem>
        )}
        {syncRepos.length === 0 && (
          <DropdownMenuItem disabled>No sync repos configured</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSyncClick}
          disabled={
            !currentConversationId ||
            !currentRepoId ||
            currentStatus === "syncing"
          }
        >
          {currentStatus === "syncing" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCwIcon className="mr-2 h-4 w-4" />
          )}
          Sync Now
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleConfigureClick}>
          <Settings2Icon className="mr-2 h-4 w-4" />
          Configure Repositories...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const useGitSyncControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const syncRepoCount = useConversationStore((state) => state.syncRepos.length);

  React.useEffect(() => {
    const control: PromptControl = {
      id: "core-git-sync-control",
      triggerRenderer: () => <GitSyncControlComponent />,
      show: () => true,
      order: 50,
    };

    const unregister = register(control);
    return unregister;
  }, [register, syncRepoCount]);

  return null;
};
