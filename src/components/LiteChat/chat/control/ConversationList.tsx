// src/components/LiteChat/chat/control/ConversationList.tsx
import React, { useMemo, useState, useCallback } from "react";
import {
  useConversationStore,
  type SidebarItem,
} from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, FolderPlusIcon, SearchIcon } from "lucide-react";
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
import { ConversationItemRenderer } from "@/components/LiteChat/chat/control/conversation-list/ItemRenderer";
import { useItemEditing } from "@/hooks/litechat/useItemEditing";

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
    exportProject, // Added project export action
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
      exportProject: state.exportProject, // Get project export action
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
  const [filterText, setFilterText] = useState("");

  // --- Use the Item Editing Hook ---
  const {
    editingItemId,
    editingItemType,
    editingName, // Original name
    localEditingName, // Input value state
    setLocalEditingName, // Setter for input value
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

  const toggleProjectExpansion = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const getParentProjectId = useCallback(() => {
    if (selectedItemType === "project") {
      return selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = getConversationById(selectedItemId);
      return convo?.projectId ?? null;
    }
    return null;
  }, [selectedItemId, selectedItemType, getConversationById]);

  const handleNewChat = useCallback(async () => {
    if (editingItemId) return;
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
  }, [
    editingItemId,
    getParentProjectId,
    addConversation,
    selectItem,
    setFocusInputFlag,
  ]);

  const handleNewProject = useCallback(async () => {
    if (editingItemId) return;
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addProject({
        name: "New Project",
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      setExpandedProjects((prev) => new Set(prev).add(newId));

      setTimeout(() => {
        const newProjectData = getProjectById(newId);
        if (newProjectData) {
          handleStartEditing({ ...newProjectData, itemType: "project" });
        } else {
          console.warn(
            "New project data not found immediately, using fallback",
          );
          handleStartEditing({
            id: newId,
            itemType: "project",
            name: "New Project",
            parentId: parentProjectId,
            createdAt: new Date(),
            updatedAt: new Date(),
            path: `/New Project`, // Placeholder path
          });
        }
      }, 50);
    } catch (error) {
      console.error("Failed to create new project:", error);
      // Error toast handled by store action if it's a name collision
    }
  }, [
    editingItemId,
    getParentProjectId,
    addProject,
    selectItem,
    getProjectById,
    handleStartEditing,
  ]);

  const handleSelectItem = useCallback(
    (id: string, type: SidebarItemType) => {
      if (id === editingItemId) return;
      if (editingItemId && id !== editingItemId) {
        // Attempt to save if name is valid and changed, otherwise cancel
        if (
          localEditingName.trim() &&
          localEditingName.trim() !== editingName
        ) {
          handleSaveEdit();
        } else {
          handleCancelEdit(
            editingItemType === "project" && editingName === "New Project",
          );
        }
      }
      if (id === selectedItemId && type === selectedItemType) return;
      selectItem(id, type);
      if (type === "conversation") {
        setTimeout(() => setFocusInputFlag(true), 0);
      }
    },
    [
      editingItemId,
      editingItemType,
      editingName,
      localEditingName,
      selectedItemId,
      selectedItemType,
      handleSaveEdit,
      handleCancelEdit,
      selectItem,
      setFocusInputFlag,
    ],
  );

  const handleDeleteConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Delete this conversation? This cannot be undone.")) {
        deleteConversation(id).catch((error) => {
          console.error("Failed to delete conversation:", error);
          toast.error("Failed to delete conversation.");
        });
      }
    },
    [deleteConversation],
  );

  const handleDeleteProject = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      // Confirmation is handled within the ItemRenderer now
      deleteProject(id).catch((error) => {
        console.error("Failed to delete project:", error);
        toast.error("Failed to delete project.");
      });
    },
    [deleteProject],
  );

  const handleExportConversation = useCallback(
    async (id: string, format: "json" | "md", e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await exportConversation(id, format);
      } catch (error) {
        console.error(`Failed to export conversation as ${format}:`, error);
        // Toast handled by store action
      }
    },
    [exportConversation],
  );

  // Added project export handler
  const handleExportProject = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await exportProject(id);
      } catch (error) {
        console.error("Failed to export project:", error);
        // Toast handled by store action
      }
    },
    [exportProject],
  );

  const repoNameMap = useMemo(() => {
    return new Map(syncRepos.map((r) => [r.id, r.name]));
  }, [syncRepos]);

  // --- Updated getChildren function ---
  const getChildren = useMemo(() => {
    return (
      parentId: string | null,
      filter: string,
    ): {
      projects: Project[];
      conversations: Conversation[];
    } => {
      const lowerCaseFilter = filter.toLowerCase();
      const childProjects = projects
        .filter((p) => p.parentId === parentId)
        .filter(
          (p) => !filter || p.name.toLowerCase().includes(lowerCaseFilter),
        )
        // Sort children by date descending
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      const childConversations = conversations
        .filter((c) => c.projectId === parentId)
        .filter(
          (c) => !filter || c.title.toLowerCase().includes(lowerCaseFilter),
        )
        // Sort children by date descending
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return { projects: childProjects, conversations: childConversations };
    };
  }, [projects, conversations]); // Dependencies are the raw data arrays

  // --- Updated rootItems calculation ---
  const rootItems = useMemo(() => {
    const lowerCaseFilter = filterText.toLowerCase();
    const rootProjects = projects
      .filter((p) => p.parentId === null)
      .filter(
        (p) => !filterText || p.name.toLowerCase().includes(lowerCaseFilter),
      )
      // Sort root projects by date descending
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const rootConversations = conversations
      .filter((c) => c.projectId === null)
      .filter(
        (c) => !filterText || c.title.toLowerCase().includes(lowerCaseFilter),
      )
      // Sort root conversations by date descending
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Combine and sort the combined list by date descending
    const combined = [
      ...rootProjects.map((p): SidebarItem => ({ ...p, itemType: "project" })),
      ...rootConversations.map(
        (c): SidebarItem => ({ ...c, itemType: "conversation" }),
      ),
    ];
    combined.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return combined;
  }, [projects, conversations, filterText]); // Added filterText dependency

  return (
    <div className="p-2 border-r border-[--border] bg-card text-card-foreground h-full flex flex-col">
      {/* Header */}
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
                  disabled={isLoading || !!editingItemId}
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
                  disabled={isLoading || !!editingItemId}
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

      {/* Filter Input */}
      <div className="relative mb-2 px-1 flex-shrink-0">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Filter..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="h-8 text-xs pl-8"
          disabled={isLoading}
        />
      </div>

      {/* List Area */}
      <ScrollArea className="flex-grow">
        {isLoading ? (
          <div className="space-y-1 p-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rootItems.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">
            {filterText.trim() !== ""
              ? "No items match your filter."
              : "Workspace is empty."}
          </p>
        ) : (
          <ul className="space-y-0.5 p-1">
            {rootItems.map((item) => (
              <ConversationItemRenderer
                key={item.id}
                item={item}
                level={0}
                selectedItemId={selectedItemId}
                conversationSyncStatus={conversationSyncStatus}
                repoNameMap={repoNameMap}
                onSelectItem={handleSelectItem}
                onDeleteConversation={handleDeleteConversation}
                onDeleteProject={handleDeleteProject}
                onExportConversation={handleExportConversation}
                onExportProject={handleExportProject}
                expandedProjects={expandedProjects}
                toggleProjectExpansion={toggleProjectExpansion}
                getChildren={getChildren} // Pass the memoized getChildren
                filterText={filterText}
                // Pass editing state and handlers from the hook
                editingItemId={editingItemId}
                editingItemType={editingItemType}
                editingName={editingName}
                localEditingName={localEditingName}
                setLocalEditingName={setLocalEditingName}
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
