// src/components/lite-chat/chat.tsx
import React, { useState } from "react";
import { ChatProvider } from "@/context/chat-context";
import { ChatSide } from "./chat-side";
import { ChatWrapper } from "./chat-wrapper";
import type { AiProviderConfig } from "@/lib/types";
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
export type { AiProviderConfig, AiModelConfig, Message } from "@/lib/types";

interface LiteChatProps {
  providers: AiProviderConfig[];
  initialProviderId?: string | null;
  initialModelId?: string | null;
  initialConversationId?: string | null;
  streamingThrottleRate?: number;
  className?: string;
  /** Optional: Default state for the sidebar (true = open, false = closed) */
  defaultSidebarOpen?: boolean;
  SideComponent?: React.ComponentType<{ className?: string }>;
  WrapperComponent?: React.ComponentType<{ className?: string }>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  providers,
  initialProviderId,
  initialModelId,
  initialConversationId,
  streamingThrottleRate,
  className,
  defaultSidebarOpen = true, // Default to open
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  return (
    <ChatProvider
      providers={providers}
      initialProviderId={initialProviderId}
      initialModelId={initialModelId}
      initialConversationId={initialConversationId}
      streamingThrottleRate={streamingThrottleRate}
    >
      <div
        className={cn(
          "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
          className,
        )}
      >
        {/* Sidebar: Conditionally render and apply classes */}
        {sidebarOpen && (
          <SideComponent
            className={cn(
              "w-72 flex-shrink-0", // Ensure sidebar doesn't shrink
              "hidden md:flex", // Hide on small screens, flex on medium+
            )}
          />
        )}

        {/* Main Chat Area Wrapper */}
        <div className="flex-grow flex flex-col relative w-full min-w-0">
          {" "}
          {/* Added min-w-0 */}
          {/* Sidebar Toggle Button - Positioned relative to this wrapper */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-3 left-3 z-10 text-gray-400 hover:text-white hover:bg-gray-700",
              // Show toggle only on medium screens if sidebar is closed, or always on small screens
              sidebarOpen ? "md:hidden" : "block",
            )}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {/* Use MenuIcon when sidebar is closed, XIcon when open (on small screens) */}
            {sidebarOpen ? (
              <XIcon className="h-5 w-5 md:hidden" /> // Show X only on small screens when open
            ) : (
              <MenuIcon className="h-5 w-5" /> // Show Menu when closed
            )}
          </Button>
          {/* Render the main chat content */}
          <WrapperComponent className="h-full" />{" "}
          {/* Ensure Wrapper takes full height */}
        </div>
      </div>
    </ChatProvider>
  );
};
