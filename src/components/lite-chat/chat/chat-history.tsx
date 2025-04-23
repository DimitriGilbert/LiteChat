
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
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



import { useChatStorage } from "@/hooks/use-chat-storage"; // To get items

interface HistoryItemProps {
  item: SidebarItem;
  isSelected: boolean;
  startInEditMode: boolean;
  onEditComplete: (id: string) => void;
  selectItem: (id: string, type: SidebarItemType) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  exportConversation: (conversationId: string) => Promise<void>;
  startRename: (id: string, currentName: string) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = React.memo(
  ({
    item,
    isSelected,
    startInEditMode,
    onEditComplete,
    selectItem,
    deleteItem,
    renameItem,
    exportConversation,
    startRename,
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

    const handleSave = useCallback(async () => {
      const trimmedName = editedName.trim();
      if (trimmedName && trimmedName !== nameBeforeEdit.current) {
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
      startRename(item.id, currentName);
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
          "grid grid-cols-[auto_1fr_auto] items-center gap-x-2",
          "p-2 rounded-md cursor-pointer group text-sm w-full overflow-hidden",
          "hover:bg-muted/70 transition-colors duration-200",
          isSelected && !isEditing && "bg-muted text-foreground",
          isEditing && "bg-muted ring-1 ring-primary",
        )}
        style={{ paddingLeft: `${0.5 + indentLevel * 1}rem` }}
        onClick={handleClick}
        title={displayName}
      >
        <Icon
          className={cn(
            "h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors",
            isSelected && "text-primary",
          )}
        />
        <div className="min-w-0 overflow-hidden">
          {isEditing ? (
            <Input
              ref={inputRef}
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="h-6 px-1 py-0 text-sm bg-background border-border focus:ring-1 focus:ring-primary w-full"
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
                  className="max-w-[300px] break-words bg-popover text-popover-foreground border border-border shadow-lg"
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
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {isEditing ? (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-green-500 hover:text-green-400 transition-colors"
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
                      className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors"
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
                      className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors"
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
                        className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors"
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
                        className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors"
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
                      className="h-6 w-6 text-destructive hover:text-destructive/80 transition-colors"
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

export interface ChatHistoryProps {
  className?: string;
  // Remove sidebarItems prop
  editingItemId: string | null;
  selectedItemId: string | null;
  onEditComplete: (id: string) => void;
  selectItem: (id: string, type: SidebarItemType) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  exportConversation: (conversationId: string) => Promise<void>;
  startRename: (id: string, currentName: string) => void;
}

const ChatHistoryComponent: React.FC<ChatHistoryProps> = ({
  className,
  // Remove sidebarItems prop
  editingItemId,
  selectedItemId,
  onEditComplete,
  selectItem,
  deleteItem,
  renameItem,
  exportConversation,
  startRename,
}) => {
  // --- Fetch items from storage ---
  const { projects, conversations } = useChatStorage();
  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allProjects = projects || [];
    const allConversations = conversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map((p) => ({ ...p, type: "project" as const })),
      ...allConversations.map((c) => ({
        ...c,
        type: "conversation" as const,
      })),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [projects, conversations]);
  // --- End fetch items ---

  const itemsToDisplay = sidebarItems;

  return (
    <ScrollArea className={cn("flex-grow h-0", className)}>
      <div className="block p-2 space-y-1">
        {itemsToDisplay.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 px-2">
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
            selectItem={selectItem}
            deleteItem={deleteItem}
            renameItem={renameItem}
            exportConversation={exportConversation}
            startRename={startRename}
          />
        ))}
      </div>
    </ScrollArea>
  );
};

export const ChatHistory = React.memo(ChatHistoryComponent);
