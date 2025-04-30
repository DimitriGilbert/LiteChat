// src/hooks/litechat/registerVfsControl.ts
// Entire file content provided as it's significantly changed
import React from "react";
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
import { cn } from "@/lib/utils";

// Convert back to a plain function
export function registerVfsControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;

  // Trigger Component (Renders based on current state)
  const VfsTriggerButton: React.FC = () => {
    // Read state inside the component instance
    const { toggleChatControlPanel, isChatControlPanelOpen } =
      useUIStateStore.getState();
    const enableVfs = useVfsStore.getState().enableVfs;
    const isVfsPanelOpen = isChatControlPanelOpen["vfs"] ?? false;

    if (!enableVfs) {
      return null; // Don't render trigger if VFS is disabled globally
    }

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
  };

  // Panel Component (Renders based on current state)
  const VfsPanel: React.FC = () => {
    // Read state inside the component instance
    const { vfsKey } = useVfsStore.getState();
    const { selectedItemType } = useConversationStore.getState();

    return (
      <div className="flex flex-col h-full w-[450px] border-l border-border bg-card">
        <FileManagerBanner
          vfsKey={vfsKey}
          selectedItemType={selectedItemType}
        />
        <FileManager />
      </div>
    );
  };

  // Register Prompt Control (Trigger in Prompt Area)
  registerPromptControl({
    id: "core-vfs-prompt-trigger",
    order: 20,
    // Show condition is handled inside the VfsTriggerButton component now
    show: () => useVfsStore.getState().enableVfs, // Still useful for initial filtering
    triggerRenderer: () => React.createElement(VfsTriggerButton),
    getParameters: undefined,
    getMetadata: undefined,
    clearOnSubmit: undefined,
  });

  // Register Chat Control (The Panel itself)
  registerChatControl({
    id: "core-vfs-panel-trigger",
    panel: "drawer_right",
    order: 10,
    // Show panel based ONLY on the UI store state for this panel
    show: () =>
      useUIStateStore.getState().isChatControlPanelOpen["vfs"] ?? false,
    renderer: () => React.createElement(VfsPanel),
    status: () => "ready",
  });

  console.log("[Function] Registered Core VFS Control");
}
