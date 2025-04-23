
import React, { useRef, useEffect, useState, useCallback } from "react";
import { ChatHistory } from "./chat-history";
import { SettingsModal } from "@/components/lite-chat/settings/settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  ImportIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DbConversation } from "@/lib/types";
import { useShallow } from "zustand/react/shallow";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useSidebarStore } from "@/store/sidebar.store";
import { useSettingsStore } from "@/store/settings.store";

export interface ChatSideProps {
  className?: string;
  editingItemId: string | null;
  onEditComplete: (id: string) => void;
  setEditingItemId: (id: string | null) => void;
}

const ChatSideComponent: React.FC<ChatSideProps> = ({
  className,
  editingItemId,
  onEditComplete,
  setEditingItemId,
}) => {
  const { conversations } = useChatStorage();

  const {
    selectedItemId,
    selectedItemType,
    selectItem,
    deleteItem,
    renameItem,
    exportConversation,
    createConversation,
    createProject,
    importConversation,
  } = useSidebarStore(
    useShallow((state) => ({
      selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
      selectItem: state.selectItem,
      deleteItem: state.deleteItem,
      renameItem: state.renameItem,
      exportConversation: state.exportConversation,
      createConversation: state.createConversation,
      createProject: state.createProject,
      importConversation: state.importConversation,
    })),
  );

  const { isSettingsModalOpen, setIsSettingsModalOpen } = useSettingsStore(
    useShallow((state) => ({
      isSettingsModalOpen: state.isSettingsModalOpen,
      setIsSettingsModalOpen: state.setIsSettingsModalOpen,
    })),
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parentIdForNewItem, setParentIdForNewItem] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let determinedParentId: string | null = null;
    if (selectedItemType === "project") {
      determinedParentId = selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = (conversations || []).find(
        (item: DbConversation) => item.id === selectedItemId,
      );
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
  }, [selectedItemId, selectedItemType, conversations]);

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

  const startRename = (id: string) => {
    setEditingItemId(id);
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
          <ImportIcon className="h-4 w-4" />
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
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </aside>
  );
};

export const ChatSide = React.memo(ChatSideComponent);
