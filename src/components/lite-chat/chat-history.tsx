// src/components/lite-chat/chat-history.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChatContext } from "@/hooks/use-chat-context";
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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SidebarItem } from "@/lib/types";
import { toast } from "sonner";

// --- History Item Component ---
interface HistoryItemProps {
  item: SidebarItem;
  isSelected: boolean;
  startInEditMode: boolean;
  onEditComplete: (id: string) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({
  item,
  isSelected,
  startInEditMode,
  onEditComplete,
}) => {
  const {
    selectItem,
    deleteItem,
    renameItem,
    exportConversation, // Keep for conversations
  } = useChatContext();

  const [isEditing, setIsEditing] = useState(startInEditMode); // Initialize directly
  const currentItemName = item.type === "project" ? item.name : item.title;
  const [editedName, setEditedName] = useState(currentItemName);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameBeforeEdit = useRef(currentItemName);

  useEffect(() => {
    if (!isEditing) {
      const newName = item.type === "project" ? item.name : item.title;
      setEditedName(newName);
      nameBeforeEdit.current = newName;
    }
  }, [item, isEditing]);

  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
      nameBeforeEdit.current = item.type === "project" ? item.name : item.title;
      setEditedName(nameBeforeEdit.current);
    }
  }, [startInEditMode, item]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== nameBeforeEdit.current) {
      console.log(
        `HistoryItem: Attempting rename for ${item.type} ${item.id} from "${nameBeforeEdit.current}" to "${trimmedName}"`,
      );
      try {
        await renameItem(item.id, trimmedName, item.type);
        toast.success(
          `${item.type === "project" ? "Project" : "Chat"} renamed.`,
        );
        setIsEditing(false);
        onEditComplete(item.id);
      } catch (error) {
        console.error("HistoryItem: Rename failed", error);
        setEditedName(nameBeforeEdit.current);
        toast.error(`Failed to rename ${item.type}.`);
        setIsEditing(false);
        onEditComplete(item.id);
      }
    } else if (!trimmedName) {
      toast.error("Name cannot be empty.");
    } else {
      console.log(
        `HistoryItem: Rename skipped for ${item.id} (no change or only whitespace)`,
      );
      setIsEditing(false);
      onEditComplete(item.id);
    }
  }, [editedName, item.id, item.type, renameItem, onEditComplete]);

  const handleCancel = useCallback(() => {
    setEditedName(nameBeforeEdit.current);
    setIsEditing(false);
    onEditComplete(item.id);
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
      exportConversation(item.id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = item.type === "project" ? item.name : item.title;
    const confirmationMessage =
      item.type === "project"
        ? `Delete project "${name}"? This cannot be undone.` // Simplified message for now
        : `Delete chat "${name}" and all its messages? This cannot be undone.`;
    if (window.confirm(confirmationMessage)) {
      deleteItem(item.id, item.type);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    nameBeforeEdit.current = item.type === "project" ? item.name : item.title;
    setEditedName(nameBeforeEdit.current);
    setIsEditing(true);
  };

  const handleClick = () => {
    if (!isEditing) {
      selectItem(item.id, item.type);
    }
  };

  const Icon = item.type === "project" ? FolderIcon : MessageSquareIcon;
  const displayName = item.type === "project" ? item.name : item.title;
  const indentLevel = item.parentId ? 1 : 0; // Basic indent for now

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded-md cursor-pointer group text-sm",
        "hover:bg-gray-700",
        isSelected && !isEditing && "bg-gray-600 text-white",
        isEditing && "bg-gray-700 ring-1 ring-blue-600",
      )}
      style={{ paddingLeft: `${0.5 + indentLevel * 1}rem` }}
      onClick={handleClick}
      title={displayName}
    >
      <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />

      {isEditing ? (
        <Input
          ref={inputRef}
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-grow h-6 px-1 py-0 text-sm bg-gray-800 border-gray-600 focus:ring-1 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="truncate flex-grow pr-2">{displayName}</span>
      )}

      <div
        className={cn(
          "flex items-center gap-0.5 flex-shrink-0",
          isEditing
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 transition-opacity",
        )}
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
    </div>
  );
};

// --- Main Chat History Component ---
interface ChatHistoryProps {
  className?: string;
  editingItemId: string | null;
  onEditComplete: (id: string) => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  className,
  editingItemId,
  onEditComplete,
}) => {
  const { sidebarItems, selectedItemId } = useChatContext();

  // Display all items flat for now, sorted by the query (updatedAt desc)
  const itemsToDisplay = sidebarItems;

  return (
    <ScrollArea className={cn("flex-grow h-0", className)}>
      <div className="p-2 space-y-1">
        {itemsToDisplay.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4 px-2">
            No projects or chats yet. Use the buttons above to create one.
          </p>
        )}
        {itemsToDisplay.map((item) => (
          <HistoryItem
            key={item.id}
            item={item}
            isSelected={item.id === selectedItemId}
            startInEditMode={item.id === editingItemId}
            onEditComplete={onEditComplete}
          />
        ))}
      </div>
    </ScrollArea>
  );
};
