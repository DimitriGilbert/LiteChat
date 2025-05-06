// src/components/LiteChat/chat/control/conversation-list/ItemRenderer.tsx
// FULL FILE
import React, { memo } from "react";
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
  FileJsonIcon,
  CogIcon,
} from "lucide-react";
import { getSyncIndicator } from "@/components/LiteChat/chat/control/conversation-list/SyncIndicator";
import type { SidebarItemType } from "@/types/litechat/chat";
import type { SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import { Conversation } from "@/types/litechat/chat";
import { SidebarItem } from "@/store/conversation.store";
import { useUIStateStore } from "@/store/ui.store";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

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
  onExportProject: (id: string, e: React.MouseEvent) => void;
  expandedProjects: Set<string>;
  toggleProjectExpansion: (projectId: string) => void;
  getChildren: (
    parentId: string | null,
    filterText: string,
  ) => {
    projects: Project[];
    conversations: Conversation[];
  };
  filterText: string;
  editingItemId: string | null;
  editingItemType: SidebarItemType | null;
  originalName: string;
  localEditingName: string;
  setLocalEditingName: (name: string) => void;
  handleStartEditing: (item: SidebarItem) => void;
  handleSaveEdit: () => Promise<void>;
  handleCancelEdit: (isNewProject?: boolean) => void;
  isSavingEdit: boolean;
  editInputRef: React.RefObject<HTMLInputElement | null>;
}

export const ConversationItemRenderer = memo<ConversationItemProps>(
  ({
    item,
    level,
    selectedItemId,
    conversationSyncStatus,
    repoNameMap,
    onSelectItem,
    onDeleteConversation,
    onDeleteProject,
    onExportConversation,
    onExportProject,
    expandedProjects,
    toggleProjectExpansion,
    getChildren,
    filterText,
    editingItemId,
    editingItemType,
    originalName,
    localEditingName,
    setLocalEditingName,
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

    const isExpanded = isProject && expandedProjects.has(item.id);

    const { projects: childProjects, conversations: childConversations } =
      isProject
        ? getChildren(item.id, filterText)
        : { projects: [], conversations: [] };
    const hasChildren =
      childProjects.length > 0 || childConversations.length > 0;

    const syncStatus =
      !isProject && item.syncRepoId
        ? conversationSyncStatus[item.id]
        : undefined;
    const repoName =
      !isProject && item.syncRepoId
        ? repoNameMap.get(item.syncRepoId)
        : undefined;
    const syncIndicator =
      !isProject && repoName ? getSyncIndicator(syncStatus, repoName) : null;

    const openProjectSettingsModal = useUIStateStore(
      (state) => state.openProjectSettingsModal,
    );

    const handleItemClick = () => {
      if (isEditingThis) return;
      if (isProject && hasChildren) {
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

    const handleSettingsClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isProject) {
        openProjectSettingsModal(item.id);
      }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    };

    const displayName = isProject ? item.name : item.title;

    const SaveIconComponent = isSavingEdit ? Loader2 : CheckIcon;
    const saveIconClassName = isSavingEdit ? "h-3 w-3 animate-spin" : "h-3 w-3";

    return (
      <>
        <li
          key={item.id}
          className={cn(
            "relative flex justify-between items-center group p-1.5 text-xs rounded",
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
          title={!isEditingThis ? displayName : ""}
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
            {isProject && !hasChildren && (
              <span className="w-3 flex-shrink-0" />
            )}
            {isProject ? (
              <FolderIcon className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
            ) : (
              <MessageSquareIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
            )}
            {isEditingThis ? (
              <Input
                ref={editInputRef as React.RefObject<HTMLInputElement>}
                value={localEditingName}
                onChange={(e) => setLocalEditingName(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="h-6 px-1 py-0 text-xs flex-grow min-w-0"
                onClick={(e) => e.stopPropagation()}
                disabled={isSavingEdit}
              />
            ) : (
              <span className="truncate min-w-0 flex-1">{displayName}</span>
            )}
            {syncIndicator}
          </div>

          <div
            className={cn(
              "items-center flex-shrink-0 ml-1",
              isEditingThis
                ? "flex"
                : "hidden group-hover:flex transition-all duration-150",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isEditingThis ? (
              <>
                <ActionTooltipButton
                  tooltipText="Save (Enter)"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                  disabled={isSavingEdit || !localEditingName.trim()}
                  aria-label="Save changes"
                  icon={<SaveIconComponent />}
                  iconClassName={saveIconClassName}
                  className="h-5 w-5 text-green-500 hover:text-green-600"
                />
                <ActionTooltipButton
                  tooltipText="Cancel (Esc)"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  disabled={isSavingEdit}
                  aria-label="Cancel edit"
                  icon={<XIcon />}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                />
              </>
            ) : (
              <>
                {isProject && (
                  <ActionTooltipButton
                    tooltipText="Project Settings"
                    onClick={handleSettingsClick}
                    aria-label={`Settings for ${displayName}`}
                    icon={<CogIcon />}
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  />
                )}
                <ActionTooltipButton
                  tooltipText="Edit"
                  onClick={handleEditClick}
                  aria-label={`Edit ${displayName}`}
                  icon={<Edit2Icon />}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                />
                {isProject ? (
                  <ActionTooltipButton
                    tooltipText="Export Project (JSON)"
                    onClick={(e) => onExportProject(item.id, e)}
                    aria-label={`Export project ${displayName}`}
                    icon={<FileJsonIcon />}
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  />
                ) : (
                  <div className="relative group/export">
                    <ActionTooltipButton
                      tooltipText="Export Conversation"
                      aria-label={`Export ${displayName}`}
                      icon={<DownloadIcon />}
                      className="h-5 w-5 text-muted-foreground group-hover/export:text-foreground"
                    />
                    <div
                      className="absolute right-0 top-full mt-1 hidden group-hover/export:flex
                                   bg-popover border border-border rounded-md shadow-lg p-0.5 z-10 gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs"
                        onClick={(e) =>
                          onExportConversation(item.id, "json", e)
                        }
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
                <ActionTooltipButton
                  tooltipText="Delete"
                  onClick={handleDeleteClick}
                  aria-label={`Delete ${displayName}`}
                  icon={<Trash2Icon />}
                  className="h-5 w-5 text-destructive hover:text-destructive/80"
                />
              </>
            )}
          </div>
        </li>
        {isProject && isExpanded && (
          <>
            {childProjects
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
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
                  onExportProject={onExportProject}
                  expandedProjects={expandedProjects}
                  toggleProjectExpansion={toggleProjectExpansion}
                  getChildren={getChildren}
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
            {childConversations
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
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
                  onExportProject={onExportProject}
                  expandedProjects={expandedProjects}
                  toggleProjectExpansion={toggleProjectExpansion}
                  getChildren={getChildren}
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
          </>
        )}
      </>
    );
  },
);
ConversationItemRenderer.displayName = "ConversationItemRenderer";
