// src/components/LiteChat/chat/control/conversation-list/ItemRenderer.tsx
import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Edit2Icon,
  Trash2Icon,
  CheckIcon,
  XIcon,
  FolderIcon,
  MessageSquareIcon,
  DownloadIcon,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getSyncIndicator } from "@/components/LiteChat/chat/control/conversation-list/SyncIndicator";
import type { SidebarItemType } from "@/types/litechat/chat";
import type { SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import { Conversation } from "@/types/litechat/chat";
import { SidebarItem } from "@/store/conversation.store";

interface ConversationItemProps {
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
  handleCancelEdit: (isNewProject?: boolean) => void;
  isSavingEdit: boolean;
  editInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ConversationItemRenderer: React.FC<ConversationItemProps> = ({
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
  editInputRef,
}) => {
  const isSelected = item.id === selectedItemId;
  const isProject = item.itemType === "project";
  const isEditingThis =
    item.id === editingItemId && item.itemType === editingItemType;

  // Correctly determine if the current project item is expanded
  const isExpanded = isProject && expandedProjects.has(item.id);

  const { projects: childProjects, conversations: childConversations } =
    isProject ? getChildren(item.id) : { projects: [], conversations: [] };
  const hasChildren = childProjects.length > 0 || childConversations.length > 0;

  const syncStatus =
    !isProject && item.syncRepoId ? conversationSyncStatus[item.id] : undefined;
  const repoName =
    !isProject && item.syncRepoId
      ? repoNameMap.get(item.syncRepoId)
      : undefined;
  const syncIndicator =
    !isProject && repoName ? getSyncIndicator(syncStatus, repoName) : null;

  const handleItemClick = () => {
    if (isEditingThis) return;
    // Only toggle expansion if it's a project *and* has children
    if (isProject && hasChildren) {
      toggleProjectExpansion(item.id);
    }
    // Always select the item
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
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      // Pass flag if it was a new project being edited
      handleCancelEdit(isProject && item.name === "New Project");
    }
  };

  const handleInputBlur = () => {
    // Save on blur only if not currently saving and name is not empty
    if (!isSavingEdit && editingName.trim()) {
      handleSaveEdit();
    } else if (!editingName.trim()) {
      // If name is empty on blur, cancel the edit
      handleCancelEdit(isProject && item.name === "New Project");
    }
  };

  useEffect(() => {
    if (isEditingThis) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditingThis, editInputRef]);

  // Determine display name correctly
  const displayName = isProject ? item.name : item.title;

  return (
    <>
      <li
        key={item.id}
        className={cn(
          "flex justify-between items-center group p-1.5 text-xs rounded",
          "border border-transparent",
          !isEditingThis && "hover:bg-muted/50 hover:text-primary/80",
          isSelected && !isEditingThis
            ? "bg-primary/10 text-primary font-medium border-primary dark:bg-primary/20 dark:border-primary/70"
            : "",
          isEditingThis && "bg-muted ring-1 ring-primary",
          !isEditingThis && "cursor-pointer",
        )}
        style={{ paddingLeft: `${0.375 + level * 0.75}rem` }}
        onClick={handleItemClick}
      >
        <div className="flex items-center min-w-0 gap-1 flex-grow mr-1">
          {isProject && hasChildren && (
            <span
              className="flex-shrink-0 w-3 cursor-pointer p-0.5 -ml-0.5"
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
              ref={editInputRef as React.RefObject<HTMLInputElement>}
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              className="h-6 px-1 py-0 text-xs flex-grow min-w-0"
              onClick={(e) => e.stopPropagation()}
              disabled={isSavingEdit}
            />
          ) : (
            <span className="truncate pr-1">{displayName}</span>
          )}
          {syncIndicator}
        </div>

        <div className="flex items-center flex-shrink-0">
          {isEditingThis ? (
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
                  // Pass flag if it was a new project being edited
                  handleCancelEdit(isProject && item.name === "New Project");
                }}
                disabled={isSavingEdit}
                aria-label="Cancel edit"
              >
                <XIcon className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                      onClick={handleEditClick}
                      aria-label={`Edit ${displayName}`}
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
                        <div
                          className="p-1 rounded hover:bg-muted cursor-pointer" // Make container clickable
                          aria-label={`Export ${displayName}`}
                        >
                          <DownloadIcon className="h-3 w-3 text-muted-foreground group-hover/export:text-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">Export</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div
                    className="absolute right-0 top-full mt-1 hidden group-hover/export:flex
                                   bg-popover border border-border rounded-md shadow-lg p-0.5 z-10 gap-0.5"
                    onClick={(e) => e.stopPropagation()}
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
                      aria-label={`Delete ${displayName}`}
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
              <ConversationItemRenderer
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
          {childConversations
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((child) => (
              <ConversationItemRenderer
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
        </>
      )}
    </>
  );
};
