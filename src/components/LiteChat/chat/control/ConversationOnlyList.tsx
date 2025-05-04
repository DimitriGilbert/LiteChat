// src/components/LiteChat/chat/control/ConversationOnlyList.tsx

import React from "react";
import { useConversationStore } from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  Trash2Icon,
  GitBranchIcon,
  Loader2,
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { SyncStatus } from "@/types/litechat/sync";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useUIStateStore } from "@/store/ui.store";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Helper to get sync icon and tooltip (remains the same)
const getSyncIndicatorInternal = (
  status: SyncStatus | undefined,
  repoName: string | undefined,
): React.ReactNode => {
  if (!repoName) return null;

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
    case "idle":
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
    selectItem,
    selectedItemId,
    addConversation,
    deleteConversation,
    exportConversation,
    isLoading,
    syncRepos,
    conversationSyncStatus,
  } = useConversationStore(
    useShallow((state) => ({
      conversations: state.conversations,
      // projects removed from selector
      selectItem: state.selectItem,
      selectedItemId: state.selectedItemId,
      addConversation: state.addConversation,
      deleteConversation: state.deleteConversation,
      exportConversation: state.exportConversation,
      isLoading: state.isLoading,
      syncRepos: state.syncRepos,
      conversationSyncStatus: state.conversationSyncStatus,
    })),
  );
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);

  const handleNewChat = async () => {
    try {
      // Pass null for projectId as this list doesn't handle projects
      const newId = await addConversation({
        title: "New Chat",
        projectId: null,
      });
      selectItem(newId, "conversation");
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  const handleSelectItem = (id: string, type: "conversation" | "project") => {
    // This component only handles conversations
    if (type !== "conversation") return;
    if (id === selectedItemId) return;
    selectItem(id, type);
    setTimeout(() => setFocusInputFlag(true), 0);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this conversation? This cannot be undone.")) {
      deleteConversation(id).catch((error) => {
        console.error("Failed to delete conversation:", error);
        toast.error("Failed to delete conversation.");
      });
    }
  };

  const handleExport = async (
    id: string,
    format: "json" | "md",
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    try {
      await exportConversation(id, format);
    } catch (error) {
      console.error(`Failed to export conversation as ${format}:`, error);
    }
  };

  const repoNameMap = React.useMemo(() => {
    return new Map((syncRepos || []).map((r) => [r.id, r.name]));
  }, [syncRepos]);

  // Directly use conversations as items to render
  const itemsToRender = conversations;

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
        ) : itemsToRender.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-0.5 p-1">
            {itemsToRender.map((c) => {
              const syncStatus = conversationSyncStatus[c.id];
              const repoName = c.syncRepoId
                ? repoNameMap.get(c.syncRepoId)
                : undefined;
              const syncIndicator = getSyncIndicatorInternal(
                syncStatus,
                repoName,
              );

              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex justify-between items-center group p-1.5 text-xs rounded cursor-pointer",
                    "border border-transparent",
                    "hover:bg-muted/50 hover:text-primary/80",
                    c.id === selectedItemId
                      ? "bg-primary/10 text-primary font-medium border-primary dark:bg-primary/20 dark:border-primary/70"
                      : "",
                  )}
                  onClick={() => handleSelectItem(c.id, "conversation")}
                >
                  <div className="flex items-center min-w-0">
                    <span className="truncate pr-1">
                      {c.title || "Untitled"}
                    </span>
                    {syncIndicator}
                  </div>
                  <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Export ${c.title || "Untitled"}`}
                              >
                                <DownloadIcon className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">Export</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent
                        onClick={(e) => e.stopPropagation()}
                        align="end"
                      >
                        <DropdownMenuItem
                          onClick={(e) => handleExport(c.id, "json", e)}
                        >
                          Export as JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleExport(c.id, "md", e)}
                        >
                          Export as Markdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:text-destructive/80"
                            onClick={(e) => handleDelete(c.id, e)}
                            aria-label={`Delete ${c.title || "Untitled"}`}
                          >
                            <Trash2Icon className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};
