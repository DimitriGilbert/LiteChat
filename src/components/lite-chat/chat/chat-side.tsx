// src/components/lite-chat/chat/chat-side.tsx
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { ChatHistory } from "./chat-history";
import { SettingsModal } from "@/components/lite-chat/settings/settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  DownloadIcon,
  ImportIcon, // Added ImportIcon
  FileTextIcon, // Added FileTextIcon
  FolderIcon, // Added FolderIcon
  Trash2Icon, // Added Trash2Icon
  Edit2Icon, // Added Edit2Icon
  CheckIcon, // Added CheckIcon
  XIcon, // Added XIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DbConversation,
  SidebarItem,
  DbProject,
  ProjectSidebarItem,
  ConversationSidebarItem,
  SidebarItemType, // Added SidebarItemType
} from "@/lib/types";
// Removed incorrect import: import type { ChatSideProps } from "../chat";
import type { SettingsModalTabProps } from "../chat"; // Keep this import
import { Input } from "@/components/ui/input"; // Added Input import
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Added Tooltip imports

// Define props locally for ChatSide component
export interface ChatSideProps {
  className?: string;
  dbProjects: DbProject[];
  dbConversations: DbConversation[];
  editingItemId: string | null;
  selectedItemId: string | null;
  selectedItemType: SidebarItemType | null;
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;
  settingsProps: SettingsModalTabProps;
  onEditComplete: (id: string) => void;
  setEditingItemId: (id: string | null) => void;
  selectItem: (
    id: string | null,
    type: SidebarItemType | null,
  ) => Promise<void>;
  deleteItem: (id: string, type: SidebarItemType) => Promise<void>;
  renameItem: (
    id: string,
    newName: string,
    type: SidebarItemType,
  ) => Promise<void>;
  exportConversation: (conversationId: string | null) => Promise<void>;
  createConversation: (
    parentId: string | null,
    title?: string,
  ) => Promise<string>;
  createProject: (
    parentId: string | null,
    name?: string,
  ) => Promise<{ id: string; name: string }>;
  importConversation: (file: File, parentId: string | null) => Promise<void>;
}

