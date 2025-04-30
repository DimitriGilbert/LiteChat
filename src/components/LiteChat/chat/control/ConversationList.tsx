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
import { useItemEditing } from "@/hooks/litechat/useItemEditing"; // Import the hook

// --- Recursive Filtering Helper ---
// (Helper function remains the same)
const itemMatchesFilterOrHasMatchingDescendant = (
  itemId: string,
  itemType: SidebarItemType,
  lowerCaseFilter: string,
  allProjects: Project[],
  allConversations: Conversation[],
  projectsById: Map<string, Project>,
  conversationsByProjectId: Map<string | null, Conversation[]>,
  projectsByParentId: Map<string | null, Project[]>,
  memo: Record<string, boolean>,
): boolean => {
  if (!lowerCaseFilter) return true;

  const cacheKey = `${itemType}-${itemId}`;
  if (memo[cacheKey] !== undefined) {
    return memo[cacheKey];
  }

  let matches = false;
  if (itemType === "project") {
    const project = projectsById.get(itemId);
    if (project) {
      if (project.name.toLowerCase().includes(lowerCaseFilter)) {
        matches = true;
      } else {
        const childProjects = projectsByParentId.get(itemId) || [];
        const childConversations = conversationsByProjectId.get(itemId) || [];

        for (const child of childConversations) {
          if (child.title.toLowerCase().includes(lowerCaseFilter)) {
            matches = true;
            break;
          }
        }
        if (!matches) {
          for (const child of childProjects) {
            if (
              itemMatchesFilterOrHasMatchingDescendant(
                child.id,
                "project",
                lowerCaseFilter,
                allProjects,
                allConversations,
                projectsById,
                conversationsByProjectId,
                projectsByParentId,
                memo,
              )
            ) {
              matches = true;
              break;
            }
          }
        }
      }
    }
  } else {
    const conversation = allConversations.find((c) => c.id === itemId);
    if (
      conversation &&
      conversation.title.toLowerCase().includes(lowerCaseFilter)
    ) {
      matches = true;
    }
  }

  memo[cacheKey] = matches;
  return matches;
};
// --- End Recursive Filtering Helper ---

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
    exportProject,
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
      exportProject: state.exportProject,
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
    editingName,
    localEditingName,
    setLocalEditingName,
    isSavingEdit,
    editInputRef,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
  } = useItemEditing({
    // Pass the required store actions to the hook
    updateProject,
    updateConversation,
    deleteProject, // Pass deleteProject for cancelling new projects
    getProjectById,
    getConversationById,
  });
  // --- End Item Editing Hook ---

  // Wrap toggleProjectExpansion in useCallback
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

  // Wrap getParentProjectId in useCallback
  const getParentProjectId = useCallback(() => {
    if (selectedItemType === "project") {
      return selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = getConversationById(selectedItemId);
      return convo?.projectId ?? null;
    }
    return null;
  }, [selectedItemId, selectedItemType, getConversationById]);

  // Wrap handleNewChat in useCallback
  const handleNewChat = useCallback(async () => {
    if (editingItemId) return; // Prevent action while editing
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
    editingItemId, // Add dependency
    getParentProjectId,
    addConversation,
    selectItem,
    setFocusInputFlag,
  ]);

  // Wrap handleNewProject in useCallback
  const handleNewProject = useCallback(async () => {
    if (editingItemId) return; // Prevent action while editing
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addProject({
        name: "New Project",
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      // Expand the parent project if there is one
      if (parentProjectId) {
        setExpandedProjects((prev) => new Set(prev).add(parentProjectId));
      }
      // Expand the new project itself if needed (though it has no children yet)
      // setExpandedProjects((prev) => new Set(prev).add(newId));

      // Start editing the new project immediately
      setTimeout(() => {
        const newProjectData = getProjectById(newId);
        if (newProjectData) {
          handleStartEditing({ ...newProjectData, itemType: "project" });
        } else {
          // Fallback if data isn't immediately available (less likely now)
          console.warn(
            "New project data not found immediately, using fallback for edit start",
          );
          handleStartEditing({
            id: newId,
            itemType: "project",
            name: "New Project",
            parentId: parentProjectId,
            createdAt: new Date(),
            updatedAt: new Date(),
            path: `/New Project`, // This path might be slightly off
          });
        }
      }, 50); // Small delay to allow state updates
    } catch (error) {
      console.error("Failed to create new project:", error);
      // Error toast handled by store action if needed
    }
  }, [
    editingItemId, // Add dependency
    getParentProjectId,
    addProject,
    selectItem,
    getProjectById,
    handleStartEditing, // Add dependency
  ]);

  // Wrap handleSelectItem in useCallback
  const handleSelectItem = useCallback(
    (id: string, type: SidebarItemType) => {
      if (id === editingItemId) return; // Don't select while editing the same item

      // Handle saving/cancelling edits if clicking away
      if (editingItemId && id !== editingItemId) {
        // Check if the local name is different from the original name
        if (
          localEditingName.trim() &&
          localEditingName.trim() !== editingName
        ) {
          handleSaveEdit(); // Attempt to save if changed
        } else {
          // Cancel otherwise, pass true if it was a "New Project" being cancelled
          handleCancelEdit(
            editingItemType === "project" && editingName === "New Project",
          );
        }
      }

      // Only select if not the currently selected item
      if (id !== selectedItemId || type !== selectedItemType) {
        selectItem(id, type); // Select the item in the conversation store
        if (type === "conversation") {
          setTimeout(() => setFocusInputFlag(true), 0); // Focus input for conversations
        }
      }
    },
    [
      editingItemId,
      editingItemType, // Add dependency
      editingName, // Add dependency
      localEditingName, // Add dependency
      selectedItemId,
      selectedItemType,
      handleSaveEdit, // Add dependency
      handleCancelEdit, // Add dependency
      selectItem,
      setFocusInputFlag,
    ],
  );

  // Wrap handleDeleteConversation in useCallback
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

  // Wrap handleDeleteProject in useCallback
  const handleDeleteProject = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      // Confirmation is handled within ItemRenderer now
      deleteProject(id).catch((error) => {
        console.error("Failed to delete project:", error);
        toast.error("Failed to delete project.");
      });
    },
    [deleteProject],
  );

  // Wrap handleExportConversation in useCallback
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

  // Wrap handleExportProject in useCallback
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

  // --- Precompute maps for filtering helper ---
  const { projectsById, conversationsByProjectId, projectsByParentId } =
    useMemo(() => {
      const projById = new Map(projects.map((p) => [p.id, p]));
      const convosByProjId = new Map<string | null, Conversation[]>();
      conversations.forEach((c) => {
        const key = c.projectId ?? null;
        if (!convosByProjId.has(key)) {
          convosByProjId.set(key, []);
        }
        convosByProjId.get(key)!.push(c);
      });
      const projByParentId = new Map<string | null, Project[]>();
      projects.forEach((p) => {
        const key = p.parentId ?? null;
        if (!projByParentId.has(key)) {
          projByParentId.set(key, []);
        }
        projByParentId.get(key)!.push(p);
      });
      return {
        projectsById: projById,
        conversationsByProjectId: convosByProjId,
        projectsByParentId: projByParentId,
      };
    }, [projects, conversations]);

  // --- Updated getChildren function (uses filtering helper) ---
  const getChildren = useCallback(
    (
      parentId: string | null,
      filter: string,
    ): {
      projects: Project[];
      conversations: Conversation[];
    } => {
      const lowerCaseFilter = filter.toLowerCase();
      const memoCache: Record<string, boolean> = {};

      const childProjects = (projectsByParentId.get(parentId) || []).filter(
        (p) =>
          itemMatchesFilterOrHasMatchingDescendant(
            p.id,
            "project",
            lowerCaseFilter,
            projects,
            conversations,
            projectsById,
            conversationsByProjectId,
            projectsByParentId,
            memoCache,
          ),
      );

      const childConversations = (
        conversationsByProjectId.get(parentId) || []
      ).filter((c) => c.title.toLowerCase().includes(lowerCaseFilter));

      // Sort children by updatedAt descending
      childProjects.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );
      childConversations.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      );

      return { projects: childProjects, conversations: childConversations };
    },
    [
      projects,
      conversations,
      projectsById,
      conversationsByProjectId,
      projectsByParentId,
    ],
  );

  // --- Updated rootItems calculation (uses filtering helper) ---
  const rootItems = useMemo(() => {
    const lowerCaseFilter = filterText.toLowerCase();
    const memoCache: Record<string, boolean> = {};

    const rootProjects = (projectsByParentId.get(null) || []).filter((p) =>
      itemMatchesFilterOrHasMatchingDescendant(
        p.id,
        "project",
        lowerCaseFilter,
        projects,
        conversations,
        projectsById,
        conversationsByProjectId,
        projectsByParentId,
        memoCache,
      ),
    );

    const rootConversations = (conversationsByProjectId.get(null) || []).filter(
      (c) => c.title.toLowerCase().includes(lowerCaseFilter),
    );

    const combined = [
      ...rootProjects.map((p): SidebarItem => ({ ...p, itemType: "project" })),
      ...rootConversations.map(
        (c): SidebarItem => ({ ...c, itemType: "conversation" }),
      ),
    ];
    // Sort root items by updatedAt descending
    combined.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return combined;
  }, [
    projects,
    conversations,
    filterText,
    projectsById,
    conversationsByProjectId,
    projectsByParentId,
  ]);

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
                onSelectItem={handleSelectItem} // Pass the updated handler
                onDeleteConversation={handleDeleteConversation}
                onDeleteProject={handleDeleteProject}
                onExportConversation={handleExportConversation}
                onExportProject={handleExportProject}
                expandedProjects={expandedProjects}
                toggleProjectExpansion={toggleProjectExpansion}
                getChildren={getChildren}
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
