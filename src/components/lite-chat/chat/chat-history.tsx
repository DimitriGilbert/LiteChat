// src/components/lite-chat/chat/chat-history.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
// REMOVED store imports
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DownloadIcon,
  Trash2Icon,
  EditIcon,
  FolderIcon,
  MessageSquareIcon,
  CheckIcon,
  XIcon,
  CogIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SidebarItem, SidebarItemType } from "@/lib/types";
import { toast } from "sonner";
import { ProjectSettingsModal } from "@/components/lite-chat/project/project-settings-modal";

// --- History Item Component ---
// Define props based on what ChatHistory passes down
interface HistoryItemProps {
  item: SidebarItem;
  isSelected: boolean;
  startInEditMode: boolean;
  onEditComplete: (id: string) => void;
  // Receive actions as props
  selectItem: (id: string, type: SidebarItemType) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  exportConversation: (conversationId: string) => Promise<void>;
}

// HistoryItem remains largely the same internally, just uses props
// Keep React.memo for individual items as they are numerous
const HistoryItem: React.FC<HistoryItemProps> = React.memo(
  ({
    item,
    isSelected,
    startInEditMode,
    onEditComplete,
    // Destructure action props
    selectItem,
    deleteItem,
    renameItem,
    exportConversation,
  }) => {
    const [isEditing, setIsEditing] = useState(startInEditMode);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const currentItemName = item.type === "project" ? item.name : item.title;
    const [editedName, setEditedName] = useState(currentItemName);
    const inputRef = useRef<HTMLInputElement>(null);
    const nameBeforeEdit = useRef(currentItemName);

    useEffect(() => {
      setIsEditing(startInEditMode);
      if (startInEditMode) {
        const currentName = item.type === "project" ? item.name : item.title;
        setEditedName(currentName);
        nameBeforeEdit.current = currentName;
      }
    }, [startInEditMode, item]);

    useEffect(() => {
      if (!isEditing) {
        const newName = item.type === "project" ? item.name : item.title;
        setEditedName(newName);
        nameBeforeEdit.current = newName;
      }
    }, [item, isEditing]);

    useEffect(() => {
      if (isEditing) {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }, [isEditing]);

    // Use action props in callbacks
    const handleSave = useCallback(async () => {
      const trimmedName = editedName.trim();
      if (trimmedName && trimmedName !== nameBeforeEdit.current) {
        // console.log(`HistoryItem: Attempting rename for ${item.type} ${item.id} from "${nameBeforeEdit.current}" to "${trimmedName}"`);
        try {
          await renameItem(item.id, trimmedName, item.type); // Use prop
          toast.success(
            `${item.type === "project" ? "Project" : "Chat"} renamed.`,
          );
          setIsEditing(false);
          onEditComplete(item.id); // Pass ID
        } catch (error) {
          console.error("HistoryItem: Rename failed", error);
          setEditedName(nameBeforeEdit.current); // Revert on error
          setIsEditing(false);
          onEditComplete(item.id); // Pass ID
        }
      } else if (!trimmedName) {
        toast.error("Name cannot be empty.");
        // Keep editing state active
      } else {
        // console.log(`HistoryItem: Rename skipped for ${item.id} (no change or only whitespace)`);
        setIsEditing(false);
        onEditComplete(item.id); // Pass ID
      }
    }, [editedName, item.id, item.type, renameItem, onEditComplete]); // Add renameItem to deps

    const handleCancel = useCallback(() => {
      setEditedName(nameBeforeEdit.current);
      setIsEditing(false);
      onEditComplete(item.id); // Pass ID
    }, [onEditComplete, item.id]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    };

    const handleExportClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (item.type === "conversation") {
        exportConversation(item.id); // Use prop
      }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const name = item.type === "project" ? item.name : item.title;
      const confirmationMessage =
        item.type === "project"
          ? `Delete project "${name}"? This cannot be undone.`
          : `Delete chat "${name}" and all its messages? This cannot be undone.`;
      if (window.confirm(confirmationMessage)) {
        deleteItem(item.id, item.type); // Use prop
      }
    };

    const handleEditClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const currentName = item.type === "project" ? item.name : item.title;
      nameBeforeEdit.current = currentName;
      setEditedName(currentName);
      setIsEditing(true);
    };

    const handleClick = () => {
      if (!isEditing) {
        selectItem(item.id, item.type); // Use prop
      }
    };

    const Icon = item.type === "project" ? FolderIcon : MessageSquareIcon;
    const displayName = item.type === "project" ? item.name : item.title;
    const indentLevel = item.parentId ? 1 : 0; // Assuming parentId indicates nesting

    return (
      <div
        className={cn(
          "grid grid-cols-[auto_1fr_auto] items-center gap-x-2",
          "p-2 rounded-md cursor-pointer group text-sm w-full overflow-hidden",
          "hover:bg-gray-700",
          isSelected && !isEditing && "bg-gray-600 text-white",
          isEditing && "bg-gray-700 ring-1 ring-blue-600",
        )}
        style={{ paddingLeft: `${0.5 + indentLevel * 1}rem` }}
        onClick={handleClick}
        title={displayName}
      >
        <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />
        <div className="min-w-0 overflow-hidden">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSave} // Save on blur
              onKeyDown={handleKeyDown}
              className="h-6 px-1 py-0 text-sm bg-gray-800 border-gray-600 focus:ring-1 focus:ring-blue-500 w-full"
              onClick={(e) => e.stopPropagation()} // Prevent item selection when clicking input
            />
          ) : (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate block">{displayName}</span>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-[300px] break-words bg-gray-900 text-gray-100 border border-gray-700 shadow-lg"
                >
                  {displayName}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-0.5",
            isEditing
              ? "opacity-100" // Always show controls when editing
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100", // Show on hover/focus when not editing
          )}
          onClick={(e) => e.stopPropagation()} // Prevent item selection when clicking buttons
        >
          {isEditing ? (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-green-500 hover:text-green-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave();
                      }}
                      aria-label="Save name"
                    >
                      <CheckIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Save (Enter)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-gray-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel();
                      }}
                      aria-label="Cancel edit"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Cancel (Esc)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-gray-400 hover:text-white"
                      onClick={handleEditClick}
                      aria-label="Rename"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Rename</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {item.type === "conversation" && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-white"
                        onClick={handleExportClick}
                        aria-label="Export this chat"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Export chat</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {item.type === "project" && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSettingsOpen(true);
                        }}
                        aria-label="Project settings"
                      >
                        <CogIcon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Project settings</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-400"
                      onClick={handleDeleteClick}
                      aria-label={`Delete ${item.type}`}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Delete {item.type}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
        {/* ProjectSettingsModal likely needs refactoring too if it uses stores */}
        {item.type === "project" && isSettingsOpen && (
          <ProjectSettingsModal
            projectId={item.id}
            open={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
          />
        )}
      </div>
    );
  },
);
HistoryItem.displayName = "HistoryItem";

