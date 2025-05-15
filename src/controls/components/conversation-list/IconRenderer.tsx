// src/components/LiteChat/chat/control/ConversationListIconRenderer.tsx
// FULL FILE
import React from "react";
import { MessageSquareTextIcon, FolderIcon, Loader2 } from "lucide-react";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import type { ConversationListControlModule } from "@/controls/modules/ConversationListControlModule";

interface ConversationListIconRendererProps {
  module: ConversationListControlModule;
}

export const ConversationListIconRenderer: React.FC<
  ConversationListIconRendererProps
> = ({ module }) => {
  const { selectedItemType } = useConversationStore(
    useShallow((state) => ({
      // selectedItemId: state.selectedItemId,
      selectedItemType: state.selectedItemType,
    }))
  );
  const isLoading = module.isLoading;

  if (isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  if (selectedItemType === "project") {
    return <FolderIcon className="h-5 w-5 text-primary" />;
  }
  if (selectedItemType === "conversation") {
    return <MessageSquareTextIcon className="h-5 w-5 text-primary" />;
  }

  // Default icon if nothing is selected or if it's an unknown type
  return <MessageSquareTextIcon className="h-5 w-5 text-muted-foreground" />;
};
