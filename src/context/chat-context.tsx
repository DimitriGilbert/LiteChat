
import React from "react";
import type {
  // CustomPromptAction, // REMOVED
  // CustomMessageAction, // REMOVED
  // CustomSettingTab, // REMOVED
  LiteChatConfig, // Import LiteChatConfig
} from "@/lib/types";
import ChatProviderInner from "./chat-provider-inner"; // Import the inner component



interface LiteChatProviderProps {
  children: React.ReactNode;
  config?: LiteChatConfig; // Use LiteChatConfig type
  // Keep custom actions/tabs props if they are passed down to ChatProviderInner
  // customPromptActions?: CustomPromptAction[];
  // customMessageActions?: CustomMessageAction[];
  // customSettingsTabs?: CustomSettingTab[];
}


export const ChatProvider: React.FC<LiteChatProviderProps> = ({
  children,
  config = {}, // Default to empty config object
}) => {
  // The main provider now simply renders ChatProviderInner,
  // passing down the configuration and custom items.
  // ChatProviderInner handles the useEffect for initializing stores.
  return <ChatProviderInner config={config}>{children}</ChatProviderInner>;
};
