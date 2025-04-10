// src/components/lite-chat/chat.tsx
import React, { useState } from "react";
import { ChatProvider } from "@/context/chat-context";
import { ChatSide } from "./chat-side";
import { ChatWrapper } from "./chat-wrapper";
import type {
  AiProviderConfig,
  AiModelConfig, // Added missing import
  SidebarItemType,
  LiteChatConfig,
  Message,
  DbProject,
  DbConversation,
  SidebarItem,
  CustomPromptAction,
  CustomMessageAction,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Export sub-components for composability
export { ChatContent } from "./chat-content";
export { ChatHistory } from "./chat-history";
export { ChatSide } from "./chat-side";
export { ChatWrapper } from "./chat-wrapper";
export { MessageActions } from "./message-actions";
export { MemoizedMessageBubble as MessageBubble } from "./message-bubble";
export { ModelSelector } from "./model-selector";
export { PromptActions } from "./prompt-actions";
export { PromptFiles } from "./prompt-files";
export { PromptForm } from "./prompt-form";
export { PromptInput } from "./prompt-input";
export { PromptSettings } from "./prompt-settings";
export { PromptWrapper } from "./prompt-wrapper";
export { ProviderSelector } from "./provider-selector";
export { SettingsModal } from "./settings-modal";
export { useChatContext } from "@/hooks/use-chat-context";
export { ChatProvider } from "@/context/chat-context";
export type {
  AiProviderConfig,
  AiModelConfig,
  Message,
  DbProject,
  DbConversation,
  SidebarItem,
  SidebarItemType,
  LiteChatConfig,
  CustomPromptAction,
  CustomMessageAction,
};
export { useSidebarManagement } from "@/hooks/use-sidebar-management";

interface LiteChatProps {
  providers: AiProviderConfig[];
  config?: LiteChatConfig; // Config now includes custom actions
  className?: string;
  SideComponent?: React.ComponentType<{ className?: string }>;
  WrapperComponent?: React.ComponentType<{ className?: string }>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  providers,
  config = {},
  className,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  // Destructure config with defaults, including custom actions
  const {
    enableSidebar = true,
    enableVfs = true,
    enableApiKeyManagement = true,
    enableAdvancedSettings = true,
    initialProviderId = null,
    initialModelId = null,
    initialSelectedItemId = null,
    initialSelectedItemType = null,
    streamingThrottleRate,
    defaultSidebarOpen = true,
    customPromptActions = [], // Default to empty array
    customMessageActions = [], // Default to empty array
  } = config;

  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  return (
    <ChatProvider
      providers={providers}
      initialProviderId={initialProviderId}
      initialModelId={initialModelId}
      initialSelectedItemId={initialSelectedItemId}
      initialSelectedItemType={initialSelectedItemType}
      streamingThrottleRate={streamingThrottleRate}
      enableApiKeyManagement={enableApiKeyManagement}
      enableSidebar={enableSidebar}
      enableVfs={enableVfs}
      enableAdvancedSettings={enableAdvancedSettings}
      // Pass custom actions down to the provider
      customPromptActions={customPromptActions}
      customMessageActions={customMessageActions}
    >
      <div
        className={cn(
          "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
          className,
        )}
      >
        {/* Sidebar */}
        {enableSidebar && sidebarOpen && (
          <SideComponent
            className={cn(
              "w-72 flex-shrink-0",
              "hidden md:flex", // Standard responsive behavior
            )}
          />
        )}

        {/* Main Chat Area Wrapper */}
        <div className="flex-grow flex flex-col relative w-full min-w-0">
          {/* Sidebar Toggle Button */}
          {enableSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute top-3 left-3 z-10 text-gray-400 hover:text-white hover:bg-gray-700 md:hidden", // Only show on small screens
              )}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? (
                <XIcon className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* Chat Content */}
          <WrapperComponent className="h-full" />
        </div>
      </div>
    </ChatProvider>
  );
};
