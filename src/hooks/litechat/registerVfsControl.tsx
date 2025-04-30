// src/hooks/litechat/registerVfsControl.tsx
import React, { useEffect, useMemo } from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { useVfsStore } from "@/store/vfs.store";
import { Button } from "@/components/ui/button";
import { HardDriveIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileManager } from "@/components/LiteChat/file-manager/FileManager";
import { FileManagerBanner } from "@/components/LiteChat/file-manager/FileManagerBanner";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";

export const RegisterVfsControl: React.FC = () => {
  const registerPromptControl = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const registerChatControl = useControlRegistryStore(
    (state) => state.registerChatControl,
  );
  const { toggleChatControlPanel, isChatControlPanelOpen } = useUIStateStore(
    useShallow((state) => ({
      toggleChatControlPanel: state.toggleChatControlPanel,
      isChatControlPanelOpen: state.isChatControlPanelOpen,
    })),
  );
  // Get global enableVfs state and current key for banner
  const { enableVfs, vfsKey } = useVfsStore(
    useShallow((state) => ({
      enableVfs: state.enableVfs,
      vfsKey: state.vfsKey,
    })),
  );
  // Get conversation state for banner context
  const { selectedItemType } = useConversationStore(
    useShallow((state) => ({
      selectedItemType: state.selectedItemType,
    })),
  );

  const isVfsPanelOpen = isChatControlPanelOpen["vfs"] ?? false;

  // Memoize the trigger component
  const VfsTriggerButton = useMemo(() => {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-8 w-8",
                isVfsPanelOpen && "bg-primary/10 text-primary",
              )}
              onClick={() => toggleChatControlPanel("vfs")}
              aria-label="Toggle Virtual File System"
            >
              <HardDriveIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Virtual Filesystem</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }, [isVfsPanelOpen, toggleChatControlPanel]);

  // Memoize the panel component
  const VfsPanel = useMemo(() => {
    return (
      <div className="flex flex-col h-full w-[450px] border-l border-border bg-card">
        {/* Banner now uses vfsKey directly */}
        <FileManagerBanner
          vfsKey={vfsKey}
          selectedItemType={selectedItemType}
        />
        <FileManager />
      </div>
    );
  }, [vfsKey, selectedItemType]); // Depend on vfsKey and selectedItemType for banner

  useEffect(() => {
    console.log("[Component] Registering Core VFS Control");
    // Register Prompt Control (Trigger in Prompt Area)
    const unregisterPrompt = registerPromptControl({
      id: "core-vfs-prompt-trigger",
      order: 20,
      // Show trigger if VFS is globally enabled (or always if no global toggle)
      show: () => enableVfs, // Use the global enable flag
      triggerRenderer: () => VfsTriggerButton,
      getParameters: undefined,
      getMetadata: undefined,
      clearOnSubmit: undefined,
    });

    // Register Chat Control (The Panel itself)
    const unregisterChat = registerChatControl({
      id: "core-vfs-panel-trigger",
      panel: "drawer_right",
      order: 10,
      // Show panel based ONLY on the UI store state for this panel
      show: () => isVfsPanelOpen,
      renderer: () => VfsPanel,
      status: () => "ready",
    });

    return () => {
      console.log("[Component] Unregistering Core VFS Control");
      unregisterPrompt();
      unregisterChat();
    };
  }, [
    registerPromptControl,
    registerChatControl,
    enableVfs, // Depend on global enable flag for prompt trigger show condition
    isVfsPanelOpen, // Depend on panel open state for ChatControl show condition
    VfsTriggerButton,
    VfsPanel,
  ]);

  return null;
};
