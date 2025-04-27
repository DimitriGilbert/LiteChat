// src/components/LiteChat/chat/control/ConversationList.tsx
import React from "react";
import { useConversationStore } from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  Trash2Icon,
  GitBranchIcon, // Import Git icon
  Loader2, // Import Loader
  AlertCircleIcon, // Import Alert icon
  CheckCircle2Icon, // Import Check icon
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { ChatControl } from "@/types/litechat/chat";
import type { SyncStatus } from "@/types/litechat/sync"; // Import SyncStatus
import { useControlRegistryStore } from "@/store/control.store";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useUIStateStore } from "@/store/ui.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Helper to get sync icon and tooltip
const getSyncIndicator = (
  status: SyncStatus | undefined,
  repoName: string | undefined,
): React.ReactNode => {
  if (!repoName) return null; // No indicator if not linked

  let IconComponent: React.ElementType = GitBranchIcon;
  let className = "text-muted-foreground/70";
  let tooltipText = `Linked to ${repoName}`;

  switch (status) {
    case "syncing":
      IconComponent = Loader2;
      className = "animate-spin text-blue-500";
      tooltipText = `Syncing with ${repoName}...`;
      break;
    case "error":
      IconComponent = AlertCircleIcon;
      className = "text-destructive";
      tooltipText = `Sync error with ${repoName}`;
      break;
    case "needs-sync":
      IconComponent = AlertCircleIcon;
      className = "text-orange-500";
      tooltipText = `Needs sync with ${repoName}`;
      break;
    case "idle": // Synced successfully
      IconComponent = CheckCircle2Icon;
      className = "text-green-500";
      tooltipText = `Synced with ${repoName}`;
      break;
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <IconComponent
            className={cn("h-3 w-3 ml-1 flex-shrink-0", className)}
          />
        </TooltipTrigger>
        <TooltipContent side="right">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ConversationListControlComponent: React.FC = () => {
  const {
    conversations,
    selectConversation,
    selectedConversationId,
    addConversation,
    deleteConversation,
    isLoading,
    syncRepos, // Get sync repos
    conversationSyncStatus, // Get sync statuses
  } = useConversationStore(
    useShallow((state) => ({
      conversations: state.conversations,
      selectConversation: state.selectConversation,
      selectedConversationId: state.selectedConversationId,
      addConversation: state.addConversation,
      deleteConversation: state.deleteConversation,
      isLoading: state.isLoading,
      syncRepos: state.syncRepos, // Select sync repos
      conversationSyncStatus: state.conversationSyncStatus, // Select sync statuses
    })),
  );
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);

  const handleNewChat = async () => {
    try {
      const newId = await addConversation({ title: "New Chat" });
      selectConversation(newId);
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  const handleSelectChat = (id: string) => {
    if (id === selectedConversationId) return;
    selectConversation(id);
    setTimeout(() => setFocusInputFlag(true), 0);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this conversation? This cannot be undone.")) {
      deleteConversation(id).catch((error) => {
        console.error("Failed to delete conversation:", error);
      });
    }
  };

  // Map repo IDs to names for quick lookup
  const repoNameMap = React.useMemo(() => {
    return new Map(syncRepos.map((r) => [r.id, r.name]));
  }, [syncRepos]);

  return (
    <div className="p-2 border-r border-[--border] bg-card text-card-foreground h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 flex-shrink-0 px-1">
        <h3 className="text-sm font-semibold">Conversations</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleNewChat}
          aria-label="New Chat"
          disabled={isLoading}
          className="h-7 w-7 p-0"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-grow">
        {isLoading ? (
          <div className="space-y-1 p-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-0.5 p-1">
            {conversations.map((c) => {
              const syncStatus = conversationSyncStatus[c.id];
              const repoName = c.syncRepoId
                ? repoNameMap.get(c.syncRepoId)
                : undefined;
              const syncIndicator = getSyncIndicator(syncStatus, repoName);

              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex justify-between items-center group p-1.5 text-xs rounded cursor-pointer",
                    "border border-transparent",
                    "hover:bg-muted/50 hover:text-primary/80",
                    c.id === selectedConversationId
                      ? "bg-primary/10 text-primary font-medium border-primary dark:bg-primary/20 dark:border-primary/70"
                      : "",
                  )}
                  onClick={() => handleSelectChat(c.id)}
                >
                  <div className="flex items-center min-w-0">
                    <span className="truncate pr-1">
                      {c.title || "Untitled"}
                    </span>
                    {/* Render Sync Indicator */}
                    {syncIndicator}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={(e) => handleDelete(c.id, e)}
                    aria-label={`Delete conversation ${c.title || "Untitled"}`}
                  >
                    <Trash2Icon className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};

// Icon-only renderer for collapsed sidebar
export const ConversationListIconRenderer: React.FC = () => {
  const { addConversation, selectConversation } = useConversationStore(
    useShallow((state) => ({
      addConversation: state.addConversation,
      selectConversation: state.selectConversation,
    })),
  );
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);

  const handleNewChat = async () => {
    try {
      const newId = await addConversation({ title: "New Chat" });
      selectConversation(newId);
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNewChat}
            className="h-8 w-8"
            aria-label="New Chat"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">New Chat</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Registration Hook/Component
export const useConversationListControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  const isLoading = useConversationStore((state) => state.isLoading);

  React.useEffect(() => {
    const control: ChatControl = {
      id: "core-conversation-list",
      status: () => (isLoading ? "loading" : "ready"),
      panel: "sidebar",
      renderer: () => <ConversationListControlComponent />,
      iconRenderer: () => <ConversationListIconRenderer />,
      show: () => true,
      order: 10,
    };
    const unregister = register(control);
    return unregister;
  }, [register, isLoading]);

  return null;
};
