// src/components/LiteChat/chat/control/ConversationList.tsx

import React, { useMemo, useState, useCallback } from "react";
import {
  useConversationStore,
  type SidebarItem,
} from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, FolderPlusIcon, SearchIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { SidebarItemType } from "@/types/litechat/chat";
import { Skeleton } from "@/components/ui/skeleton";
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

// --- Recursive Filtering Helper ---
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
  // --- State Selection ---
  const selectedItemId = useConversationStore((state) => state.selectedItemId);
  const selectedItemType = useConversationStore(
    (state) => state.selectedItemType,
  );
  const isConversationLoading = useConversationStore(
    (state) => state.isLoading,
  );
  const isProjectLoading = useProjectStore((state) => state.isLoading);

  const { conversations, syncRepos, conversationSyncStatus } =
    useConversationStore(
      useShallow((state) => ({
        conversations: state.conversations,
        syncRepos: state.syncRepos,
        conversationSyncStatus: state.conversationSyncStatus,
      })),
    );
  const projects = useProjectStore((state) => state.projects);

  const selectItem = useConversationStore((state) => state.selectItem);
  const addConversation = useConversationStore(
    (state) => state.addConversation,
  );
  const updateConversation = useConversationStore(
    (state) => state.updateConversation,
  );
  const deleteConversation = useConversationStore(
    (state) => state.deleteConversation,
  );
  const exportConversation = useConversationStore(
    (state) => state.exportConversation,
  );
  const exportProject = useConversationStore((state) => state.exportProject);
  const getConversationById = useConversationStore(
    (state) => state.getConversationById,
  );
  const addProject = useProjectStore((state) => state.addProject);
  const updateProject = useProjectStore((state) => state.updateProject);
  const deleteProject = useProjectStore((state) => state.deleteProject);
  const getProjectById = useProjectStore((state) => state.getProjectById);

  // --- Local UI State ---
  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set(),
  );
  const [filterText, setFilterText] = useState("");

  const isLoading = isConversationLoading || isProjectLoading;

  // --- Use the Item Editing Hook ---
  const editingState = useItemEditing({
    updateProject,
    updateConversation,
    deleteProject,
    getProjectById,
    getConversationById,
  });
  const {
    editingItemId,
    editingItemType,
    originalName,
    localEditingName,
    setLocalEditingName,
    isSavingEdit,
    editInputRef,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
  } = editingState;
  // --- End Item Editing Hook ---

  // --- Callbacks ---
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
      // Selection will trigger focus via LiteChat's context change effect
      selectItem(newId, "conversation");
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error("Failed to create new chat.");
    }
  }, [editingItemId, getParentProjectId, addConversation, selectItem]);

  const handleNewProject = useCallback(async () => {
    if (editingItemId) return;
    try {
      const parentProjectId = getParentProjectId();
      const newId = await addProject({
        name: "New Project",
        parentId: parentProjectId,
      });
      selectItem(newId, "project");
      if (parentProjectId) {
        setExpandedProjects((prev) => new Set(prev).add(parentProjectId));
      }
      setTimeout(() => {
        const newProjectData = getProjectById(newId);
        if (newProjectData) {
          handleStartEditing({ ...newProjectData, itemType: "project" });
        } else {
          console.warn("New project data not found, cannot start edit.");
        }
      }, 50);
    } catch (error) {
      console.error("Failed to create new project:", error);
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
        if (
          localEditingName.trim() &&
          localEditingName.trim() !== originalName
        ) {
          handleSaveEdit();
        } else {
          handleCancelEdit();
        }
      }

      if (id !== selectedItemId || type !== selectedItemType) {
        // Selection will trigger focus via LiteChat's context change effect
        selectItem(id, type);
      }
    },
    [
      editingItemId,
      localEditingName,
      originalName,
      selectedItemId,
      selectedItemType,
      handleSaveEdit,
      handleCancelEdit,
      selectItem,
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
      // Confirmation handled in ItemRenderer
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
      }
    },
    [exportConversation],
  );

  const handleExportProject = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await exportProject(id);
      } catch (error) {
        console.error("Failed to export project:", error);
      }
    },
    [exportProject],
  );

  // --- Memoized Derived Data ---
  const repoNameMap = useMemo(() => {
    return new Map((syncRepos || []).map((r) => [r.id, r.name]));
  }, [syncRepos]);

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

  // Memoize getChildren to prevent re-renders of items when filter text changes but children don't
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

      // Sorting is cheap, can stay inside if needed, or memoize separately if complex
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

  // Memoize the root items calculation
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
                getChildren={getChildren} // Pass memoized getChildren
                filterText={filterText}
                editingItemId={editingItemId}
                editingItemType={editingItemType}
                originalName={originalName}
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
