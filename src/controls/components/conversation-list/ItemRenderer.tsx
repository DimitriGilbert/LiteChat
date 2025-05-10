// src/controls/components/conversation-list/ItemRenderer.tsx
// FULL FILE
import React, { memo, useState, useEffect, useRef } from "react";
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
import { getSyncIndicator } from "@/controls/components/conversation-list/SyncIndicator";
import type { SidebarItemType } from "@/types/litechat/chat";
import type { SyncStatus } from "@/types/litechat/sync";
import type { Project } from "@/types/litechat/project";
import type { Conversation } from "@/types/litechat/chat";
import { SidebarItem } from "@/store/conversation.store";
import { useUIStateStore } from "@/store/ui.store";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { toast } from "sonner";

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
    e: React.MouseEvent
  ) => void;
  onExportProject: (id: string, e: React.MouseEvent) => void;
  expandedProjects: Set<string>;
  toggleProjectExpansion: (projectId: string) => void;
  editingItemId: string | null; // Global editing item ID
  editingItemType: SidebarItemType | null; // Global editing item type
  handleStartEditing: (item: SidebarItem) => void; // Global start edit
  handleSaveEdit: (
    // Global save edit, now takes item ID and type
    itemId: string,
    itemType: SidebarItemType,
    newName?: string
  ) => Promise<void>;
  handleCancelEdit: (isNewProject?: boolean) => void; // Global cancel edit
  isSavingEdit: boolean; // Global saving state
  originalNameToCompare: string;
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
    editingItemId,
    editingItemType,
    handleStartEditing,
    handleSaveEdit: globalHandleSaveEdit,
    handleCancelEdit: globalHandleCancelEdit,
    isSavingEdit,
    originalNameToCompare,
  }) => {
    const isSelected = item.id === selectedItemId;
    const isProject = item.itemType === "project";

    const isGloballyEditingThis =
      item.id === editingItemId && item.itemType === editingItemType;

    const [localEditName, setLocalEditName] = useState(
      isProject ? (item as Project).name : (item as Conversation).title
    );
    const localEditInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (isGloballyEditingThis) {
        const currentName = isProject
          ? (item as Project).name
          : (item as Conversation).title;
        setLocalEditName(currentName);
        requestAnimationFrame(() => {
          localEditInputRef.current?.focus();
          localEditInputRef.current?.select();
        });
      }
    }, [isGloballyEditingThis, item, isProject]);

    useEffect(() => {
      if (!isGloballyEditingThis) {
        const currentItemName = isProject
          ? (item as Project).name
          : (item as Conversation).title;
        if (localEditName !== currentItemName) {
          setLocalEditName(currentItemName);
        }
      }
    }, [
      isProject ? (item as Project).name : (item as Conversation).title,
      isGloballyEditingThis,
      localEditName,
      isProject,
    ]);

    const isExpanded = isProject && expandedProjects.has(item.id);
    const canExpand = isProject;

    const syncStatus =
      !isProject && (item as Conversation).syncRepoId
        ? conversationSyncStatus[item.id]
        : undefined;
    const repoName =
      !isProject && (item as Conversation).syncRepoId
        ? repoNameMap.get((item as Conversation).syncRepoId!)
        : undefined;
    const syncIndicator =
      !isProject && repoName ? getSyncIndicator(syncStatus, repoName) : null;

    const openProjectSettingsModal = useUIStateStore(
      (state) => state.openProjectSettingsModal
    );

    const handleItemClick = () => {
      if (isGloballyEditingThis) return;
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
            `Delete project "${
              (item as Project).name
            }" and ALL its contents (sub-projects and conversations)? This cannot be undone.`
          )
        ) {
          onDeleteProject(item.id, e);
        }
      } else {
        onDeleteConversation(item.id, e);
      }
    };

    const startLocalEditingWrapper = (e: React.MouseEvent) => {
      e.stopPropagation();
      handleStartEditing(item);
    };

    const cancelLocalEditWrapper = () => {
      setLocalEditName(originalNameToCompare); // Revert local input before global cancel
      globalHandleCancelEdit(
        item.itemType === "project" && originalNameToCompare === "New Project"
      );
    };

    const saveLocalEditWrapper = async () => {
      if (isSavingEdit) return; // Prevent re-entry if already saving
      const trimmedName = localEditName.trim();
      // Call global save with item's ID and type
      await globalHandleSaveEdit(item.id, item.itemType, trimmedName);
    };

    const handleInputBlur = () => {
      // Do not process blur if a save is already in progress via Enter/button
      if (isSavingEdit) return;

      const trimmedName = localEditName.trim();
      const isNewProjectBeingNamed =
        item.itemType === "project" && originalNameToCompare === "New Project";

      if (!trimmedName) {
        // If name is empty, revert to original and cancel (unless it was "New Project")
        if (originalNameToCompare !== "New Project") {
          toast.error("Name cannot be empty.");
          setLocalEditName(originalNameToCompare); // Revert local state
          // No explicit cancel here, let user correct or press Esc
          localEditInputRef.current?.focus();
        } else {
          // It's an empty "New Project", treat as cancel
          cancelLocalEditWrapper();
        }
        return;
      }

      if (trimmedName !== originalNameToCompare || isNewProjectBeingNamed) {
        saveLocalEditWrapper();
      } else {
        // Name unchanged, effectively a cancel
        cancelLocalEditWrapper();
      }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveLocalEditWrapper();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelLocalEditWrapper();
      }
    };

    const displayName = isProject
      ? (item as Project).name
      : (item as Conversation).title;
    const SaveIconComponent = isSavingEdit ? Loader2 : CheckIcon;
    const saveIconClassName = isSavingEdit ? "h-3 w-3 animate-spin" : "h-3 w-3";

    return (
      <li
        className={cn(
          "relative flex justify-between items-center group p-1.5 text-xs rounded",
          "border border-transparent",
          !isGloballyEditingThis && "hover:bg-muted/50 hover:text-primary/80",
          isSelected && !isGloballyEditingThis
            ? "bg-primary/10 text-primary font-medium border-primary dark:bg-primary/20 dark:border-primary/70"
            : "",
          isGloballyEditingThis && "bg-muted ring-1 ring-primary",
          !isGloballyEditingThis && "cursor-pointer"
        )}
        style={{ paddingLeft: `${0.375 + level * 0.75}rem` }}
        onClick={handleItemClick}
        title={!isGloballyEditingThis ? displayName : ""}
      >
        <div className="flex items-center min-w-0 gap-1 flex-grow mr-1">
          {canExpand && (
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
          {!canExpand && <span className="w-3 flex-shrink-0" />}
          {isProject ? (
            <FolderIcon className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
          ) : (
            <MessageSquareIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
          )}
          {isGloballyEditingThis ? (
            <Input
              ref={localEditInputRef}
              value={localEditName}
              onChange={(e) => setLocalEditName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
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
            isGloballyEditingThis
              ? "flex"
              : "hidden group-hover:flex transition-all duration-150"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isGloballyEditingThis ? (
            <>
              <ActionTooltipButton
                tooltipText="Save (Enter)"
                onClick={(e) => {
                  e.stopPropagation();
                  saveLocalEditWrapper();
                }}
                disabled={isSavingEdit || !localEditName.trim()}
                aria-label="Save changes"
                icon={<SaveIconComponent />}
                iconClassName={saveIconClassName}
                className="h-5 w-5 text-green-500 hover:text-green-600"
              />
              <ActionTooltipButton
                tooltipText="Cancel (Esc)"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelLocalEditWrapper();
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
                  onClick={(e) => {
                    e.stopPropagation();
                    openProjectSettingsModal(item.id);
                  }}
                  aria-label={`Settings for ${displayName}`}
                  icon={<CogIcon />}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                />
              )}
              <ActionTooltipButton
                tooltipText="Edit"
                onClick={startLocalEditingWrapper}
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
    );
  }
);
ConversationItemRenderer.displayName = "ConversationItemRenderer";
