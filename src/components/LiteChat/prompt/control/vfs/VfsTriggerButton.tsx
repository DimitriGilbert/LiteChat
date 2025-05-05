// src/components/LiteChat/prompt/control/vfs/VfsTriggerButton.tsx

import React from "react";
import { Button } from "@/components/ui/button";
import { HardDriveIcon, PaperclipIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUIStateStore } from "@/store/ui.store";
import { useVfsStore } from "@/store/vfs.store";
import { useInputStore } from "@/store/input.store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const VfsTriggerButton: React.FC = () => {
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
  const addAttachedFile = useInputStore.getState().addAttachedFile;

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
      toggleVfsModal(false);
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
              onClick={() => toggleVfsModal()}
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
