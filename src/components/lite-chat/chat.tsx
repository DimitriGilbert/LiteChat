// src/components/lite-chat/chat.tsx
import React, { useState } from "react";
import { ChatProvider } from "@/context/chat-context";
import { ChatSide } from "./chat-side";
import { ChatWrapper } from "./chat-wrapper";
import type {
  AiProviderConfig,
  SidebarItemType,
  LiteChatConfig, // Import the new config type
  Message,
  DbProject,
  DbConversation,
  SidebarItem,
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
  Message,
  DbProject,
  DbConversation,
  SidebarItem,
  SidebarItemType,
  LiteChatConfig, // Export config type as well
};
export { useSidebarManagement } from "@/hooks/use-sidebar-management"; // Keep if needed externally

interface LiteChatProps {
  providers: AiProviderConfig[];
  config?: LiteChatConfig; // Make config optional, defaults handled below
  className?: string;
  SideComponent?: React.ComponentType<{ className?: string }>;
  WrapperComponent?: React.ComponentType<{ className?: string }>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  providers,
  config = {}, // Default to empty object if config is not provided
  className,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  // Destructure config with defaults
  const {
    enableSidebar = true,
    enableVfs = true,
    enableApiKeyManagement = true,
    enableAdvancedSettings = true,
    initialProviderId = null,
    initialModelId = null,
    initialSelectedItemId = null,
    initialSelectedItemType = null,
    streamingThrottleRate, // Let ChatProvider handle its default
    defaultSidebarOpen = true,
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
      // Pass down the resolved feature flags
      enableApiKeyManagement={enableApiKeyManagement}
      enableSidebar={enableSidebar}
      enableVfs={enableVfs}
      enableAdvancedSettings={enableAdvancedSettings}
    >
      <div
        className={cn(
          "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
          className,
        )}
      >
        {/* Sidebar - Conditionally render based on flag AND state */}
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
          {/* Sidebar Toggle Button - Only show if sidebar is enabled */}
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

          {/* Render the main chat content */}
          <WrapperComponent className="h-full" />
        </div>
      </div>
    </ChatProvider>
  );
};
