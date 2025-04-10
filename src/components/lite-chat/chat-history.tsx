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
  const { selectItem, deleteItem, renameItem, exportConversation } =
    useChatContext();

  const [isEditing, setIsEditing] = useState(startInEditMode);
  const currentItemName = item.type === "project" ? item.name : item.title;
  const [editedName, setEditedName] = useState(currentItemName);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameBeforeEdit = useRef(currentItemName);

  // Effects remain the same...
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

  // Callbacks remain the same...
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
        ? `Delete project "${name}"? This cannot be undone.`
        : `Delete chat "${name}" and all its messages? This cannot be undone.`;
    if (window.confirm(confirmationMessage)) {
      deleteItem(item.id, item.type);
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
      selectItem(item.id, item.type);
    }
  };

  const Icon = item.type === "project" ? FolderIcon : MessageSquareIcon;
  const displayName = item.type === "project" ? item.name : item.title;
  const indentLevel = item.parentId ? 1 : 0;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-x-2", // Grid definition, gap between columns
        "p-2 rounded-md cursor-pointer group text-sm w-full overflow-hidden", // Keep w-full and overflow-hidden
        "hover:bg-gray-700",
        isSelected && !isEditing && "bg-gray-600 text-white",
        isEditing && "bg-gray-700 ring-1 ring-blue-600",
      )}
      style={{ paddingLeft: `${0.5 + indentLevel * 1}rem` }} // Keep indent
      onClick={handleClick}
      title={displayName}
    >
      {/* Column 1: Icon */}
      <Icon className="h-4 w-4 flex-shrink-0 text-gray-400" />

      {/* Column 2: Text/Input */}
      {/* Add min-w-0 and overflow-hidden to this container div */}
      <div className="min-w-0 overflow-hidden">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="h-6 px-1 py-0 text-sm bg-gray-800 border-gray-600 focus:ring-1 focus:ring-blue-500 w-full"
            onClick={(e) => e.stopPropagation()}
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

      {/* Column 3: Actions */}
      {/* Actions Container - Now part of the grid flow */}
      <div
        className={cn(
          "flex items-center gap-0.5", // Simple flex container for buttons
          // Visibility logic remains the same
          isEditing
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          // isSelected && !isEditing && "opacity-100",
        )}
        // Prevent click propagation to the item itself
        onClick={(e) => e.stopPropagation()}
      >
        {/* Buttons remain the same */}
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
  const itemsToDisplay = sidebarItems;

  return (
    <ScrollArea className={cn("flex-grow h-0", className)}>
      {/* Keep 'block' here, it shouldn't interfere with grid children */}
      <div className="block p-2 space-y-1">
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