// --- Main Chat History Component ---
// Define props based on what ChatSide passes down
interface ChatHistoryProps {
  className?: string;
  sidebarItems: SidebarItem[]; // Receive derived items
  editingItemId: string | null;
  selectedItemId: string | null; // Receive selectedItemId for isSelected prop
  onEditComplete: (id: string) => void;
  // Receive actions to pass down
  selectItem: (id: string, type: SidebarItemType) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  exportConversation: (conversationId: string) => Promise<void>;
}

// Re-introduce React.memo as props should be stable now
const ChatHistoryComponent: React.FC<ChatHistoryProps> = ({
  className,
  sidebarItems, // Use the derived prop directly
  editingItemId,
  selectedItemId,
  onEditComplete,
  // Destructure action props
  selectItem,
  deleteItem,
  renameItem,
  exportConversation,
}) => {
  const itemsToDisplay = sidebarItems;
  // console.log(
  //   `[ChatHistory] Rendering. Items count from prop: ${itemsToDisplay.length}`,
  // ); // Add log

  return (
    <ScrollArea className={cn("flex-grow h-0", className)}>
      <div className="block p-2 space-y-1">
        {itemsToDisplay.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4 px-2">
            No projects or chats yet. Use the buttons above to create one.
          </p>
        )}
        {itemsToDisplay.map((item) => (
          <HistoryItem
            key={item.id} // Key ensures React knows which item is which
            item={item}
            isSelected={item.id === selectedItemId} // Use prop
            startInEditMode={item.id === editingItemId} // Use prop
            onEditComplete={onEditComplete} // Pass prop
            // Pass actions down
            selectItem={selectItem}
            deleteItem={deleteItem}
            renameItem={renameItem}
            exportConversation={exportConversation}
          />
        ))}
      </div>
    </ScrollArea>
  );
};

// Export the memoized component
export const ChatHistory = React.memo(ChatHistoryComponent);
