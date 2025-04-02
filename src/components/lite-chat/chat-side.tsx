// src/components/lite-chat/chat-side.tsx
import React, { useState, useRef } from "react";
import { ChatHistory } from "./chat-history";
import { SettingsModal } from "./settings-modal";
import { Button } from "@/components/ui/button";
import { SettingsIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UploadIcon, DownloadIcon } from "lucide-react";
import { useChatContext } from "@/hooks/use-chat-context";

interface ChatSideProps {
  className?: string;
}

export const ChatSide: React.FC<ChatSideProps> = ({ className }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const {
    selectConversation,
    createConversation,
    selectedConversationId,
    exportConversation,
    importConversation,
  } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportClick = () => {
    exportConversation(selectedConversationId);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importConversation(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleCreate = async () => {
    const newId = await createConversation();
    selectConversation(newId);
  };

  return (
    <aside
      className={cn(
        "h-full flex flex-col bg-gray-800 border-r border-gray-700",
        className,
      )}
    >
      <div className="p-4 border-b border-gray-700">
        <Button
          variant="default"
          className="w-full justify-start gap-2 bg-gray-700 hover:bg-gray-600 text-white"
          onClick={handleCreate}
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-grow overflow-hidden flex flex-col">
        <ChatHistory className="flex-grow" />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="application/json"
      />

      <div className="border-t border-gray-700 p-3 space-y-2 bg-gray-800">
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
