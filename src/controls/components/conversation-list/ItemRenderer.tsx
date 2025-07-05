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
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { uiEvent } from "@/types/litechat/events/ui.events";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ConversationItemProps {
  item: SidebarItem;
  level: number;
  selectedItemId: string | null;
  conversationSyncStatus: Record<string, SyncStatus>;
  repoNameMap: Map<string, string>;
  onSelectItem: (id: string, type: SidebarItemType) => void;
  onDeleteItem: (item: SidebarItem, e: React.MouseEvent) => void;
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
    onDeleteItem,
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
    const { t } = useTranslation('controls');
    const isSelected = item.id === selectedItemId;
    const isProject = item.itemType === "project";
    // console.log("ConversationItemRenderer", item.itemType);

    const isGloballyEditingThis =
      item.id === editingItemId && item.itemType === editingItemType;

    const [localEditName, setLocalEditName] = useState(
      isProject ? (item as Project).name : (item as Conversation).title
    );
    const localEditInputRef = useRef<HTMLInputElement | null>(null);
    const [popoverOpen, setPopoverOpen] = useState(false);

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

    const handleSettingsClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      emitter.emit(uiEvent.openModalRequest, {
        modalId: "projectSettingsModal",
        targetId: item.id,
      });
    };

    const handleItemClick = () => {
      if (isGloballyEditingThis) return;
      if (isProject) {
        toggleProjectExpansion(item.id);
      }
      onSelectItem(item.id, item.itemType);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDeleteItem(item, e);
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
          toast.error(t('itemRenderer.nameCannotBeEmpty'));
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
            isGloballyEditingThis || popoverOpen
              ? "flex"
              : "hidden group-hover:flex transition-all duration-150"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isGloballyEditingThis ? (
            <>
              <ActionTooltipButton
                tooltipText={t('itemRenderer.saveEnter')}
                onClick={(e) => {
                  e.stopPropagation();
                  saveLocalEditWrapper();
                }}
                disabled={isSavingEdit || !localEditName.trim()}
                aria-label={t('itemRenderer.saveChanges')}
                icon={<SaveIconComponent />}
                iconClassName={saveIconClassName}
                className="h-5 w-5 text-green-500 hover:text-green-600"
              />
              <ActionTooltipButton
                tooltipText={t('itemRenderer.cancelEsc')}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelLocalEditWrapper();
                }}
                disabled={isSavingEdit}
                aria-label={t('itemRenderer.cancelEdit')}
                icon={<XIcon />}
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
              />
            </>
          ) : (
            <>
              {isProject && (
                <ActionTooltipButton
                  tooltipText={t('itemRenderer.projectSettings')}
                  onClick={handleSettingsClick}
                  aria-label={t('itemRenderer.settingsFor', { name: displayName })}
                  icon={<CogIcon />}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                />
              )}
              <ActionTooltipButton
                tooltipText={t('itemRenderer.edit')}
                onClick={startLocalEditingWrapper}
                aria-label={t('itemRenderer.editItem', { name: displayName })}
                icon={<Edit2Icon />}
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
              />
              {isProject ? (
                <ActionTooltipButton
                  tooltipText={t('itemRenderer.exportProjectJson')}
                  onClick={(e) => onExportProject(item.id, e)}
                  aria-label={t('itemRenderer.exportProject', { name: displayName })}
                  icon={<FileJsonIcon />}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                />
              ) : (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <ActionTooltipButton
                      tooltipText={t('itemRenderer.exportConversation')}
                      aria-label={t('itemRenderer.exportItem', { name: displayName })}
                      icon={<DownloadIcon />}
                      className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs"
                        onClick={(e) => {
                          onExportConversation(item.id, "json", e);
                          setPopoverOpen(false);
                        }}
                      >
                        JSON
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-xs"
                        onClick={(e) => {
                          onExportConversation(item.id, "md", e);
                          setPopoverOpen(false);
                        }}
                      >
                        MD
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <ActionTooltipButton
                tooltipText={t('itemRenderer.delete', 'Delete')}
                onClick={handleDeleteClick}
                aria-label={t('itemRenderer.delete', 'Delete')}
                icon={<Trash2Icon />}
                className="hover:bg-destructive/20 hover:text-destructive"
              />
            </>
          )}
        </div>
      </li>
    );
  }
);
ConversationItemRenderer.displayName = "ConversationItemRenderer";
