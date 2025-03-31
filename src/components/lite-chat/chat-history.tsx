import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "@/context/chat-context";
import { MessageSquarePlusIcon, Trash2Icon, Edit3Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input"; // For renaming

interface ChatHistoryProps {
  className?: string;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ className }) => {
  const {
    conversations,
    selectedConversationId,
    selectConversation,
    createConversation,
    deleteConversation,
    renameConversation,
  } = useChatContext();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditText(currentTitle);
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId && editText.trim()) {
      await renameConversation(editingId, editText.trim());
      handleCancelRename();
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the conversation when clicking delete
    if (window.confirm("Are you sure you want to delete this chat?")) {
      await deleteConversation(id);
    }
  };

  const handleCreate = async () => {
    const newId = await createConversation();
    selectConversation(newId);
  };

  return (
    <div className={`flex h-full flex-col p-2 ${className}`}>
      <Button
        variant="outline"
        className="mb-2 w-full justify-start gap-2"
        onClick={handleCreate}
      >
        <MessageSquarePlusIcon className="h-4 w-4" />
        New Chat
      </Button>
      <ScrollArea className="flex-grow h-0">
        <div className="space-y-1 pr-2">
          {conversations.map((convo) =>
            editingId === convo.id ? (
              <form
                key={convo.id}
                onSubmit={handleConfirmRename}
                className="flex items-center gap-1 p-1"
              >
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={handleCancelRename} // Cancel on blur
                  autoFocus
                  className="h-8 flex-grow"
                  aria-label="Rename conversation input"
                />
                <Button type="submit" size="sm" variant="ghost">
                  Save
                </Button>
              </form>
            ) : (
              <Button
                key={convo.id}
                variant={
                  selectedConversationId === convo.id ? "secondary" : "ghost"
                }
                className="group w-full justify-between h-8 px-2"
                onClick={() => selectConversation(convo.id)}
              >
                <span className="truncate flex-grow text-left text-sm">
                  {convo.title}
                </span>
                <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(convo.id, convo.title);
                    }}
                    aria-label="Rename conversation"
                  >
                    <Edit3Icon className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => handleDelete(convo.id, e)}
                    aria-label="Delete conversation"
                  >
                    <Trash2Icon className="h-3 w-3" />
                  </Button>
                </div>
              </Button>
            ),
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
