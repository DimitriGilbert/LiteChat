// src/hooks/litechat/useConversationListControl.tsx
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";
// Correct the import path if ConversationListControlComponent is now the default export or named export
import { ConversationListControlComponent } from "@/components/LiteChat/chat/control/ConversationList";
import { ConversationListIconRenderer } from "@/components/LiteChat/chat/control/conversation-list/IconRenderer";
import type { ChatControl } from "@/types/litechat/chat";

// No changes needed in this file based on the refactoring of ConversationList.tsx itself.
// It correctly imports the main component and the icon renderer.
export const useConversationListControlRegistration = () => {
  const register = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  const isLoading = useConversationStore((state) => state.isLoading);

  React.useEffect(() => {
    const control: ChatControl = {
      id: "core-conversation-list",
      status: () => (isLoading ? "loading" : "ready"),
      panel: "sidebar",
      // Ensure this points to the correct component export
      renderer: () => <ConversationListControlComponent />,
      iconRenderer: () => <ConversationListIconRenderer />,
      show: () => true,
      order: 10,
    };
    const unregister = register(control);
    return unregister;
  }, [register, isLoading]);

  return null;
};