const ChatSideComponent: React.FC<ChatSideProps> = ({
  className,
  dbProjects,
  dbConversations,
  editingItemId,
  selectedItemId,
  selectedItemType,
  onEditComplete,
  setEditingItemId,
  selectItem,
  deleteItem,
  renameItem,
  exportConversation,
  createConversation,
  createProject,
  importConversation,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  settingsProps,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parentIdForNewItem, setParentIdForNewItem] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState(""); // Added state for rename input

  const sidebarItems = useMemo<SidebarItem[]>(() => {
    const allProjects: DbProject[] = dbProjects || [];
    const allConversations: DbConversation[] = dbConversations || [];
    const combinedItems: SidebarItem[] = [
      ...allProjects.map(
        (p): ProjectSidebarItem => ({ ...p, type: "project" }),
      ),
      ...allConversations.map(
        (c): ConversationSidebarItem => ({ ...c, type: "conversation" }),
      ),
    ];
    combinedItems.sort(
      (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
    );
    return combinedItems;
  }, [dbProjects, dbConversations]);

  useEffect(() => {
    let determinedParentId: string | null = null;
    if (selectedItemType === "project") {
      determinedParentId = selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = dbConversations.find((item) => item.id === selectedItemId);
      determinedParentId = convo?.parentId ?? null;
    } else {
      determinedParentId = null;
    }
    setParentIdForNewItem((prev) => {
      if (prev !== determinedParentId) {
        return determinedParentId;
      }
      return prev;
    });
  }, [selectedItemId, selectedItemType, dbConversations]);

  const handleCreateChat = useCallback(async () => {
    await createConversation(parentIdForNewItem);
  }, [createConversation, parentIdForNewItem]);

  const handleCreateProject = useCallback(async () => {
    try {
      const { id: newProjectId } = await createProject(parentIdForNewItem);
      setEditingItemId(newProjectId);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project.");
    }
  }, [createProject, parentIdForNewItem, setEditingItemId]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importConversation(file, null);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleOpenSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, [setIsSettingsModalOpen]);

  // Rename handlers
  const handleRename = (id: string, type: SidebarItemType) => {
    if (renameValue.trim()) {
      renameItem(id, renameValue.trim(), type);
      onEditComplete(id);
      setRenameValue("");
    } else {
      // If rename value is empty, cancel edit
      handleCancelRename(id);
    }
  };

  const handleCancelRename = (id: string) => {
    onEditComplete(id);
    setRenameValue("");
  };

  const startRename = (id: string, currentName: string) => {
    setEditingItemId(id);
    setRenameValue(currentName);
  };

  // Render function with explicit type for item
  const renderItem = (item: SidebarItem) => {
    const isSelected =
      item.id === selectedItemId && item.type === selectedItemType;
    const isEditing = item.id === editingItemId;
    const Icon = item.type === "project" ? FolderIcon : FileTextIcon;

    return (
      <div
        key={item.id}
        className={cn(
          "group flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-colors text-sm",
          isSelected
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
        onClick={() => !isEditing && selectItem(item.id, item.type)}
      >
        {isEditing ? (
          <div className="flex items-center gap-1 flex-grow mr-1">
            <Input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename(item.id, item.type);
                if (e.key === "Escape") handleCancelRename(item.id);
              }}
              onBlur={() => handleRename(item.id, item.type)} // Save on blur
              autoFocus
              className="h-6 px-1 text-xs flex-grow"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-green-500 hover:text-green-400"
              onClick={(e) => {
                e.stopPropagation();
                handleRename(item.id, item.type);
              }}
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-red-500 hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelRename(item.id);
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 overflow-hidden">
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate flex-grow">
                {item.type === "project" ? item.name : item.title}
              </span>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.type === "conversation" && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportConversation(item.id);
                        }}
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Export Chat</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(
                          item.id,
                          item.type === "project" ? item.name : item.title,
                        );
                      }}
                    >
                      <Edit2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Rename</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-red-500/80 hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `Are you sure you want to delete this ${item.type}?`,
                          )
                        ) {
                          deleteItem(item.id, item.type);
                        }
                      }}
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-card border-r border-border",
        className,
      )}
    >
      <div className="p-3 border-b border-border flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-border text-card-foreground hover:bg-muted hover:text-foreground h-9 transition-colors"
          onClick={handleCreateChat}
          title="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Chat</span>
        </Button>
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-border text-card-foreground hover:bg-muted hover:text-foreground h-9 transition-colors"
          onClick={handleCreateProject}
          title="New Project"
        >
          <FolderPlusIcon className="h-4 w-4" />
          <span>Project</span>
        </Button>
      </div>

      <div className="flex-grow overflow-hidden flex flex-col">
        <ChatHistory
          className="flex-grow"
          sidebarItems={sidebarItems}
          editingItemId={editingItemId}
          selectedItemId={selectedItemId}
          onEditComplete={onEditComplete}
          selectItem={selectItem}
          deleteItem={deleteItem}
          renameItem={renameItem}
          exportConversation={exportConversation}
          // Pass startRename instead of setEditingItemId directly
          startRename={startRename}
        />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: "none" }}
      />

      <div className="border-t border-border p-3 space-y-2 bg-card">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-border text-card-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={handleImportClick}
        >
          <ImportIcon className="h-4 w-4" /> {/* Use ImportIcon */}
          Import Chat (.json)
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-border text-card-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={handleOpenSettingsModal}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        // Pass onClose directly if SettingsModal expects it
        onClose={() => setIsSettingsModalOpen(false)}
        // Or pass onOpenChange if it expects that pattern
        // onOpenChange={setIsSettingsModalOpen}
        settingsProps={settingsProps}
      />
    </aside>
  );
};

export const ChatSide = React.memo(ChatSideComponent);
