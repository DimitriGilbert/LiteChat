// src/components/lite-chat/chat.tsx
import React, { useState } from "react";
import { ChatProvider } from "@/context/chat-context";
import { ChatSide } from "./chat-side";
import { ChatWrapper } from "./chat-wrapper";
import { useChatContext } from "@/hooks/use-chat-context";
// REMOVED: import { useChatInput } from "@/hooks/use-chat-input";
import type {
  AiProviderConfig,
  SidebarItemType,
  LiteChatConfig,
  SidebarItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiteChatProps {
  providers: AiProviderConfig[];
  config?: LiteChatConfig;
  className?: string;
  SideComponent?: React.ComponentType<{ className?: string }>;
  WrapperComponent?: React.ComponentType<{
    className?: string;
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
    sidebarItems: SidebarItem[];
    regenerateMessage: (messageId: string) => void;
    // REMOVED props for prompt state
  }>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  providers,
  config = {},
  className,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
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
    customPromptActions = [],
    customMessageActions = [],
    customSettingsTabs = [],
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
      customPromptActions={customPromptActions}
      customMessageActions={customMessageActions}
      customSettingsTabs={customSettingsTabs}
    >
      {/* Render LiteChatInner directly */}
      <LiteChatInner
        className={className}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        enableSidebar={enableSidebar}
        SideComponent={SideComponent}
        WrapperComponent={WrapperComponent}
      />
    </ChatProvider>
  );
};

// REMOVED: LiteChatInnerWithInputState component

interface LiteChatInnerProps {
  className?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  enableSidebar: boolean;
  SideComponent: React.ComponentType<{ className?: string }>;
  WrapperComponent: React.ComponentType<{
    className?: string;
    selectedItemId: string | null;
    selectedItemType: SidebarItemType | null;
    sidebarItems: SidebarItem[];
    regenerateMessage: (messageId: string) => void;
    // REMOVED props for prompt state
  }>;
  // REMOVED props for prompt state
}

const LiteChatInner: React.FC<LiteChatInnerProps> = ({
  className,
  sidebarOpen,
  setSidebarOpen,
  enableSidebar,
  SideComponent,
  WrapperComponent,
  // REMOVED prompt state props
}) => {
  // Get non-prompt related state from context
  const { selectedItemId, selectedItemType, sidebarItems, regenerateMessage } =
    useChatContext();

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-gray-900 border border-gray-700 rounded-lg shadow-sm",
        className,
      )}
    >
      {enableSidebar && sidebarOpen && (
        <SideComponent className={cn("w-72 flex-shrink-0", "hidden md:flex")} />
      )}

      <div className="flex-grow flex flex-col relative w-full min-w-0">
        {enableSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-3 left-3 z-10 text-gray-400 hover:text-white hover:bg-gray-700 md:hidden",
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

        <WrapperComponent
          className="h-full"
          selectedItemId={selectedItemId}
          selectedItemType={selectedItemType}
          sidebarItems={sidebarItems}
          regenerateMessage={regenerateMessage}
          // REMOVED passing prompt state props down
        />
      </div>
    </div>
  );
};
