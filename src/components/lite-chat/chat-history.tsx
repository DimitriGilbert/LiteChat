import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatContext } from "@/hooks/use-chat-context";
import { Trash2Icon, Edit3Icon } from "lucide-react";
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

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <ScrollArea className="flex-grow px-3 py-2">
        <div className="space-y-1 pr-2">
          {conversations.length === 0 && (
            <div className="text-sm text-gray-400 text-center py-4">
              No conversations yet
            </div>
          )}

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
                  onBlur={handleCancelRename}
                  autoFocus
                  className="h-9 flex-grow text-sm bg-gray-700 border-gray-600 text-gray-200"
                  aria-label="Rename conversation input"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-gray-300 hover:text-white"
                >
                  Save
                </Button>
              </form>
            ) : (
              <div
                key={convo.id}
                className={cn(
                  "group w-full justify-between h-10 px-3 text-sm font-normal flex",
                  selectedConversationId === convo.id
                    ? "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    : "hover:bg-gray-700 text-gray-300",
                )}
                onClick={() => selectConversation(convo.id)}
              >
                <span className="truncate flex-grow text-left">
                  {convo.title}
                </span>
                <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(convo.id, convo.title);
                    }}
                    aria-label="Rename conversation"
                  >
                    <Edit3Icon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:bg-red-900/30 hover:text-red-400 text-gray-400"
                    onClick={(e) => handleDelete(convo.id, e)}
                    aria-label="Delete conversation"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
