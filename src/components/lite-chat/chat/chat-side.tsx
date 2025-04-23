// src/components/lite-chat/chat/chat-side.tsx
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
  // Fetch conversations directly for parentId logic
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

  // Determine parentId based on current selection
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
    // Only update if the determined parent ID actually changes
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
      setEditingItemId(newProjectId); // Start editing the new project name
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
      // Determine parent based on current selection for import
      importConversation(file, parentIdForNewItem);
    }
    // Reset file input to allow importing the same file again
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleOpenSettingsModal = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, [setIsSettingsModalOpen]);

  // Callback to initiate rename mode in ChatHistory
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
      {/* Top Action Buttons */}
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

      {/* Chat History Area */}
      <div className="flex-grow overflow-hidden flex flex-col">
        <ChatHistory
          className="flex-grow"
          // Pass state and actions needed by ChatHistory and HistoryItem
          editingItemId={editingItemId}
          selectedItemId={selectedItemId} // Pass selectedItemId for highlighting
          onEditComplete={onEditComplete}
          selectItem={selectItem} // Pass selectItem action
          deleteItem={deleteItem} // Pass deleteItem action
          renameItem={renameItem} // Pass renameItem action
          exportConversation={exportConversation} // Pass export action
          startRename={startRename} // Pass startRename callback
        />
      </div>

      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: "none" }}
      />

      {/* Bottom Action Buttons */}
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

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </aside>
  );
};

export const ChatSide = React.memo(ChatSideComponent);
