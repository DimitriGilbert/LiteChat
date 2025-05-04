// src/hooks/litechat/registerVfsControl.tsx
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { useVfsStore } from "@/store/vfs.store";
import { Button } from "@/components/ui/button";
import { HardDriveIcon, PaperclipIcon } from "lucide-react";
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
import { useInputStore } from "@/store/input.store";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

export function registerVfsControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;
  const addAttachedFile = useInputStore.getState().addAttachedFile;

  const VfsTriggerButton: React.FC = () => {
    const { toggleChatControlPanel, isChatControlPanelOpen } = useUIStateStore(
      useShallow((state) => ({
        toggleChatControlPanel: state.toggleChatControlPanel,
        isChatControlPanelOpen: state.isChatControlPanelOpen,
      })),
    );
    const { enableVfs, selectedFileIds, nodes, clearSelection } = useVfsStore(
      useShallow((state) => ({
        enableVfs: state.enableVfs,
        selectedFileIds: state.selectedFileIds,
        nodes: state.nodes,
        clearSelection: state.clearSelection,
      })),
    );
    const isVfsPanelOpen = isChatControlPanelOpen["vfs"] ?? false;

    const handleAttachSelectedFiles = () => {
      if (selectedFileIds.size === 0) {
        toast.info("No files selected in VFS to attach.");
        return;
      }

      let attachedCount = 0;
      selectedFileIds.forEach((fileId) => {
        const node = nodes[fileId];
        if (node && node.type === "file") {
          addAttachedFile({
            source: "vfs",
            name: node.name,
            type: node.mimeType || "application/octet-stream",
            size: node.size,
            path: node.path,
          });
          attachedCount++;
        }
      });

      if (attachedCount > 0) {
        toast.success(
          `Attached ${attachedCount} file(s) from VFS to the next prompt.`,
        );
        clearSelection();
      }
    };

    if (!enableVfs) {
      return null;
    }

    return (
      <div className="flex items-center gap-1">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  isVfsPanelOpen && "bg-muted text-primary",
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

        {selectedFileIds.size > 0 && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 animate-fadeIn px-2"
                  onClick={handleAttachSelectedFiles}
                  aria-label={`Attach ${selectedFileIds.size} selected VFS file(s)`}
                >
                  <PaperclipIcon className="h-4 w-4 mr-1" />
                  Attach ({selectedFileIds.size})
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Attach selected VFS files to prompt
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  const VfsPanel: React.FC = () => {
    const vfsKey = useVfsStore((state) => state.vfsKey);
    const selectedItemType = useConversationStore(
      (state) => state.selectedItemType,
    );

    return (
      <div className="flex flex-col h-full w-[450px] border-l border-border bg-card">
        <FileManagerBanner
          vfsKey={vfsKey}
          selectedItemType={selectedItemType}
        />
        <div className="flex-grow overflow-hidden">
          <FileManager />
        </div>
      </div>
    );
  };

  registerPromptControl({
    id: "core-vfs-prompt-trigger",
    // order removed
    show: () => useVfsStore.getState().enableVfs,
    triggerRenderer: () => React.createElement(VfsTriggerButton),
    getParameters: undefined,
    getMetadata: undefined,
    clearOnSubmit: undefined,
  });

  registerChatControl({
    id: "core-vfs-panel-trigger",
    panel: "drawer_right",
    // order removed
    show: () =>
      useUIStateStore.getState().isChatControlPanelOpen["vfs"] ?? false,
    renderer: () => React.createElement(VfsPanel),
    status: () => "ready",
  });

  console.log("[Function] Registered Core VFS Control");
}
