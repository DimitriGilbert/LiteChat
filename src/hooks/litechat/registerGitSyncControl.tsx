// src/hooks/litechat/registerGitSyncControl.tsx
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
import { emitter } from "@/lib/litechat/event-emitter";
import { ModEvent } from "@/types/litechat/modding";
import type { SyncStatus, SyncRepo } from "@/types/litechat/sync";
import type { SidebarItemType } from "@/types/litechat/chat";

// --- Trigger Component ---
const GitSyncControlTrigger: React.FC = () => {
  // Get actions from store
  const { linkConversationToRepo, syncConversation } = useConversationStore(
    useShallow((state) => ({
      linkConversationToRepo: state.linkConversationToRepo,
      syncConversation: state.syncConversation,
    })),
  );

  // Local state managed by events and direct store reads for static data
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => useConversationStore.getState().selectedItemId,
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(
      () => useConversationStore.getState().selectedItemType,
    );
  const [syncRepos, setSyncRepos] = useState<SyncRepo[]>(
    () => useConversationStore.getState().syncRepos,
  );
  const [conversationSyncStatus, setConversationSyncStatus] = useState<
    Record<string, SyncStatus>
  >(() => useConversationStore.getState().conversationSyncStatus);
  const [isStreaming, setIsStreaming] = useState(
    () => useInteractionStore.getState().status === "streaming",
  );
  const [currentRepoId, setCurrentRepoId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<SyncStatus>("idle");

  // Local UI interaction state
  const [isLinking, setIsLinking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Subscribe to events
  useEffect(() => {
    const handleContextChange = (payload: {
      selectedItemId: string | null;
      selectedItemType: SidebarItemType | null;
    }) => {
      setSelectedItemId(payload.selectedItemId);
      setSelectedItemType(payload.selectedItemType);
    };
    const handleSyncRepoChange = () => {
      setSyncRepos(useConversationStore.getState().syncRepos);
    };
    const handleConversationSyncStatusChange = (payload: {
      conversationId: string;
      status: SyncStatus;
    }) => {
      setConversationSyncStatus((prev) => ({
        ...prev,
        [payload.conversationId]: payload.status,
      }));
    };
    const handleInteractionStatusChange = (payload: {
      status: "idle" | "loading" | "streaming" | "error";
    }) => {
      setIsStreaming(payload.status === "streaming");
    };
    const handleConversationUpdate = (payload: {
      conversationId: string;
      updates: Partial<import("@/types/litechat/chat").Conversation>;
    }) => {
      // If the current conversation's syncRepoId changed, update local state
      if (
        payload.conversationId === selectedItemId &&
        payload.updates.syncRepoId !== undefined
      ) {
        setCurrentRepoId(payload.updates.syncRepoId);
      }
    };

    // Initial state sync
    const initialState = useConversationStore.getState();
    setSelectedItemId(initialState.selectedItemId);
    setSelectedItemType(initialState.selectedItemType);
    setSyncRepos(initialState.syncRepos);
    setConversationSyncStatus(initialState.conversationSyncStatus);

    // Subscriptions
    emitter.on(ModEvent.CONTEXT_CHANGED, handleContextChange);
    emitter.on(ModEvent.SYNC_REPO_CHANGED, handleSyncRepoChange);
    emitter.on(
      ModEvent.CONVERSATION_SYNC_STATUS_CHANGED,
      handleConversationSyncStatusChange,
    );
    emitter.on(
      ModEvent.INTERACTION_STATUS_CHANGED,
      handleInteractionStatusChange,
    );
    emitter.on(ModEvent.CONVERSATION_UPDATED, handleConversationUpdate);

    // Cleanup
    return () => {
      emitter.off(ModEvent.CONTEXT_CHANGED, handleContextChange);
      emitter.off(ModEvent.SYNC_REPO_CHANGED, handleSyncRepoChange);
      emitter.off(
        ModEvent.CONVERSATION_SYNC_STATUS_CHANGED,
        handleConversationSyncStatusChange,
      );
      emitter.off(
        ModEvent.INTERACTION_STATUS_CHANGED,
        handleInteractionStatusChange,
      );
      emitter.off(ModEvent.CONVERSATION_UPDATED, handleConversationUpdate);
    };
  }, [selectedItemId]); // Re-run if selectedItemId changes to update conversation-specific listeners

  // Effect to update currentRepoId and currentStatus based on selected item
  useEffect(() => {
    if (selectedItemType === "conversation" && selectedItemId) {
      const conversation = useConversationStore
        .getState()
        .getConversationById(selectedItemId);
      setCurrentRepoId(conversation?.syncRepoId ?? null);
      setCurrentStatus(conversationSyncStatus[selectedItemId] ?? "idle");
    } else {
      setCurrentRepoId(null);
      setCurrentStatus("idle");
    }
  }, [selectedItemId, selectedItemType, conversationSyncStatus]);

  // Memoized repo name map
  const repoNameMap = React.useMemo(
    () => new Map(syncRepos.map((r) => [r.id, r.name])),
    [syncRepos],
  );
  const currentRepoName = currentRepoId
    ? repoNameMap.get(currentRepoId)
    : undefined;

  // --- Event Handlers ---
  const handleLinkChange = useCallback(
    async (repoId: string) => {
      if (!selectedItemId || selectedItemType !== "conversation") return;
      setIsLinking(true);
      const newRepoId = repoId === "none" ? null : repoId;
      // linkConversationToRepo will update the conversation and trigger status change event
      await linkConversationToRepo(selectedItemId, newRepoId);
      setIsLinking(false);
    },
    [selectedItemId, selectedItemType, linkConversationToRepo],
  );

  const handleSyncNow = useCallback(async () => {
    if (!selectedItemId || !currentRepoId) return;
    setIsSyncing(true);
    // syncConversation will update status via events
    await syncConversation(selectedItemId);
    setIsSyncing(false);
  }, [selectedItemId, currentRepoId, syncConversation]);

  // --- Render Logic ---
  const syncIndicator = getSyncIndicator(currentStatus, currentRepoName);
  const isSyncButtonDisabled =
    !currentRepoId ||
    isSyncing ||
    isLinking ||
    isStreaming ||
    currentStatus === "syncing";

  // Only render if a conversation is selected and sync repos exist
  if (selectedItemType !== "conversation" || syncRepos.length === 0) {
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

// --- Registration Function ---
export function registerGitSyncControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  registerPromptControl({
    id: "core-git-sync",
    // order removed
    triggerRenderer: () => React.createElement(GitSyncControlTrigger),
    // show function removed - component handles visibility based on syncRepos.length
    // show: () => useConversationStore.getState().syncRepos.length > 0,
  });

  console.log("[Function] Registered Core Git Sync Control");
}
