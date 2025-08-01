// src/controls/components/vfs/VfsModalPanel.tsx
// FULL FILE
import React, { useState, useEffect } from "react";
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
import { toast } from "sonner";
import type { VfsControlModule } from "@/controls/modules/VfsControlModule";
import type { ModalProviderProps } from "@/types/litechat/modding";
import { emitter } from "@/lib/litechat/event-emitter";
import { vfsEvent } from "@/types/litechat/events/vfs.events";
import { inputEvent } from "@/types/litechat/events/input.events";
import { conversationEvent } from "@/types/litechat/events/conversation.events";
import type { VfsEventPayloads } from "@/types/litechat/events/vfs.events";
import type { SidebarItemType } from "@/types/litechat/chat";
import { useVfsStore } from "@/store/vfs.store";
import { useTranslation } from "react-i18next";

interface VfsModalPanelProps extends ModalProviderProps {
  module: VfsControlModule;
}

export const VfsModalPanel: React.FC<VfsModalPanelProps> = ({
  module,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation(['vfs', 'common']);
  // Track selected count locally
  const [selectedCount, setSelectedCount] = useState(
    module.getSelectedFileIdsCount()
  );
  const [selectedItemType, setSelectedItemType] =
    useState<SidebarItemType | null>(null);

  useEffect(() => {
    const handleSelectionChange = (
      payload: VfsEventPayloads[typeof vfsEvent.selectionChanged]
    ) => {
      setSelectedCount(payload.selectedFileIds.length);
    };

    const handleSelectedItemChanged = (payload: {
      itemId: string | null;
      itemType: SidebarItemType | null;
    }) => {
      setSelectedItemType(payload.itemType);
    };

    emitter.on(vfsEvent.selectionChanged, handleSelectionChange);
    emitter.on(
      conversationEvent.selectedItemChanged,
      handleSelectedItemChanged
    );

    return () => {
      emitter.off(vfsEvent.selectionChanged, handleSelectionChange);
      emitter.off(
        conversationEvent.selectedItemChanged,
        handleSelectedItemChanged
      );
    };
  }, []);

  const vfsKey = useVfsStore.getState().vfsKey;

  const handleAttachAndClose = () => {
    const selectedIds = useVfsStore.getState().selectedFileIds;
    const nodes = module.getVfsNodes();
    if (selectedIds.size === 0) {
      toast.info(t('vfs:modal.noFilesSelected'));
      return;
    }

    let attachedCount = 0;
    selectedIds.forEach((fileId) => {
      const node = nodes[fileId];
      if (node && node.type === "file") {
        emitter.emit(inputEvent.addAttachedFileRequest, {
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
        t('vfs:modal.filesAttached', { count: attachedCount })
      );
      module.clearVfsSelection();
      onClose();
    } else {
      toast.warning(t('vfs:modal.noValidFilesSelected'));
    }
  };

  const handleDialogClose = () => {
    module.clearVfsSelection();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] w-[90vw] h-[80vh] min-h-[500px] max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-2 md:p-3 pb-1 md:pb-2 border-b flex-shrink-0">
          <DialogTitle className="p-2">{t('vfs:modal.title')}</DialogTitle>
          <DialogDescription>
            {t('vfs:modal.description')}
          </DialogDescription>
          <FileManagerBanner
            vfsKey={vfsKey}
            selectedItemType={selectedItemType}
          />
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          <FileManager />
        </div>
        <DialogFooter className="p-2 md:p-3 pt-1 md:pt-2 border-t flex-shrink-0">
          <Button variant="outline" onClick={handleDialogClose}>
            {t('common:close')}
          </Button>
          <Button onClick={handleAttachAndClose} disabled={selectedCount === 0}>
            <PaperclipIcon className="h-4 w-4 mr-2" />
            {t('vfs:modal.attachSelected', { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
