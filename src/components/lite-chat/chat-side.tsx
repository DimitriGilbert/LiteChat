// src/components/lite-chat/chat-side.tsx
import React, { useState, useRef } from "react";
import { ChatHistory } from "./chat-history"; // Will be updated next
import { SettingsModal } from "./settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  DownloadIcon,
} from "lucide-react"; // Add FolderPlusIcon
import { cn } from "@/lib/utils";
// Removed Upload/Download icons if handled elsewhere (like history items)
import { useChatContext } from "@/hooks/use-chat-context";
import { toast } from "sonner"; // Import toast

interface ChatSideProps {
  className?: string;
}

export const ChatSide: React.FC<ChatSideProps> = ({ className }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    // selectItem, // No longer needed directly here
    createConversation,
    createProject, // Use createProject
    selectedItemId,
    selectedItemType,
    importConversation, // Get import function from context
  } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State to track which new project should start in edit mode
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const handleCreateChat = async () => {
    // Determine parentId based on current selection
    let parentId: string | null = null;
    if (selectedItemType === "project") {
      parentId = selectedItemId;
    } else if (selectedItemType === "conversation") {
      // If a chat is selected, find its parent project ID
      // This requires access to the full item data, maybe context needs to provide it?
      // Or, simpler: just create at root if a chat is selected.
      // Let's go with the simpler approach for now.
      parentId = null; // Create at root if a chat is selected
      console.log("Creating chat at root because a conversation was selected.");
    }
    // createConversation now selects the new chat automatically
    await createConversation(parentId);
  };

  const handleCreateProject = async () => {
    // Determine parentId based on current selection
    let parentId: string | null = null;
    if (selectedItemType === "project") {
      parentId = selectedItemId;
    } else if (selectedItemType === "conversation") {
      // Create at root if a chat is selected (consistent with handleCreateChat)
      parentId = null;
      console.log(
        "Creating project at root because a conversation was selected.",
      );
    }
    try {
      const { id: newProjectId } = await createProject(parentId);
      // Set the ID of the project that should start editing
      setEditingProjectId(newProjectId);
      // We don't select it here, ChatHistory will handle focus/edit state
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project.");
    }
  };

  // Callback for ChatHistory to clear the editing state flag
  const onEditComplete = (id: string) => {
    if (editingProjectId === id) {
      setEditingProjectId(null);
    }
  };

  // --- Import Handling ---
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Use the context's importConversation (which handles parentId logic)
      importConversation(file);
    }
    // Reset file input value so the same file can be selected again
    if (event.target) {
      event.target.value = "";
    }
  };

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
        {/* Pass editingProjectId and callback to ChatHistory */}
        <ChatHistory
          className="flex-grow"
          editingItemId={editingProjectId}
          onEditComplete={onEditComplete}
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
        {/* Add Import Button Here */}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={handleImportClick}
        >
          {/* You might want an UploadIcon here */}
          <DownloadIcon className="h-4 w-4 transform rotate-180" />{" "}
          {/* Simple upload visual */}
          Import Chat (.json)
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-sm h-9 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
          onClick={() => setIsSettingsOpen(true)}
        >
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </aside>
  );
};
