import React from "react";
import { useConversationStore } from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PlusIcon, Trash2Icon } from "lucide-react"; // Import Trash icon
import { useShallow } from "zustand/react/shallow";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";

export const ConversationListControlComponent: React.FC = () => {
  const {
    conversations,
    selectConversation,
    selectedConversationId,
    addConversation,
    deleteConversation,
  } = useConversationStore(
    useShallow((state) => ({
      // Use shallow comparison
      conversations: state.conversations,
      selectConversation: state.selectConversation,
      selectedConversationId: state.selectedConversationId,
      addConversation: state.addConversation,
      deleteConversation: state.deleteConversation,
    })),
  );

  const handleNewChat = async () => {
    const newId = await addConversation({ title: "New Chat" });
    selectConversation(newId);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection when clicking delete
    if (window.confirm("Delete this conversation? This cannot be undone.")) {
      deleteConversation(id);
    }
  };

  return (
    <div className="p-2 border rounded bg-card text-card-foreground h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold pl-1">Conversations</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleNewChat}
          aria-label="New Chat"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-grow">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground p-2">
            No conversations yet.
          </p>
        )}
        <ul className="space-y-0.5 p-1">
          {conversations.map((c) => (
            <li
              key={c.id}
              className={`flex justify-between items-center group p-1.5 text-xs rounded cursor-pointer hover:bg-muted ${c.id === selectedConversationId ? "bg-muted font-medium" : ""}`}
              onClick={() => selectConversation(c.id)}
            >
              <span className="truncate pr-1">{c.title || "Untitled"}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 flex-shrink-0"
                onClick={(e) => handleDelete(c.id, e)}
              >
                <Trash2Icon className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
};

// Registration Hook/Component
export const useConversationListControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  const isLoading = useConversationStore((state) => state.isLoading); // For status

  React.useEffect(() => {
    const control: ChatControl = {
      id: "core-conversation-list",
      status: () => (isLoading ? "loading" : "ready"),
      panel: "sidebar",
      renderer: () => <ConversationListControlComponent />,
      show: () => true,
      order: 10,
    };
    const unregister = register(control);
    return unregister;
  }, [register, isLoading]);
};
