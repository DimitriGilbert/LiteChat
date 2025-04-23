// src/components/lite-chat/chat.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import ChatProviderInner from "@/context/chat-provider-inner";
import { ChatSide } from "./chat/chat-side";
import { ChatWrapper } from "./chat/chat-wrapper";
import { useLiteChatLogic } from "@/hooks/use-lite-chat-logic";
import { useChatStorage } from "@/hooks/use-chat-storage";
import { useShallow } from "zustand/react/shallow";
import { useSidebarStore } from "@/store/sidebar.store";
import { useSettingsStore } from "@/store/settings.store";
import { useModStore } from "@/store/mod.store";
import type { LiteChatConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";

interface LiteChatProps {
  config?: LiteChatConfig;
  className?: string;
  SideComponent?: ComponentType<any>;
  WrapperComponent?: ComponentType<any>;
}

export const LiteChat: React.FC<LiteChatProps> = ({
  config = {},
  className,
  SideComponent = ChatSide,
  WrapperComponent = ChatWrapper,
}) => {
  const { defaultSidebarOpen = true } = config;
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const handleEditComplete = useCallback((id: string) => {
    setEditingItemId((currentEditingId) => {
      if (currentEditingId === id) {
        return null;
      }
      return currentEditingId;
    });
  }, []);

  const handleSetEditingItemId = useCallback((id: string | null) => {
    setEditingItemId(id);
  }, []);

  const theme = useSettingsStore((state) => state.theme);
  useEffect(() => {
    if (typeof window === "undefined" || !window.document?.documentElement) {
      return;
    }

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    }

    root.classList.add(effectiveTheme);
  }, [theme]);

  return (
    <ChatProviderInner config={config}>
      <LiteChatInner
        className={className}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        enableSidebarConfig={config.enableSidebar ?? true}
        SideComponent={SideComponent}
        WrapperComponent={WrapperComponent}
        editingItemId={editingItemId}
        setEditingItemId={handleSetEditingItemId}
        onEditComplete={handleEditComplete}
        customPromptActions={config.customPromptActions}
        customMessageActions={config.customMessageActions}
        customSettingsTabs={config.customSettingsTabs}
      />
    </ChatProviderInner>
  );
};

interface LiteChatInnerProps {
  className?: string;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  enableSidebarConfig: boolean;
  SideComponent: ComponentType<any>;
  WrapperComponent: ComponentType<any>;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  onEditComplete: (id: string) => void;
  customPromptActions?: LiteChatConfig["customPromptActions"];
  customMessageActions?: LiteChatConfig["customMessageActions"];
  customSettingsTabs?: LiteChatConfig["customSettingsTabs"];
}

const LiteChatInner: React.FC<LiteChatInnerProps> = ({
  className,
  sidebarOpen,
  setSidebarOpen,
  enableSidebarConfig,
  SideComponent,
  WrapperComponent,
  editingItemId,
  setEditingItemId,
  onEditComplete,
  customPromptActions = [],
  customMessageActions = [],
  customSettingsTabs = [],
}) => {
  // Fetch DB data needed by useLiteChatLogic
  const storage = useChatStorage();

  const { enableSidebar: enableSidebarStore } = useSidebarStore(
    useShallow((state) => ({ enableSidebar: state.enableSidebar })),
  );
  const { modPromptActions, modMessageActions, modSettingsTabs } = useModStore(
    useShallow((state) => ({
      modPromptActions: state.modPromptActions,
      modMessageActions: state.modMessageActions,
      modSettingsTabs: state.modSettingsTabs,
    })),
  );

  // --- Call useLiteChatLogic ---
  // Pass only necessary props and DB data
  const logic = useLiteChatLogic({
    editingItemId,
    setEditingItemId,
    onEditComplete,
    dbConversations: storage.conversations || [],
    dbProjects: storage.projects || [],
  });

  // Destructure only the handlers needed by WrapperComponent
  const {
    handleFormSubmit,
    stopStreaming,
    regenerateMessage,
    getContextSnapshotForMod,
  } = logic;

  // --- Combine User and Mod Actions/Tabs ---
  const combinedPromptActions = useMemo(
    () => [...customPromptActions, ...modPromptActions],
    [customPromptActions, modPromptActions],
  );
  const combinedMessageActions = useMemo(
    () => [...customMessageActions, ...modMessageActions],
    [customMessageActions, modMessageActions],
  );
  const combinedSettingsTabs = useMemo(
    () => [...customSettingsTabs, ...modSettingsTabs],
    [customSettingsTabs, modSettingsTabs],
  );

  const showSidebar = enableSidebarConfig && enableSidebarStore;

  // Fetch exportConversation action directly from store for ChatHeader (passed to Wrapper)
  const exportConversationAction = useSidebarStore(
    (state) => state.exportConversation,
  );

  return (
    <div
      className={cn(
        "flex h-full w-full overflow-hidden bg-background border border-border rounded-lg shadow-sm",
        className,
      )}
    >
      {showSidebar && sidebarOpen && (
        <SideComponent
          className={cn("w-72 flex-shrink-0", "hidden md:flex")}
          editingItemId={editingItemId}
          onEditComplete={onEditComplete}
          setEditingItemId={setEditingItemId}
        />
      )}

      <div className="flex-grow flex flex-col relative w-full min-w-0">
        {showSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute top-3 left-3 z-10 text-muted-foreground hover:text-foreground hover:bg-muted md:hidden transition-colors",
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
        {/* Pass only necessary props to WrapperComponent */}
        <WrapperComponent
          className="h-full"
          customPromptActions={combinedPromptActions}
          customMessageActions={combinedMessageActions}
          customSettingsTabs={combinedSettingsTabs}
          handleFormSubmit={handleFormSubmit}
          stopStreaming={stopStreaming}
          regenerateMessage={regenerateMessage}
          exportConversation={exportConversationAction}
          getContextSnapshotForMod={getContextSnapshotForMod}
        />
      </div>
    </div>
  );
};
