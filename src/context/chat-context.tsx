// src/context/chat-context.tsx
import React from "react";
import type {
  // CustomPromptAction, // REMOVED
  // CustomMessageAction, // REMOVED
  // CustomSettingTab, // REMOVED
  LiteChatConfig, // Import LiteChatConfig
} from "@/lib/types";
import ChatProviderInner from "./chat-provider-inner"; // Import the inner component
// REMOVED: import { EMPTY_CUSTOM_SETTINGS_TABS, EMPTY_CUSTOM_PROMPT_ACTIONS, EMPTY_CUSTOM_MESSAGE_ACTIONS } from "@/utils/chat-utils";

// Renamed original props interface to reflect it's for the top-level component
interface LiteChatProviderProps {
  children: React.ReactNode;
  config?: LiteChatConfig; // Use LiteChatConfig type
  // Keep custom actions/tabs props if they are passed down to ChatProviderInner
  // customPromptActions?: CustomPromptAction[];
  // customMessageActions?: CustomMessageAction[];
  // customSettingsTabs?: CustomSettingTab[];
}

// This is the main exported provider component
export const ChatProvider: React.FC<LiteChatProviderProps> = ({
  children,
  config = {}, // Default to empty config object
}) => {
  // The main provider now simply renders ChatProviderInner,
  // passing down the configuration and custom items.
  // ChatProviderInner handles the useEffect for initializing stores.
  return <ChatProviderInner config={config}>{children}</ChatProviderInner>;
};
