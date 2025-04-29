// src/hooks/litechat/registerVfsControl.ts
import React from "react";
import { Button } from "@/components/ui/button";
import { FolderIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileManager } from "@/components/LiteChat/file-manager/FileManager";
import { FileManagerBanner } from "@/components/LiteChat/file-manager/FileManagerBanner";
import { useControlRegistryStore } from "@/store/control.store";
import { useVfsStore } from "@/store/vfs.store";
import { useConversationStore } from "@/store/conversation.store";
import { useInteractionStore } from "@/store/interaction.store";
import { useShallow } from "zustand/react/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useInputStore } from "@/store/input.store";

export function registerVfsControl() {
  const registerPromptControl =
    useControlRegistryStore.getState().registerPromptControl;

  const VfsControlTrigger: React.FC = () => {
    const { selectedFileIds, nodes, downloadFile } = useVfsStore(
      useShallow((state) => ({
        selectedFileIds: state.selectedFileIds,
        nodes: state.nodes,
        downloadFile: state.downloadFile,
      })),
    );
    const addAttachedFile = useInputStore.getState().addAttachedFile;
    const isStreaming = useInteractionStore.getState().status === "streaming";
    const { selectedItemId, selectedItemType, getTopLevelProjectId } =
      useConversationStore(
        useShallow((state) => ({
          selectedItemId: state.selectedItemId,
          selectedItemType: state.selectedItemType,
          getTopLevelProjectId: state.getTopLevelProjectId,
        })),
      );
    const { vfsKey, isVfsEnabledForItem } = useVfsStore(
      useShallow((state) => ({
        vfsKey: state.vfsKey,
        isVfsEnabledForItem: state.isVfsEnabledForItem,
      })),
    );

    const handleAttachSelected = async () => {
      if (selectedFileIds.size === 0) {
        toast.info("No files selected in VFS.");
        return;
      }

      let attachedCount = 0;
      let errorCount = 0;

      for (const fileId of selectedFileIds) {
        const node = nodes[fileId];
        if (node && node.type === "file") {
          try {
            const fileData = await downloadFile(fileId);
            if (fileData) {
              const reader = new FileReader();
              const promise = new Promise<{
                contentText?: string;
                contentBase64?: string;
              }>((resolve, reject) => {
                reader.onload = () => {
                  const result = reader.result as string;
                  if (node.mimeType?.startsWith("text/")) {
                    resolve({ contentText: result });
                  } else if (node.mimeType?.startsWith("image/")) {
                    resolve({ contentBase64: result.split(",")[1] });
                  } else {
                    // Handle other types if needed, or resolve without content
                    resolve({});
                  }
                };
                reader.onerror = reject;

                if (node.mimeType?.startsWith("text/")) {
                  reader.readAsText(fileData.blob);
                } else if (node.mimeType?.startsWith("image/")) {
                  reader.readAsDataURL(fileData.blob);
                } else {
                  // Skip reading content for unsupported types for now
                  resolve({});
                }
              });

              const content = await promise;

              addAttachedFile({
                source: "vfs",
                name: node.name,
                type: node.mimeType || "application/octet-stream",
                size: node.size,
                path: node.path,
                ...content,
              });
              attachedCount++;
            } else {
              errorCount++;
            }
          } catch (error) {
            errorCount++;
            console.error(`Error processing VFS file ${node.name}:`, error);
            toast.error(`Failed to attach VFS file "${node.name}".`);
          }
        }
      }

      if (attachedCount > 0) {
        toast.success(`Attached ${attachedCount} file(s) from VFS.`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to attach ${errorCount} file(s) from VFS.`);
      }
    };

    // Determine VFS key based on selection
    const currentVfsKey = getTopLevelProjectId(selectedItemId, selectedItemType)
      ? `project_${getTopLevelProjectId(selectedItemId, selectedItemType)}`
      : "orphan";

    // Update VFS key in store if it differs
    if (vfsKey !== currentVfsKey) {
      useVfsStore.getState().setVfsKey(currentVfsKey);
      useVfsStore.getState().setIsVfsEnabledForItem(true); // Enable VFS when key is set
    } else if (!isVfsEnabledForItem) {
      // Ensure VFS is enabled if key matches but was disabled
      useVfsStore.getState().setIsVfsEnabledForItem(true);
    }

    return (
      <Popover>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isStreaming || !isVfsEnabledForItem}
                  aria-label="Open Virtual File System"
                >
                  <FolderIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Virtual Filesystem</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent
          className="w-[80vw] max-w-[800px] h-[60vh] p-0"
          align="start"
        >
          <div className="flex flex-col h-full">
            <FileManagerBanner
              vfsKey={vfsKey}
              selectedItemType={selectedItemType}
            />
            <FileManager />
            <div className="p-2 border-t flex justify-end">
              <Button
                size="sm"
                onClick={handleAttachSelected}
                disabled={selectedFileIds.size === 0 || isStreaming}
              >
                Attach Selected ({selectedFileIds.size})
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  registerPromptControl({
    id: "core-vfs-manager",
    order: 25,
    // status: () => (useVfsStore.getState().loading ? "loading" : "ready"), // Removed status
    triggerRenderer: () => React.createElement(VfsControlTrigger),
    // Metadata (attached files) is handled by PromptWrapper reading InputStore
    show: () => useVfsStore.getState().enableVfs, // Show based on global VFS setting
  });

  console.log("[Function] Registered Core VFS Control");
  // No cleanup needed or returned
}
