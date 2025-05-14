// src/controls/components/vfs/VfsModalPanel.tsx
// FULL FILE
import React from "react"; // Removed useState as it's not used
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
import type { VfsControlModule } from "@/controls/modules/VfsControlModule";
import { useConversationStore } from "@/store/conversation.store";
import { useVfsStore } from "@/store/vfs.store";
import type { ModalProviderProps } from "@/types/litechat/modding"; // Import ModalProviderProps

interface VfsModalPanelProps extends ModalProviderProps {
  module: VfsControlModule;
}

export const VfsModalPanel: React.FC<VfsModalPanelProps> = ({
  module,
  isOpen, // Prop from ModalManager
  onClose, // Prop from ModalManager
}) => {
  // Removed forceUpdate and useEffect for module.setNotifyModalUpdate

  const selectedFileIdsCount = module.getSelectedFileIdsCount();
  const vfsKey = useVfsStore.getState().vfsKey;
  const selectedItemType = useConversationStore.getState().selectedItemType;

  const addAttachedFile = useInputStore.getState().addAttachedFile;

  const handleAttachAndClose = () => {
    const selectedIds = useVfsStore.getState().selectedFileIds;
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
      onClose(); // Use onClose from props
    } else {
      toast.warning("No valid files were selected to attach.");
    }
  };

  const handleDialogClose = () => {
    module.clearVfsSelection();
    onClose(); // Use onClose from props
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
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
          <Button variant="outline" onClick={handleDialogClose}>
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
