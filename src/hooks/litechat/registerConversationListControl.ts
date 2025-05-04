// src/hooks/litechat/registerConversationListControl.ts
import React from "react";
import { ConversationListControlComponent } from "@/components/LiteChat/chat/control/ConversationList";
import { ConversationListIconRenderer } from "@/components/LiteChat/chat/control/conversation-list/IconRenderer";
import { useControlRegistryStore } from "@/store/control.store";
import { useConversationStore } from "@/store/conversation.store";

export function registerConversationListControl() {
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;
  const isLoading = useConversationStore.getState().isLoading;

  registerChatControl({
    id: "core-conversation-list",
    panel: "sidebar",
    // order removed
    status: () => (isLoading ? "loading" : "ready"),
    renderer: () => React.createElement(ConversationListControlComponent),
    iconRenderer: () => React.createElement(ConversationListIconRenderer),
    show: () => true,
  });

  console.log("[Function] Registered Core Conversation List Control");
}
