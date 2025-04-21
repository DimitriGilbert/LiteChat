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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  DbConversation,
  SidebarItem,
  DbProject,
  ProjectSidebarItem,
  ConversationSidebarItem,
} from "@/lib/types";
import type { ChatSideProps } from "../chat"; // Use the updated type from chat.tsx

// Wrap component logic in a named function for React.memo
const ChatSideComponent: React.FC<ChatSideProps> = ({
  className,
  // Receive live data directly
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
  settingsProps, // Receive bundled settings props
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parentIdForNewItem, setParentIdForNewItem] = useState<string | null>(
    null,
  );

  // --- Derive Sidebar Items HERE ---
  // This useMemo now depends on the direct dbProjects/dbConversations props,
  // which should have more stable references from LiteChatInner.
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
    // console.log(
    //   `[ChatSide] Derived sidebarItems. Count: ${combinedItems.length}`,
    // );
    return combinedItems;
  }, [dbProjects, dbConversations]); // Depend on direct live data props

  // console.log(
  //   `[ChatSide] Rendering. Items count from props: Proj=${dbProjects?.length}, Conv=${dbConversations?.length}. Derived count: ${sidebarItems.length}, Editing: ${editingItemId}, Modal Open: ${isSettingsModalOpen}`,
  // );

  // Effect to determine parent ID for new items based on selection props
  // This effect still depends on dbConversations. If its reference changes too often,
  // this could still cause state updates.
  useEffect(() => {
    // console.log(`[ChatSide useEffect] Running. Selected: ${selectedItemType} - ${selectedItemId}`);
    let determinedParentId: string | null = null;
    if (selectedItemType === "project") {
      determinedParentId = selectedItemId;
    } else if (selectedItemType === "conversation" && selectedItemId) {
      // Find conversation in the raw data prop
      const convo = dbConversations.find((item) => item.id === selectedItemId);
      determinedParentId = convo?.parentId ?? null;
    } else {
      determinedParentId = null;
    }
    // Only update state if the value actually changes
    setParentIdForNewItem((prev) => {
      if (prev !== determinedParentId) {
        // console.log(`[ChatSide useEffect] Updating parentIdForNewItem from ${prev} to ${determinedParentId}`);
        return determinedParentId;
      }
      return prev;
    });
  }, [selectedItemId, selectedItemType, dbConversations]); // Depend on direct live data prop

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

  const handleOpenSettingsModal = useCallback(() => {
    // console.log("[ChatSide] Settings button clicked. Calling setIsSettingsModalOpen(true).");
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
        {/* Pass the memoized sidebarItems down */}
        <ChatHistory
          className="flex-grow"
          sidebarItems={sidebarItems} // Pass derived items (stable ref from useMemo)
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
          // console.log("[ChatSide] SettingsModal onClose triggered. Calling setIsSettingsModalOpen(false).");
          setIsSettingsModalOpen(false);
        }}
        settingsProps={settingsProps} // Pass the bundled props object (stable)
      />
    </aside>
  );
};

// Export the component WITH memoization, as its direct props should now be stable
export const ChatSide = React.memo(ChatSideComponent);
