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
import type { ChatControl } from "@/types/litechat/chat";
import type { SyncStatus } from "@/types/litechat/sync";
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
// Import DropdownMenu components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// Helper to get sync icon and tooltip (remains the same)
// NOTE: This function is likely duplicated from SyncIndicator.tsx
// It's kept here to fix the lint error in *this* file, but should ideally be removed
// and imported from the dedicated component if this file is kept.
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
    conversations, // Use combined items later
    // projects, // Use combined items later
    selectItem, // Use selectItem
    selectedItemId, // Use selectedItemId
    addConversation,
    deleteConversation,
    exportConversation,
    isLoading,
    syncRepos,
    conversationSyncStatus,
  } = useConversationStore(
    useShallow((state) => ({
      conversations: state.conversations,
      projects: state.projects,
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
      // TODO: Add to selected project if applicable
      const newId = await addConversation({ title: "New Chat" });
      selectItem(newId, "conversation"); // Use selectItem
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  // TODO: Update this to handle projects as well
  const handleSelectItem = (id: string, type: "conversation" | "project") => {
    if (id === selectedItemId) return;
    selectItem(id, type); // Use selectItem
    if (type === "conversation") {
      setTimeout(() => setFocusInputFlag(true), 0);
    }
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
    return new Map(syncRepos.map((r) => [r.id, r.name]));
  }, [syncRepos]);

  // --- TODO: Replace this simple list rendering with hierarchical rendering ---
  // This is a placeholder until the Project UI is fully implemented
  const itemsToRender = conversations; // Replace with combined/structured list

  return (
    <div className="p-2 border-r border-[--border] bg-card text-card-foreground h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 flex-shrink-0 px-1">
        <h3 className="text-sm font-semibold">Conversations</h3>
        {/* TODO: Add "New Project" button */}
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
                    c.id === selectedItemId // Use selectedItemId
                      ? "bg-primary/10 text-primary font-medium border-primary dark:bg-primary/20 dark:border-primary/70"
                      : "",
                  )}
                  onClick={() => handleSelectItem(c.id, "conversation")} // Use handleSelectItem
                >
                  <div className="flex items-center min-w-0">
                    {/* TODO: Add Project Icon */}
                    <span className="truncate pr-1">
                      {c.title || "Untitled"}
                    </span>
                    {syncIndicator}
                  </div>
                  {/* Action Buttons - Visible on Hover */}
                  <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Single Download Button with Dropdown */}
                    <DropdownMenu>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* Dropdown Trigger is the Button */}
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onClick={(e) => e.stopPropagation()} // Prevent row click
                                aria-label={`Export ${c.title || "Untitled"}`}
                              >
                                <DownloadIcon className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top">Export</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {/* Dropdown Content */}
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

                    {/* Delete Button */}
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

// Icon-only renderer needs update for projects too
// Removed export
const ConversationListIconRenderer: React.FC = () => {
  const { addConversation, selectItem } = useConversationStore(
    useShallow((state) => ({
      addConversation: state.addConversation,
      selectItem: state.selectItem,
    })),
  );
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);

  const handleNewChat = async () => {
    try {
      // TODO: Add to selected project if applicable
      const newId = await addConversation({ title: "New Chat" });
      selectItem(newId, "conversation");
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  // TODO: Add New Project Icon Button

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

// Registration Hook remains the same for now
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
