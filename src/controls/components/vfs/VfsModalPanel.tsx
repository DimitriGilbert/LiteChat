// src/controls/components/vfs/VfsModalPanel.tsx
// FULL FILE
import React, { useEffect, useState } from "react";
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
import { FileManager } from "@/components/LiteChat/file-manager/FileManager"; // Path might need adjustment
import { FileManagerBanner } from "@/components/LiteChat/file-manager/FileManagerBanner"; // Path might need adjustment
import { useInputStore } from "@/store/input.store";
import { toast } from "sonner";
import type { VfsControlModule } from "@/controls/modules/VfsControlModule";
import { useConversationStore } from "@/store/conversation.store"; // For selectedItemType
import { useVfsStore } from "@/store/vfs.store"; // For vfsKey

interface VfsModalPanelProps {
  module: VfsControlModule;
}

export const VfsModalPanel: React.FC<VfsModalPanelProps> = ({ module }) => {
  const [, forceUpdate] = useState({});
  useEffect(() => {
    module.setNotifyModalUpdate(() => forceUpdate({}));
    return () => module.setNotifyModalUpdate(null);
  }, [module]);

  // Read state from module or relevant stores
  const isVfsModalOpen = module.getIsVfsModalOpen();
  const selectedFileIdsCount = module.getSelectedFileIdsCount();
  const vfsKey = useVfsStore.getState().vfsKey; // VFS key for banner
  const selectedItemType = useConversationStore.getState().selectedItemType; // For banner

  const addAttachedFile = useInputStore.getState().addAttachedFile;

  const handleAttachAndClose = () => {
    const selectedIds = useVfsStore.getState().selectedFileIds; // Get fresh set
    if (selectedIds.size === 0) {
      toast.info("No files selected in VFS to attach.");
      return;
    }

    let attachedCount = 0;
    const nodes = module.getVfsNodes();
    selectedIds.forEach((fileId) => {
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
        `Attached ${attachedCount} file(s) from VFS to the next prompt.`
      );
      module.clearVfsSelection();
      module.toggleVfsModal(false);
    } else {
      toast.warning("No valid files were selected to attach.");
    }
  };

  const handleClose = () => {
    module.clearVfsSelection();
    module.toggleVfsModal(false);
  };

  // Visibility is handled by the ChatControl's `show` method in the module.

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
            onClick={handleAttachAndClose}
            disabled={selectedFileIdsCount === 0}
          >
            <PaperclipIcon className="h-4 w-4 mr-2" />
            Attach Selected ({selectedFileIdsCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
