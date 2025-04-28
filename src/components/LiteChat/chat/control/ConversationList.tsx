// src/components/LiteChat/chat/control/ConversationList.tsx
import React, { useMemo } from "react";
import {
  useConversationStore,
  type SidebarItem,
} from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PlusIcon, FolderPlusIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { SidebarItemType } from "@/types/litechat/chat";
import { Skeleton } from "@/components/ui/skeleton";
import { useUIStateStore } from "@/store/ui.store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Project } from "@/types/litechat/project";
import { Conversation } from "@/types/litechat/chat";
import { ConversationItemRenderer } from "@/components/LiteChat/chat/control/conversation-list/ItemRenderer"; // Import the item renderer
import { useItemEditing } from "@/hooks/litechat/useItemEditing"; // Import the editing hook

// --- Main Control Component ---
export const ConversationListControlComponent: React.FC = () => {
  const {
    conversations,
    projects,
    selectItem,
    selectedItemId,
    selectedItemType,
    addConversation,
    updateConversation,
    deleteConversation,
    addProject,
    updateProject,
    deleteProject,
    exportConversation,
    isLoading,
    syncRepos,
    conversationSyncStatus,
    getConversationById,
    getProjectById,
  } = useConversationStore(
    useShallow((state) => ({
      conversations: state.conversations,
      projects: state.projects,
      selectItem: state.selectItem,
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      addConversation: state.addConversation,
      updateConversation: state.updateConversation,
      deleteConversation: state.deleteConversation,
      addProject: state.addProject,
      updateProject: state.updateProject,
      deleteProject: state.deleteProject,
      exportConversation: state.exportConversation,
      isLoading: state.isLoading,
      syncRepos: state.syncRepos,
      conversationSyncStatus: state.conversationSyncStatus,
      getConversationById: state.getConversationById,
      getProjectById: state.getProjectById,
    })),
  );
  const setFocusInputFlag = useUIStateStore((state) => state.setFocusInputFlag);
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set(),
  );

  // --- Use the Item Editing Hook ---
  const {
    editingItemId,
    editingItemType,
    editingName,
    setEditingName,
    isSavingEdit,
    editInputRef,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
  } = useItemEditing({
    updateProject,
    updateConversation,
    deleteProject,
    getProjectById,
    getConversationById,
  });
  // --- End Item Editing Hook ---

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

  const getParentProjectId = () => {
    if (selectedItemType === "project") {
      return selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = getConversationById(selectedItemId);
      return convo?.projectId ?? null;
    }
    return null;
  };

  const handleNewChat = async () => {
    if (editingItemId) return; // Don't allow creating while editing
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
      toast.error("Failed to create new chat.");
    }
  };

  const handleNewProject = async () => {
    if (editingItemId) return; // Don't allow creating while editing
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addProject({
        name: "New Project",
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      setExpandedProjects((prev) => new Set(prev).add(newId));

      // Fetch the newly created project to pass to handleStartEditing
      // Need a slight delay potentially for the store to update
      setTimeout(() => {
        const newProjectData = getProjectById(newId);
        if (newProjectData) {
          handleStartEditing({ ...newProjectData, itemType: "project" });
        } else {
          // Fallback if project data isn't immediately available
          console.warn(
            "New project data not found immediately, using fallback",
          );
          handleStartEditing({
            id: newId,
            itemType: "project",
            name: "New Project",
            parentId: parentProjectId,
            createdAt: new Date(), // Placeholder
            updatedAt: new Date(), // Placeholder
            path: `/New Project`, // Placeholder
          });
        }
      }, 50); // Small delay to allow store update
    } catch (error) {
      console.error("Failed to create new project:", error);
      // Error toast handled by store action if it's a name collision
    }
  };

  const handleSelectItem = (id: string, type: SidebarItemType) => {
    if (id === editingItemId) return; // Don't select while editing this item
    // If editing is active, save or cancel it before selecting a new item
    if (editingItemId && id !== editingItemId) {
      // Attempt to save if name is valid, otherwise cancel
      if (editingName.trim()) {
        handleSaveEdit(); // This will reset editing state on success/failure
      } else {
        handleCancelEdit(
          editingItemType === "project" && editingName === "New Project",
        );
      }
    }
    if (id === selectedItemId && type === selectedItemType) return; // Already selected
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
    // Confirmation is handled within the ItemRenderer now, but the actual delete call is here
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
      // Toast handled by store action
    }
  };

  const repoNameMap = useMemo(() => {
    return new Map(syncRepos.map((r) => [r.id, r.name]));
  }, [syncRepos]);

  const getChildren = useMemo(() => {
    // Memoize the function itself
    return (
      parentId: string | null,
    ): {
      projects: Project[];
      conversations: Conversation[];
    } => {
      const childProjects = projects.filter((p) => p.parentId === parentId);
      const childConversations = conversations.filter(
        (c) => c.projectId === parentId,
      );
      return { projects: childProjects, conversations: childConversations };
    };
  }, [projects, conversations]); // Dependencies are the raw data arrays

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
                  disabled={isLoading || !!editingItemId} // Disable if loading or editing
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
                  disabled={isLoading || !!editingItemId} // Disable if loading or editing
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
              <ConversationItemRenderer // Use the imported renderer
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
                // Pass editing state and handlers from the hook
                editingItemId={editingItemId}
                editingItemType={editingItemType}
                editingName={editingName}
                setEditingName={setEditingName}
                handleStartEditing={handleStartEditing}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                isSavingEdit={isSavingEdit}
                editInputRef={editInputRef}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
};
