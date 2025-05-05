// src/components/LiteChat/prompt/control/vfs/VfsModalPanel.tsx

import React from "react";
import { useUIStateStore } from "@/store/ui.store";
import { useVfsStore } from "@/store/vfs.store";
import { useConversationStore } from "@/store/conversation.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { PaperclipIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileManager } from "@/components/LiteChat/file-manager/FileManager";
import { FileManagerBanner } from "@/components/LiteChat/file-manager/FileManagerBanner";
import { useInputStore } from "@/store/input.store";
import { toast } from "sonner";

export const VfsModalPanel: React.FC = () => {
  const { isVfsModalOpen, toggleVfsModal } = useUIStateStore(
    useShallow((state) => ({
      isVfsModalOpen: state.isVfsModalOpen,
      toggleVfsModal: state.toggleVfsModal,
    })),
  );
  const { vfsKey, selectedFileIds, clearSelection, nodes } = useVfsStore(
    useShallow((state) => ({
      vfsKey: state.vfsKey,
      selectedFileIds: state.selectedFileIds,
      clearSelection: state.clearSelection,
      nodes: state.nodes,
    })),
  );
  const selectedItemType = useConversationStore(
    (state) => state.selectedItemType,
  );
  const addAttachedFile = useInputStore.getState().addAttachedFile;

  // Move attach logic here
  const handleAttachAndClose = () => {
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
      toggleVfsModal(false);
    } else {
      // Handle case where selected IDs might be invalid (e.g., folders)
      toast.warning("No valid files were selected to attach.");
    }
  };

  const handleClose = () => {
    clearSelection();
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
        <div className="flex-grow overflow-hidden">
          <FileManager />
        </div>
        <DialogFooter className="p-4 pt-2 border-t flex-shrink-0">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button
            onClick={handleAttachAndClose} // Use the combined handler
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
