// src/controls/components/conversation-list/ConversationListControlComponent.tsx
// FULL FILE
import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  useConversationStore,
  type SidebarItem,
} from "@/store/conversation.store";
import { useProjectStore } from "@/store/project.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, FolderPlusIcon, SearchIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { SidebarItemType } from "@/types/litechat/chat";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { Project } from "@/types/litechat/project";
import type { Conversation } from "@/types/litechat/chat";
import { ConversationItemRenderer } from "./ItemRenderer";
import { useItemEditing } from "@/hooks/litechat/useItemEditing";
import type { ConversationListControlModule } from "@/controls/modules/ConversationListControlModule";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface VirtualListItem {
  id: string; // Unique ID for the virtual list item (e.g., `project-${projectId}` or `conversation-${conversationId}`)
  originalId: string; // The actual ID of the project or conversation
  type: SidebarItemType;
  level: number;
  data: Project | Conversation; // The actual project or conversation data
  updatedAt: Date; // For sorting
}

const itemMatchesFilterOrHasMatchingDescendant = (
  itemId: string,
  itemType: SidebarItemType,
  lowerCaseFilter: string,
  allProjects: Project[],
  allConversations: Conversation[],
  projectsById: Map<string, Project>,
  conversationsByProjectId: Map<string | null, Conversation[]>,
  projectsByParentId: Map<string | null, Project[]>,
  memo: Record<string, boolean>
): boolean => {
  if (!lowerCaseFilter) return true;
  const cacheKey = `${itemType}-${itemId}`;
  if (memo[cacheKey] !== undefined) return memo[cacheKey];
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
                memo
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

interface ConversationListControlComponentProps {
  module: ConversationListControlModule;
}

export const ConversationListControlComponent: React.FC<
  ConversationListControlComponentProps
> = ({ module }) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportReady, setViewportReady] = useState(false);
  const [, forceUpdate] = useState({});

  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    if (
      module.isLoading &&
      !useConversationStore.getState().isLoading &&
      !useProjectStore.getState().isLoading
    ) {
      module.setIsLoading(false);
    }
    return () => module.setNotifyCallback(null);
  }, [module]);

  useEffect(() => {
    const currentScrollArea = listRef.current;
    if (currentScrollArea) {
      const viewportElement = currentScrollArea.querySelector<HTMLDivElement>(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewportElement && viewportRef.current !== viewportElement) {
        viewportRef.current = viewportElement;
        if (!viewportReady) setViewportReady(true);
        forceUpdate({});
      } else if (!viewportElement && viewportRef.current) {
        viewportRef.current = null;
        setViewportReady(false);
      }
      if (!viewportRef.current) {
        const observer = new MutationObserver(() => {
          const vp = currentScrollArea.querySelector<HTMLDivElement>(
            "[data-radix-scroll-area-viewport]"
          );
          if (vp && viewportRef.current !== vp) {
            viewportRef.current = vp;
            setViewportReady(true);
            forceUpdate({});
            observer.disconnect();
          }
        });
        observer.observe(currentScrollArea, { childList: true, subtree: true });
        return () => observer.disconnect();
      }
    }
  }, [listRef.current, viewportReady]);

  const {
    selectedItemId,
    selectedItemType,
    conversations,
    syncRepos,
    conversationSyncStatus,
    selectItem,
    addConversation,
    updateConversation,
    deleteConversation,
    exportConversation,
    exportProject,
    getConversationById,
  } = useConversationStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      conversations: state.conversations,
      syncRepos: state.syncRepos,
      conversationSyncStatus: state.conversationSyncStatus,
      selectItem: state.selectItem,
      addConversation: state.addConversation,
      updateConversation: state.updateConversation,
      deleteConversation: state.deleteConversation,
      exportConversation: state.exportConversation,
      exportProject: state.exportProject,
      getConversationById: state.getConversationById,
    }))
  );

  const { projects, addProject, updateProject, deleteProject, getProjectById } =
    useProjectStore(
      useShallow((state) => ({
        projects: state.projects,
        addProject: state.addProject,
        updateProject: state.updateProject,
        deleteProject: state.deleteProject,
        getProjectById: state.getProjectById,
      }))
    );

  const isLoading = module.isLoading;

  const [expandedProjects, setExpandedProjects] = React.useState<Set<string>>(
    new Set()
  );
  const [filterText, setFilterText] = useState("");

  const editingState = useItemEditing({
    updateProject,
    updateConversation,
    deleteProject,
  });

  const {
    editingItemId,
    editingItemType,
    isSavingEdit,
    handleStartEditing,
    handleSaveEdit,
    handleCancelEdit,
    originalNameToCompare,
  } = editingState;

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
      if (id === editingItemId && type === editingItemType) return;
      if (editingItemId && (id !== editingItemId || type !== editingItemType)) {
        handleCancelEdit();
      }
      if (id !== selectedItemId || type !== selectedItemType) {
        selectItem(id, type);
      }
    },
    [
      editingItemId,
      editingItemType,
      selectedItemId,
      selectedItemType,
      handleCancelEdit,
      selectItem,
    ]
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
    [deleteConversation]
  );

  const handleDeleteProject = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteProject(id).catch((error) => {
        console.error("Failed to delete project:", error);
        toast.error("Failed to delete project.");
      });
    },
    [deleteProject]
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
    [exportConversation]
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
    [exportProject]
  );

  const repoNameMap = useMemo(() => {
    return new Map((syncRepos || []).map((r) => [r.id, r.name]));
  }, [syncRepos]);

  const { projectsById, conversationsByProjectId, projectsByParentId } =
    useMemo(() => {
      const projById = new Map(projects.map((p) => [p.id, p]));
      const convosByProjId = new Map<string | null, Conversation[]>();
      conversations.forEach((c) => {
        const key = c.projectId ?? null;
        if (!convosByProjId.has(key)) convosByProjId.set(key, []);
        convosByProjId.get(key)!.push(c);
      });
      const projByParentId = new Map<string | null, Project[]>();
      projects.forEach((p) => {
        const key = p.parentId ?? null;
        if (!projByParentId.has(key)) projByParentId.set(key, []);
        projByParentId.get(key)!.push(p);
      });
      return {
        projectsById: projById,
        conversationsByProjectId: convosByProjId,
        projectsByParentId: projByParentId,
      };
    }, [projects, conversations]);

  const flattenedVisibleItems = useMemo((): VirtualListItem[] => {
    const flatList: VirtualListItem[] = [];
    const lowerCaseFilter = filterText.toLowerCase();
    const memoCache: Record<string, boolean> = {};

    function addChildren(parentId: string | null, level: number) {
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
            memoCache
          )
      );

      const childConversations = (
        conversationsByProjectId.get(parentId) || []
      ).filter((c) => c.title.toLowerCase().includes(lowerCaseFilter));

      // Combine projects and conversations at this level
      const combinedChildren: (Project | Conversation)[] = [
        ...childProjects,
        ...childConversations,
      ];

      // Sort combined children by updatedAt descending
      combinedChildren.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      combinedChildren.forEach((item) => {
        if ("path" in item) {
          // It's a Project
          flatList.push({
            id: `project-${item.id}`,
            originalId: item.id,
            type: "project",
            level,
            data: item,
            updatedAt: item.updatedAt,
          });
          if (expandedProjects.has(item.id)) {
            addChildren(item.id, level + 1);
          }
        } else {
          // It's a Conversation
          flatList.push({
            id: `conversation-${item.id}`,
            originalId: item.id,
            type: "conversation",
            level,
            data: item,
            updatedAt: item.updatedAt,
          });
        }
      });
    }

    addChildren(null, 0);
    return flatList;
  }, [
    projects,
    conversations,
    filterText,
    expandedProjects,
    projectsById,
    conversationsByProjectId,
    projectsByParentId,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: flattenedVisibleItems.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 30,
    overscan: 10,
  });

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
      <ScrollArea className="flex-grow" ref={listRef}>
        {isLoading && flattenedVisibleItems.length === 0 ? (
          <div className="space-y-1 p-1">
            <div className="h-8 w-full bg-muted rounded animate-pulse" />
            <div className="h-8 w-full bg-muted rounded animate-pulse" />
            <div className="h-8 w-full bg-muted rounded animate-pulse" />
          </div>
        ) : !isLoading && flattenedVisibleItems.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2 text-center">
            {filterText.trim() !== ""
              ? "No items match your filter."
              : "Workspace is empty."}
          </p>
        ) : (
          viewportReady && (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const itemData = flattenedVisibleItems[virtualRow.index];
                if (!itemData) return null;

                const itemForRenderer: SidebarItem = {
                  ...(itemData.data as any),
                  itemType: itemData.type,
                };

                return (
                  <div
                    key={itemData.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="px-1"
                  >
                    <ConversationItemRenderer
                      item={itemForRenderer}
                      level={itemData.level}
                      selectedItemId={selectedItemId}
                      conversationSyncStatus={conversationSyncStatus}
                      repoNameMap={repoNameMap}
                      onSelectItem={() =>
                        handleSelectItem(itemData.originalId, itemData.type)
                      }
                      onDeleteConversation={handleDeleteConversation}
                      onDeleteProject={handleDeleteProject}
                      onExportConversation={handleExportConversation}
                      onExportProject={handleExportProject}
                      expandedProjects={expandedProjects}
                      toggleProjectExpansion={toggleProjectExpansion}
                      editingItemId={editingItemId}
                      editingItemType={editingItemType}
                      handleStartEditing={handleStartEditing}
                      handleSaveEdit={handleSaveEdit}
                      handleCancelEdit={handleCancelEdit}
                      isSavingEdit={isSavingEdit}
                      originalNameToCompare={originalNameToCompare}
                    />
                  </div>
                );
              })}
            </div>
          )
        )}
        {!viewportReady && !isLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Initializing list...
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
