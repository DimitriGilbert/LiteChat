import React, { useState, useRef, useEffect } from "react";
import { ChatHistory } from "./chat-history";
import { SettingsModal } from "./settings-modal";
import { Button } from "@/components/ui/button";
import {
  SettingsIcon,
  PlusIcon,
  FolderPlusIcon,
  DownloadIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatContext } from "@/hooks/use-chat-context";
import { toast } from "sonner";

interface ChatSideProps {
  className?: string;
}

export const ChatSide: React.FC<ChatSideProps> = ({ className }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    createConversation,
    createProject,
    selectedItemId,
    selectedItemType,
    importConversation,
    getConversation,
    // getProject, // REMOVE unused
  } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [parentIdForNewItem, setParentIdForNewItem] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let determinedParentId: string | null = null;
    if (selectedItemType === "project") {
      determinedParentId = selectedItemId;
    } else if (selectedItemType === "conversation") {
      if (selectedItemId) {
        getConversation(selectedItemId).then((convo) => {
          if (convo) {
            setParentIdForNewItem(convo.parentId);
          } else {
            setParentIdForNewItem(null);
          }
        });
        return;
      } else {
        determinedParentId = null;
      }
    } else {
      determinedParentId = null;
    }
    setParentIdForNewItem(determinedParentId);
  }, [selectedItemId, selectedItemType, getConversation]);

  const handleCreateChat = async () => {
    await createConversation(parentIdForNewItem);
  };

  const handleCreateProject = async () => {
    try {
      const { id: newProjectId } = await createProject(parentIdForNewItem);
      setEditingProjectId(newProjectId);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("Failed to create project.");
    }
  };

  const onEditComplete = (id: string) => {
    if (editingProjectId === id) {
      setEditingProjectId(null);
    }
  };

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
