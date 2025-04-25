// src/components/LiteChat/chat/control/ConversationList.tsx
import React from "react";
import { useConversationStore } from "@/store/conversation.store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { ChatControl } from "@/types/litechat/chat";
import { useControlRegistryStore } from "@/store/control.store";
import { cn } from "@/lib/utils"; // Import cn
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

export const ConversationListControlComponent: React.FC = () => {
  const {
    conversations,
    selectConversation,
    selectedConversationId,
    addConversation,
    deleteConversation,
    isLoading, // Get loading state
  } = useConversationStore(
    useShallow((state) => ({
      conversations: state.conversations,
      selectConversation: state.selectConversation,
      selectedConversationId: state.selectedConversationId,
      addConversation: state.addConversation,
      deleteConversation: state.deleteConversation,
      isLoading: state.isLoading, // Select loading state
    })),
  );

  const handleNewChat = async () => {
    try {
      const newId = await addConversation({ title: "New Chat" });
      selectConversation(newId);
    } catch (error) {
      console.error("Failed to create new chat:", error);
      // Optionally show a toast error
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection when clicking delete
    if (window.confirm("Delete this conversation? This cannot be undone.")) {
      deleteConversation(id).catch((error) => {
        console.error("Failed to delete conversation:", error);
        // Optionally show a toast error
      });
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
          disabled={isLoading} // Disable button while loading
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-grow">
        {isLoading ? (
          // Show skeleton loaders while loading
          <div className="space-y-1 p-1">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-0.5 p-1">
            {conversations.map((c) => (
              <li
                key={c.id}
                className={cn(
                  "flex justify-between items-center group p-1.5 text-xs rounded cursor-pointer hover:bg-muted",
                  c.id === selectedConversationId ? "bg-muted font-medium" : "",
                )}
                onClick={() => selectConversation(c.id)}
              >
                <span className="truncate pr-1">{c.title || "Untitled"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 flex-shrink-0"
                  onClick={(e) => handleDelete(c.id, e)}
                  aria-label={`Delete conversation ${c.title || "Untitled"}`}
                >
                  <Trash2Icon className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
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
      status: () => (isLoading ? "loading" : "ready"), // Status based on loading state
      panel: "sidebar", // Render in the sidebar
      renderer: () => <ConversationListControlComponent />,
      show: () => true, // Always show
      order: 10, // Define an order
    };
    const unregister = register(control);
    return unregister;
  }, [register, isLoading]); // Re-register if loading state changes

  // This hook doesn't render anything itself
  return null;
};
