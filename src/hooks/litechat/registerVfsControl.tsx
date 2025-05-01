// src/hooks/litechat/registerVfsControl.tsx
// Entire file content provided
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
// Import InputStore action
import { useInputStore } from "@/store/input.store";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

// Convert back to a plain function
export function registerVfsControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;
  // Get InputStore action
  const addAttachedFile = useInputStore.getState().addAttachedFile;

  // Trigger Component (Renders based on current state)
  const VfsTriggerButton: React.FC = () => {
    // Read state inside the component instance
    const { toggleChatControlPanel, isChatControlPanelOpen } = useUIStateStore(
      // Use useShallow here for UI store state if needed, though less likely to cause loops
      useShallow((state) => ({
        toggleChatControlPanel: state.toggleChatControlPanel,
        isChatControlPanelOpen: state.isChatControlPanelOpen,
      })),
    );
    // Use useShallow for VFS store state to optimize re-renders
    // Select only the necessary fields
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
          // Add metadata ONLY, content will be fetched by AIService
          addAttachedFile({
            source: "vfs",
            name: node.name,
            type: node.mimeType || "application/octet-stream",
            size: node.size,
            path: node.path,
            // Do NOT include contentText or contentBase64 here
          });
          attachedCount++;
        }
      });

      if (attachedCount > 0) {
        toast.success(
          `Attached ${attachedCount} file(s) from VFS to the next prompt.`,
        );
        clearSelection();
        // Optionally close the panel after attaching
        // toggleChatControlPanel("vfs", false);
      }
    };

    if (!enableVfs) {
      return null;
    }

    return (
      // Wrap buttons in a div to keep them together
      <div className="flex items-center gap-1">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost" // Changed back to ghost
                size="icon"
                className={cn(
                  "h-8 w-8",
                  // Highlight only if panel is open, not based on selection
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

        {/* Button to attach selected VFS files - RENDER THIS BUTTON! */}
        {selectedFileIds.size > 0 && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary" // Use secondary variant to stand out
                  size="sm" // Make it slightly smaller than default
                  className="h-8 animate-fadeIn px-2" // Add padding
                  onClick={handleAttachSelectedFiles}
                  aria-label={`Attach ${selectedFileIds.size} selected VFS file(s)`}
                >
                  <PaperclipIcon className="h-4 w-4 mr-1" /> {/* Add icon */}
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

  // Panel Component (Renders based on current state)
  const VfsPanel: React.FC = () => {
    // Read state inside the component instance
    const vfsKey = useVfsStore((state) => state.vfsKey);
    const selectedItemType = useConversationStore(
      (state) => state.selectedItemType,
    );

    return (
      // Ensure this container allows FileManager to fill height
      <div className="flex flex-col h-full w-[450px] border-l border-border bg-card">
        <FileManagerBanner
          vfsKey={vfsKey}
          selectedItemType={selectedItemType}
        />
        {/* Ensure FileManager takes up remaining height */}
        <div className="flex-grow overflow-hidden">
          <FileManager />
        </div>
      </div>
    );
  };

  // Register Prompt Control (Trigger in Prompt Area)
  registerPromptControl({
    id: "core-vfs-prompt-trigger",
    order: 25,
    show: () => useVfsStore.getState().enableVfs,
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
    show: () =>
      useUIStateStore.getState().isChatControlPanelOpen["vfs"] ?? false,
    renderer: () => React.createElement(VfsPanel),
    status: () => "ready",
  });

  console.log("[Function] Registered Core VFS Control");
}
