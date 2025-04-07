// src/components/lite-chat/chat.tsx
import React, { useState } from "react";
import { ChatProvider } from "@/context/chat-context";
import { ChatSide } from "./chat-side";
import { ChatWrapper } from "./chat-wrapper";
import type { AiProviderConfig, SidebarItemType } from "@/lib/types"; // Import SidebarItemType
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Export sub-components for composability
// ... (keep existing exports) ...
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
  DbProject, // Export DbProject if needed by consumers
  DbConversation, // Export DbConversation if needed by consumers
  SidebarItem, // Export SidebarItem if needed by consumers
  SidebarItemType, // Export SidebarItemType if needed by consumers
} from "@/lib/types";

interface LiteChatProps {
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialSelectedItemId?: string | null; // Renamed from initialConversationId
  initialSelectedItemType?: SidebarItemType | null; // Added
  streamingThrottleRate?: number;
  className?: string;
  defaultSidebarOpen?: boolean;
  SideComponent?: React.ComponentType<{ className?: string }>;
  WrapperComponent?: React.ComponentType<{ className?: string }>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  providers,
  initialProviderId,
  initialModelId,
  initialSelectedItemId, // Use new prop
  initialSelectedItemType, // Use new prop
  streamingThrottleRate,
  className,
  defaultSidebarOpen = true,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  return (
    <ChatProvider
      providers={providers}
      initialProviderId={initialProviderId}
      initialModelId={initialModelId}
      initialSelectedItemId={initialSelectedItemId} // Pass new prop
      initialSelectedItemType={initialSelectedItemType} // Pass new prop
      streamingThrottleRate={streamingThrottleRate}
    >
      <div
        className={cn(
          "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
          className,
        )}
      >
        {/* Sidebar */}
        {sidebarOpen && (
          <SideComponent
            className={cn(
              "w-72 flex-shrink-0",
              "hidden md:flex", // Standard responsive behavior
            )}
          />
        )}

        {/* Mobile Sidebar (Drawer - Example, requires extra implementation) */}
        {/* {sidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-40">
             <SideComponent className="w-72 h-full absolute left-0 top-0 z-50" />
          </div>
        )} */}

        {/* Main Chat Area Wrapper */}
        <div className="flex-grow flex flex-col relative w-full min-w-0">
          {/* Sidebar Toggle Button */}
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

          {/* Render the main chat content */}
          <WrapperComponent className="h-full" />
        </div>
      </div>
    </ChatProvider>
  );
};
