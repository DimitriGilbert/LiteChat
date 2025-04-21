// src/components/lite-chat/chat/chat-side.tsx
import React, { useRef, useEffect, useState, useCallback } from "react";
import { ChatHistory } from "./chat-history";
import { SettingsModal } from "@/components/lite-chat/settings/settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  DownloadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
// REMOVED: import type { SidebarItem, DbConversation, SidebarItemType } from "@/lib/types";
import type { DbConversation, SidebarItem, SidebarItemType } from "@/lib/types"; // Keep DbConversation if needed
import type { ChatSideProps } from "../chat"; // Import props from parent

// Wrap component logic in a named function for React.memo
const ChatSideComponent: React.FC<ChatSideProps> = ({
  className,
  sidebarItems,
  editingItemId,
  selectedItemId,
  selectedItemType,
  onEditComplete,
  setEditingItemId,
  // Destructure actions from props
  selectItem,
  deleteItem,
  renameItem,
  exportConversation,
  createConversation,
  createProject,
  importConversation,
  isSettingsModalOpen,
  setIsSettingsModalOpen,
  settingsProps, // Receive bundled settings props
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parentIdForNewItem, setParentIdForNewItem] = useState<string | null>(
    null,
  );

  console.log(
    `[ChatSide] Rendering. Items count: ${sidebarItems.length}, Editing: ${editingItemId}, Modal Open: ${isSettingsModalOpen}`,
  );

  // Effect to determine parent ID for new items based on selection props
  useEffect(() => {
    console.log(
      `[ChatSide useEffect] Running. Selected: ${selectedItemType} - ${selectedItemId}`,
    );
    let determinedParentId: string | null = null;
    if (selectedItemType === "project") {
      determinedParentId = selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      const convo = sidebarItems.find(
        (item): item is DbConversation & { type: "conversation" } =>
          item.type === "conversation" && item.id === selectedItemId,
      );
      determinedParentId = convo?.parentId ?? null;
    } else {
      determinedParentId = null;
    }
    setParentIdForNewItem((prev) => {
      if (prev !== determinedParentId) {
        console.log(
          `[ChatSide useEffect] Updating parentIdForNewItem from ${prev} to ${determinedParentId}`,
        );
        return determinedParentId;
      }
      return prev;
    });
  }, [selectedItemId, selectedItemType, sidebarItems]);

  // Use actions passed via props
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

  // Add logging to the settings modal trigger
  const handleOpenSettingsModal = useCallback(() => {
    console.log(
      "[ChatSide] Settings button clicked. Calling setIsSettingsModalOpen(true).",
    );
    setIsSettingsModalOpen(true);
  }, [setIsSettingsModalOpen]);

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-gray-800 border-r border-gray-700",
        className,
      )}
    >
      {/* Action Buttons */}
      <div className="p-3 border-b border-gray-700 flex gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-9"
          onClick={handleCreateChat}
          title="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
          <span>Chat</span>
        </Button>
        <Button
          variant="outline"
          className="flex-1 justify-center gap-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white h-9"
          onClick={handleCreateProject}
          title="New Project"
        >
          <FolderPlusIcon className="h-4 w-4" />
          <span>Project</span>
        </Button>
      </div>

      {/* History Area */}
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
        />
      </div>

      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: "none" }}
      />

      {/* Settings & Import Buttons */}
      <div className="border-t border-gray-700 p-3 space-y-2 bg-gray-800">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={handleImportClick}
        >
          <DownloadIcon className="h-4 w-4 transform rotate-180" />
          Import Chat (.json)
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={handleOpenSettingsModal} // Use the new handler
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Settings Modal - Pass down bundled props */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => {
          console.log(
            "[ChatSide] SettingsModal onClose triggered. Calling setIsSettingsModalOpen(false).",
          );
          setIsSettingsModalOpen(false);
        }}
        settingsProps={settingsProps} // Pass the bundled props object
      />
    </aside>
  );
};

// Export the memoized component
export const ChatSide = React.memo(ChatSideComponent);
