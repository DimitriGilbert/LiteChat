// src/hooks/litechat/registerVfsControl.tsx
// FULL FILE
import React from "react";
import { useControlRegistryStore } from "@/store/control.store";
import { useUIStateStore } from "@/store/ui.store";
import { useVfsStore } from "@/store/vfs.store";
import { Button } from "@/components/ui/button";
import { HardDriveIcon, PaperclipIcon, XIcon } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

export function registerVfsControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;
  const registerChatControl =
    useControlRegistryStore.getState().registerChatControl;
  const addAttachedFile = useInputStore.getState().addAttachedFile;

  // --- Trigger Button for Prompt Area ---
  const VfsTriggerButton: React.FC = () => {
    // Use toggleVfsModal from UI store
    const { toggleVfsModal, isVfsModalOpen } = useUIStateStore(
      useShallow((state) => ({
        toggleVfsModal: state.toggleVfsModal,
        isVfsModalOpen: state.isVfsModalOpen,
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
        toggleVfsModal(false); // Close modal after attaching
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
                  isVfsModalOpen && "bg-muted text-primary",
                )}
                // Toggle the modal state
                onClick={() => toggleVfsModal()}
                aria-label="Toggle Virtual File System"
              >
                <HardDriveIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Virtual Filesystem</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Attach button remains the same, but might be moved inside the modal later */}
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

  // --- VFS Panel Component (Now wrapped in Dialog) ---
  const VfsModalPanel: React.FC = () => {
    const { isVfsModalOpen, toggleVfsModal } = useUIStateStore(
      useShallow((state) => ({
        isVfsModalOpen: state.isVfsModalOpen,
        toggleVfsModal: state.toggleVfsModal,
      })),
    );
    const { vfsKey, selectedFileIds, clearSelection } = useVfsStore(
      useShallow((state) => ({
        vfsKey: state.vfsKey,
        selectedFileIds: state.selectedFileIds,
        clearSelection: state.clearSelection,
      })),
    );
    const selectedItemType = useConversationStore(
      (state) => state.selectedItemType,
    );

    const handleAttachAndClose = () => {
      // Logic is now in VfsTriggerButton, but could be moved here
      // For now, just close the modal
      toggleVfsModal(false);
    };

    const handleClose = () => {
      clearSelection(); // Clear selection when closing modal
      toggleVfsModal(false);
    };

    return (
      <Dialog open={isVfsModalOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] w-[90vw] h-[80vh] min-h-[500px] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 pb-2 border-b flex-shrink-0">
            <DialogTitle>Virtual Filesystem</DialogTitle>
            <DialogDescription>
              Manage files associated with the current context. Select files to
              attach them to your next prompt.
            </DialogDescription>
            <FileManagerBanner
              vfsKey={vfsKey}
              selectedItemType={selectedItemType}
            />
          </DialogHeader>
          {/* Ensure FileManager takes up remaining space */}
          <div className="flex-grow overflow-hidden">
            <FileManager />
          </div>
          <DialogFooter className="p-4 pt-2 border-t flex-shrink-0">
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            {/* Attach button inside the modal footer */}
            <Button
              onClick={handleAttachAndClose}
              disabled={selectedFileIds.size === 0}
            >
              <PaperclipIcon className="h-4 w-4 mr-2" />
              Attach Selected ({selectedFileIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // --- Registration ---
  registerPromptControl({
    id: "core-vfs-prompt-trigger",
    show: () => useVfsStore.getState().enableVfs,
    triggerRenderer: () => React.createElement(VfsTriggerButton),
    // No panel renderer needed for the prompt control itself
    getParameters: undefined,
    getMetadata: undefined,
    clearOnSubmit: undefined,
  });

  // Register the modal panel separately using ChatControl
  registerChatControl({
    id: "core-vfs-modal-panel",
    // This control doesn't render directly in a panel, it's a modal
    panel: undefined,
    // Show condition based on the modal state in UIStore
    show: () => useUIStateStore.getState().isVfsModalOpen,
    // Render the modal component
    renderer: () => React.createElement(VfsModalPanel),
    status: () => "ready",
  });

  console.log(
    "[Function] Registered Core VFS Control (Prompt Trigger & Modal)",
  );
}
