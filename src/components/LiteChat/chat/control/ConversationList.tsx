// src/components/LiteChat/chat/control/ConversationList.tsx
import React, { useMemo, useState, useCallback } from "react"; // Added useState, useCallback
import {
  useConversationStore,
  type SidebarItem,
} from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Added Input for inline editing
import {
  PlusIcon,
  Trash2Icon,
  GitBranchIcon,
  Loader2,
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FolderIcon,
  MessageSquareIcon,
  FolderPlusIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Edit2Icon, // Added Edit icon
  CheckIcon, // Added Check icon for save
  XIcon, // Added X icon for cancel
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { ChatControl, SidebarItemType } from "@/types/litechat/chat";
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
// DropdownMenu imports removed
import { toast } from "sonner";
import { Project } from "@/types/litechat/project";
import { Conversation } from "@/types/litechat/chat";

// Helper to get sync icon and tooltip (remains the same)
const getSyncIndicator = (
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

// --- Recursive Sidebar Item Renderer ---
interface SidebarItemProps {
  item: SidebarItem;
  level: number;
  selectedItemId: string | null;
  conversationSyncStatus: Record<string, SyncStatus>;
  repoNameMap: Map<string, string>;
  onSelectItem: (id: string, type: SidebarItemType) => void;
  onDeleteConversation: (id: string, e: React.MouseEvent) => void;
  onDeleteProject: (id: string, e: React.MouseEvent) => void;
  onExportConversation: (
    id: string,
    format: "json" | "md",
    e: React.MouseEvent,
  ) => void;
  expandedProjects: Set<string>;
  toggleProjectExpansion: (projectId: string) => void;
  getChildren: (parentId: string | null) => {
    projects: Project[];
    conversations: Conversation[];
  };
  // Inline Editing Props
  editingItemId: string | null;
  editingItemType: SidebarItemType | null;
  editingName: string;
  setEditingName: (name: string) => void;
  handleStartEditing: (item: SidebarItem) => void;
  handleSaveEdit: () => Promise<void>;
  handleCancelEdit: () => void;
  isSavingEdit: boolean;
}

const SidebarItemRenderer: React.FC<SidebarItemProps> = ({
  item,
  level,
  selectedItemId,
  conversationSyncStatus,
  repoNameMap,
  onSelectItem,
  onDeleteConversation,
  onDeleteProject,
  onExportConversation,
  expandedProjects,
  toggleProjectExpansion,
  getChildren,
  // Inline Editing Props
  editingItemId,
  editingItemType,
  editingName,
  setEditingName,
  handleStartEditing,
  handleSaveEdit,
  handleCancelEdit,
  isSavingEdit,
}) => {
  const isSelected = item.id === selectedItemId;
  const isProject = item.itemType === "project";
  const isExpanded = isProject && expandedProjects.has(item.id);
  const isEditingThis =
    item.id === editingItemId && item.itemType === editingItemType;

  const { projects: childProjects, conversations: childConversations } =
    isProject ? getChildren(item.id) : { projects: [], conversations: [] };
  const hasChildren = childProjects.length > 0 || childConversations.length > 0;

  // Conversation specific data
  const syncStatus =
    !isProject && item.syncRepoId ? conversationSyncStatus[item.id] : undefined;
  const repoName =
    !isProject && item.syncRepoId
      ? repoNameMap.get(item.syncRepoId)
      : undefined;
  const syncIndicator =
    !isProject && repoName ? getSyncIndicator(syncStatus, repoName) : null;

  const handleItemClick = () => {
    if (isEditingThis) return; // Don't select/toggle when editing input
    if (isProject) {
      toggleProjectExpansion(item.id);
    }
    onSelectItem(item.id, item.itemType);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProject) {
      if (
        window.confirm(
          `Delete project "${item.name}" and ALL its contents (sub-projects and conversations)? This cannot be undone.`,
        )
      ) {
        onDeleteProject(item.id, e);
      }
    } else {
      onDeleteConversation(item.id, e);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleStartEditing(item);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleInputBlur = () => {
    // Slight delay to allow save button click to register
    setTimeout(() => {
      // Check if still editing this item before saving on blur
      if (
        useConversationStore.getState().editingItemId === item.id &&
        !isSavingEdit
      ) {
        handleSaveEdit();
      }
    }, 100);
  };

  return (
    <>
      <li
        key={item.id}
        className={cn(
          "flex justify-between items-center group p-1.5 text-xs rounded", // Removed cursor-pointer here, apply conditionally
          "border border-transparent",
          !isEditingThis && "hover:bg-muted/50 hover:text-primary/80",
          isSelected && !isEditingThis
            ? "bg-primary/10 text-primary font-medium border-primary dark:bg-primary/20 dark:border-primary/70"
            : "",
          isEditingThis && "bg-muted ring-1 ring-primary",
          !isEditingThis && "cursor-pointer", // Add cursor only when not editing
        )}
        style={{ paddingLeft: `${0.375 + level * 0.75}rem` }}
        onClick={handleItemClick}
      >
        {/* Item Icon and Name/Input */}
        <div className="flex items-center min-w-0 gap-1 flex-grow mr-1">
          {isProject && hasChildren && (
            <span
              className="flex-shrink-0 w-3 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                toggleProjectExpansion(item.id);
              }}
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
              )}
            </span>
          )}
          {isProject && !hasChildren && <span className="w-3 flex-shrink-0" />}
          {isProject ? (
            <FolderIcon className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
          ) : (
            <MessageSquareIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
          )}
          {isEditingThis ? (
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              className="h-6 px-1 py-0 text-xs flex-grow min-w-0"
              autoFocus
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()} // Prevent row click
              disabled={isSavingEdit}
            />
          ) : (
            <span className="truncate pr-1">{item.name || item.title}</span>
          )}
          {syncIndicator}
        </div>

        {/* Action Buttons Area */}
        <div className="flex items-center flex-shrink-0">
          {isEditingThis ? (
            // Save/Cancel Buttons
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-green-500 hover:text-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveEdit();
                }}
                disabled={isSavingEdit || !editingName.trim()}
                aria-label="Save changes"
              >
                {isSavingEdit ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckIcon className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                disabled={isSavingEdit}
                aria-label="Cancel edit"
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </>
          ) : (
            // Hover Buttons (Edit, Export, Delete)
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={handleEditClick}
                      aria-label={`Edit ${item.name || item.title}`}
                    >
                      <Edit2Icon className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Edit</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {!isProject && (
                <div className="relative group/export">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()} // Prevent row click, hover handles action
                          aria-label={`Export ${item.title || "Untitled"}`}
                        >
                          <DownloadIcon className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Export</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {/* Hover Content for Export */}
                  <div
                    className="absolute right-0 top-full mt-1 hidden group-hover/export:flex
                                   bg-popover border border-border rounded-md shadow-lg p-1 z-10 gap-0.5"
                    onClick={(e) => e.stopPropagation()} // Prevent clicks inside closing it immediately
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-xs"
                      onClick={(e) => onExportConversation(item.id, "json", e)}
                    >
                      JSON
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-xs"
                      onClick={(e) => onExportConversation(item.id, "md", e)}
                    >
                      MD
                    </Button>
                  </div>
                </div>
              )}

              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-destructive hover:text-destructive/80"
                      onClick={handleDeleteClick}
                      aria-label={`Delete ${item.name || item.title}`}
                    >
                      <Trash2Icon className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </li>
      {/* Render Children if Project is Expanded */}
      {isProject && isExpanded && (
        <>
          {childProjects
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => (
              <SidebarItemRenderer
                key={child.id}
                item={{ ...child, itemType: "project" }}
                level={level + 1}
                selectedItemId={selectedItemId}
                conversationSyncStatus={conversationSyncStatus}
                repoNameMap={repoNameMap}
                onSelectItem={onSelectItem}
                onDeleteConversation={onDeleteConversation}
                onDeleteProject={onDeleteProject}
                onExportConversation={onExportConversation}
                expandedProjects={expandedProjects}
                toggleProjectExpansion={toggleProjectExpansion}
                getChildren={getChildren}
                // Pass editing state down
                editingItemId={editingItemId}
                editingItemType={editingItemType}
                editingName={editingName}
                setEditingName={setEditingName}
                handleStartEditing={handleStartEditing}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                isSavingEdit={isSavingEdit}
              />
            ))}
          {childConversations
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((child) => (
              <SidebarItemRenderer
                key={child.id}
                item={{ ...child, itemType: "conversation" }}
                level={level + 1}
                selectedItemId={selectedItemId}
                conversationSyncStatus={conversationSyncStatus}
                repoNameMap={repoNameMap}
                onSelectItem={onSelectItem}
                onDeleteConversation={onDeleteConversation}
                onDeleteProject={onDeleteProject}
                onExportConversation={onExportConversation}
                expandedProjects={expandedProjects}
                toggleProjectExpansion={toggleProjectExpansion}
                getChildren={getChildren}
                // Pass editing state down
                editingItemId={editingItemId}
                editingItemType={editingItemType}
                editingName={editingName}
                setEditingName={setEditingName}
                handleStartEditing={handleStartEditing}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                isSavingEdit={isSavingEdit}
              />
            ))}
        </>
      )}
    </>
  );
};

