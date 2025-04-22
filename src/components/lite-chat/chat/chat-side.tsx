// src/components/lite-chat/chat/chat-side.tsx
import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  ChatHistory,
  //ChatHistoryProps
} from "./chat-history"; // Import ChatHistoryProps
import { SettingsModal } from "@/components/lite-chat/settings/settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  // DownloadIcon,
  ImportIcon,
  // FileTextIcon,
  // FolderIcon,
  // Trash2Icon,
  // Edit2Icon,
  // CheckIcon,
  // XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DbConversation,
  SidebarItem,
  DbProject,
  ProjectSidebarItem,
  ConversationSidebarItem,
  SidebarItemType,
} from "@/lib/types";
// Import the bundled props type from chat.tsx
import type { SettingsModalTabProps } from "../chat";
// import { Input } from "@/components/ui/input";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";

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
  settingsProps: SettingsModalTabProps; // Use the imported type
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
  const [renameValue, setRenameValue] = useState("");

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

  // Removed unused renderItem function

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
        {/* Pass startRename prop to ChatHistory */}
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
