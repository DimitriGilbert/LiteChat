
import React from "react";
import type {
  // CustomPromptAction,
  // CustomMessageAction,
  // CustomSettingTab,
  LiteChatConfig,
} from "@/lib/types";
import ChatProviderInner from "./chat-provider-inner";



interface LiteChatProviderProps {
  children: React.ReactNode;
  config?: LiteChatConfig;
  // Keep custom actions/tabs props if they are passed down to ChatProviderInner
  // customPromptActions?: CustomPromptAction[];
  // customSettingsTabs?: CustomSettingTab[];
}


export const ChatProvider: React.FC<LiteChatProviderProps> = ({
  children,
  config = {},
}) => {
  // The main provider now simply renders ChatProviderInner,
  // ChatProviderInner handles the useEffect for initializing stores.
  return <ChatProviderInner config={config}>{children}</ChatProviderInner>;
};