// --- Main Control Component ---
export const ConversationListControlComponent: React.FC = () => {
  const {
    conversations,
    projects,
    selectItem,
    selectedItemId,
    selectedItemType,
    addConversation,
    updateConversation, // Add update action
    deleteConversation,
    addProject,
    updateProject, // Add update action
    deleteProject,
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
      selectedItemType: state.selectedItemType,
      addConversation: state.addConversation,
      updateConversation: state.updateConversation, // Get update action
      deleteConversation: state.deleteConversation,
      addProject: state.addProject,
      updateProject: state.updateProject, // Get update action
      deleteProject: state.deleteProject,
      exportConversation: state.exportConversation,
      isLoading: state.isLoading,
      syncRepos: state.syncRepos,
      conversationSyncStatus: state.conversationSyncStatus,
    })),
  );
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set(),
  );

  // --- Inline Editing State ---
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemType, setEditingItemType] =
    useState<SidebarItemType | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const handleStartEditing = useCallback((item: SidebarItem) => {
    setEditingItemId(item.id);
    setEditingItemType(item.itemType);
    setEditingName(item.itemType === "project" ? item.name : item.title);
    setIsSavingEdit(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingItemId(null);
    setEditingItemType(null);
    setEditingName("");
    setIsSavingEdit(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingItemId || !editingItemType || !editingName.trim()) {
      handleCancelEdit(); // Cancel if name is empty
      return;
    }
    setIsSavingEdit(true);
    try {
      if (editingItemType === "project") {
        await updateProject(editingItemId, { name: editingName.trim() });
      } else {
        await updateConversation(editingItemId, { title: editingName.trim() });
      }
      handleCancelEdit(); // Reset state on success
    } catch (error) {
      console.error("Failed to save edit:", error);
      toast.error("Failed to save changes.");
      // Keep editing state on error to allow retry
    } finally {
      setIsSavingEdit(false);
    }
  }, [
    editingItemId,
    editingItemType,
    editingName,
    updateProject,
    updateConversation,
    handleCancelEdit,
  ]);
  // --- End Inline Editing State ---

  const toggleProjectExpansion = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleNewChat = async () => {
    try {
      const parentProjectId =
        selectedItemType === "project" ? selectedItemId : null;
      const newId = await addConversation({
        title: "New Chat",
        projectId: parentProjectId,
      });
      selectItem(newId, "conversation");
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error("Failed to create new chat.");
    }
  };

  const handleNewProject = async () => {
    // No prompt needed now
    try {
      const parentProjectId =
        selectedItemType === "project" ? selectedItemId : null;
      const newId = await addProject({
        name: "New Project", // Default name
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      setExpandedProjects((prev) => new Set(prev).add(newId));
      // Immediately start editing the new project
      handleStartEditing({
        id: newId,
        itemType: "project",
        name: "New Project",
        // Add other required Project fields with default/dummy values if needed by handleStartEditing
        parentId: parentProjectId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Failed to create new project:", error);
      toast.error("Failed to create new project.");
    }
  };

  const handleSelectItem = (id: string, type: SidebarItemType) => {
    if (id === editingItemId) return; // Prevent selection change while editing
    if (id === selectedItemId && type === selectedItemType) return;
    selectItem(id, type);
    if (type === "conversation") {
      setTimeout(() => setFocusInputFlag(true), 0);
    }
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this conversation? This cannot be undone.")) {
      deleteConversation(id).catch((error) => {
        console.error("Failed to delete conversation:", error);
        toast.error("Failed to delete conversation.");
      });
    }
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Confirmation is handled within the SidebarItemRenderer now
    deleteProject(id).catch((error) => {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project.");
    });
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

  const repoNameMap = useMemo(() => {
    return new Map(syncRepos.map((r) => [r.id, r.name]));
  }, [syncRepos]);

  const getChildren = useMemo(() => {
    return (parentId: string | null) => {
      const childProjects = projects.filter((p) => p.parentId === parentId);
      const childConversations = conversations.filter(
        (c) => c.projectId === parentId,
      );
      return { projects: childProjects, conversations: childConversations };
    };
  }, [projects, conversations]);

  const rootItems = useMemo(() => {
    const rootProjects = projects
      .filter((p) => p.parentId === null)
      .sort((a, b) => a.name.localeCompare(b.name));
    const rootConversations = conversations
      .filter((c) => c.projectId === null)
      .sort((a, b) => a.title.localeCompare(b.title));
    return [
      ...rootProjects.map((p): SidebarItem => ({ ...p, itemType: "project" })),
      ...rootConversations.map(
        (c): SidebarItem => ({ ...c, itemType: "conversation" }),
      ),
    ];
  }, [projects, conversations]);

  return (
    <div className="p-2 border-r border-[--border] bg-card text-card-foreground h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 flex-shrink-0 px-1">
        <h3 className="text-sm font-semibold">Workspace</h3>
        <div className="flex items-center">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNewProject}
                  aria-label="New Project"
                  disabled={isLoading || !!editingItemId} // Disable if editing
                  className="h-7 w-7 p-0"
                >
                  <FolderPlusIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Project</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleNewChat}
                  aria-label="New Chat"
                  disabled={isLoading || !!editingItemId} // Disable if editing
                  className="h-7 w-7 p-0"
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <ScrollArea className="flex-grow">
        {isLoading ? (
          <div className="space-y-1 p-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rootItems.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">
            Workspace is empty.
          </p>
        ) : (
          <ul className="space-y-0.5 p-1">
            {rootItems.map((item) => (
              <SidebarItemRenderer
                key={item.id}
                item={item}
                level={0}
                selectedItemId={selectedItemId}
                conversationSyncStatus={conversationSyncStatus}
                repoNameMap={repoNameMap}
                onSelectItem={handleSelectItem}
                onDeleteConversation={handleDeleteConversation}
                onDeleteProject={handleDeleteProject}
                onExportConversation={handleExport}
                expandedProjects={expandedProjects}
                toggleProjectExpansion={toggleProjectExpansion}
                getChildren={getChildren}
                // Pass editing state/handlers
                editingItemId={editingItemId}
                editingItemType={editingItemType}
                editingName={editingName}
                setEditingName={setEditingName}
                handleStartEditing={handleStartEditing}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                isSavingEdit={isSavingEdit}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};

// Icon-only renderer needs update for projects too
export const ConversationListIconRenderer: React.FC = () => {
  const {
    addConversation,
    addProject,
    selectItem,
    selectedItemId,
    selectedItemType,
    getConversationById, // Need this selector
  } = useConversationStore(
    useShallow((state) => ({
      addConversation: state.addConversation,
      addProject: state.addProject,
      selectItem: state.selectItem,
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      getConversationById: state.getConversationById, // Get selector
    })),
  );
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);

  // Helper to determine parent project ID based on current selection
  const getParentProjectId = () => {
    if (selectedItemType === "project") {
      return selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = getConversationById(selectedItemId); // Use the selector
      return convo?.projectId ?? null;
    }
    return null;
  };

  const handleNewChat = async () => {
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addConversation({
        title: "New Chat",
        projectId: parentProjectId,
      });
      selectItem(newId, "conversation");
      setTimeout(() => setFocusInputFlag(true), 0);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  const handleNewProject = async () => {
    // No prompt needed
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addProject({
        name: "New Project",
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      // Cannot trigger inline edit from here easily, user needs to expand sidebar
    } catch (error) {
      console.error("Failed to create new project:", error);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewProject}
              className="h-8 w-8"
              aria-label="New Project"
            >
              <FolderPlusIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New Project</TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
    </div>
  );
};

// Registration Hook
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
