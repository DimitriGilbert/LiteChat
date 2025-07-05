// src/controls/components/vfs/VfsTriggerButton.tsx
// FULL FILE
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HardDriveIcon, PaperclipIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { VfsControlModule } from "@/controls/modules/VfsControlModule";
import { useInputStore } from "@/store/input.store";
import { useVfsStore } from "@/store/vfs.store";
import { useTranslation } from "react-i18next";

interface VfsTriggerButtonProps {
  module: VfsControlModule;
}

export const VfsTriggerButton: React.FC<VfsTriggerButtonProps> = ({
  module,
}) => {
  const { t } = useTranslation('vfs');
  const [, forceUpdate] = useState({});
  useEffect(() => {
    if (module && typeof module.setNotifyTriggerUpdate === "function") {
      module.setNotifyTriggerUpdate(() => forceUpdate({}));
      return () => {
        if (module && typeof module.setNotifyTriggerUpdate === "function") {
          module.setNotifyTriggerUpdate(null);
        }
      };
    }
  }, [module]);

  const isVfsModalOpen =
    module && typeof module.getIsVfsModalOpen === "function"
      ? module.getIsVfsModalOpen()
      : false;
  const selectedFileIdsCount =
    module && typeof module.getSelectedFileIdsCount === "function"
      ? module.getSelectedFileIdsCount()
      : 0;
  const isVisible =
    module && typeof module.getEnableVfs === "function"
      ? module.getEnableVfs()
      : false;

  const addAttachedFile = useInputStore.getState().addAttachedFile;

  const handleAttachSelectedFiles = () => {
    const selectedIds = useVfsStore.getState().selectedFileIds;
    if (selectedIds.size === 0) {
      toast.info(t('modal.noFilesSelected'));
      return;
    }

    let attachedCount = 0;
    const nodes = module.getVfsNodes(); // Assuming getVfsNodes is safe to call
    selectedIds.forEach((fileId: string) => {
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
        t('modal.filesAttached', { count: attachedCount })
      );
      if (typeof module.clearVfsSelection === "function") {
        module.clearVfsSelection();
      }
      if (typeof module.toggleVfsModal === "function") {
        // This should now emit a close request if the modal is open
        // module.toggleVfsModal(); // Or explicitly module.closeVfsModal() if that exists
      }
    } else {
      toast.warning(t('modal.noValidFilesSelected'));
    }
  };

  if (!isVisible) {
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
                isVfsModalOpen && "bg-muted text-primary"
              )}
              onClick={() =>
                module &&
                typeof module.toggleVfsModal === "function" &&
                module.toggleVfsModal()
              }
              aria-label={t('triggerButton.toggleVfs')}
            >
              <HardDriveIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{t('triggerButton.virtualFilesystem')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {selectedFileIdsCount > 0 && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="h-8 animate-fadeIn px-2"
                onClick={handleAttachSelectedFiles}
                aria-label={t('triggerButton.attachVfsFiles', { count: selectedFileIdsCount })}
              >
                <PaperclipIcon className="h-4 w-4 mr-1" />
                {t('triggerButton.attachButtonText', { count: selectedFileIdsCount })}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {t('triggerButton.attachSelectedTooltip')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
