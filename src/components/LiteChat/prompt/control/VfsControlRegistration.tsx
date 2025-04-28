// src/components/LiteChat/prompt/control/VfsControlRegistration.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpenIcon, Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileManager } from "@/components/LiteChat/file-manager/FileManager";
import { useControlRegistryStore } from "@/store/control.store";
import { useVfsStore } from "@/store/vfs.store";
import { useInputStore } from "@/store/input.store";
import { cn } from "@/lib/utils";
import type { PromptControl } from "@/types/litechat/prompt";
import type { VfsFile } from "@/types/litechat/vfs";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import * as VfsOps from "@/lib/litechat/vfs-operations";
import { COMMON_TEXT_EXTENSIONS_VFS } from "@/types/litechat/vfs";
import type { AttachedFileMetadata } from "@/store/input.store";

const CONTROL_ID = "core-vfs-control";

// Helper function to convert ArrayBuffer to Base64 (remains the same)
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const isLikelyTextFile = (name: string, mimeType?: string): boolean => {
  const fileNameLower = name.toLowerCase();
  if (mimeType?.startsWith("text/") || mimeType === "application/json") {
    return true;
  }
  return COMMON_TEXT_EXTENSIONS_VFS.some((ext) => fileNameLower.endsWith(ext));
};
// --- End Text Detection Logic ---

const VfsPromptControl: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);

  const { nodes, selectedFileIds, clearSelection, uploadFiles } = useVfsStore(
    useShallow((state) => ({
      nodes: state.nodes,
      selectedFileIds: state.selectedFileIds,
      clearSelection: state.clearSelection,
      uploadFiles: state.uploadFiles,
      currentParentId: state.currentParentId,
    })),
  );

  const { addAttachedFile, attachedFilesMetadata } = useInputStore(
    useShallow((state) => ({
      addAttachedFile: state.addAttachedFile,
      attachedFilesMetadata: state.attachedFilesMetadata,
    })),
  );

  const selectedVfsNodes: VfsFile[] = React.useMemo(() => {
    return Array.from(selectedFileIds)
      .map((id) => nodes[id])
      .filter((node): node is VfsFile => !!node && node.type === "file");
  }, [selectedFileIds, nodes]);

  // Attach selected VFS files to the InputStore, reading content first
  const handleFileSelectConfirm = useCallback(async () => {
    if (selectedVfsNodes.length === 0 || isAttaching) return;

    setIsAttaching(true);
    let successCount = 0;
    let errorCount = 0;

    const processingPromises = selectedVfsNodes.map(async (node) => {
      try {
        // Read content as ArrayBuffer first
        const buffer = await VfsOps.readFileOp(node.path);
        const mimeType = node.mimeType || "application/octet-stream";
        // Use the helper to determine if it's likely text
        const isText = isLikelyTextFile(node.name, mimeType);

        // Prepare the data object for addAttachedFile
        const fileDataToAdd: Omit<AttachedFileMetadata, "id"> = {
          source: "vfs",
          name: node.name,
          type: mimeType,
          size: node.size,
          path: node.path,
        };

        if (isText) {
          // Decode as text and add contentText
          fileDataToAdd.contentText = new TextDecoder().decode(buffer);
        } else {
          // Convert to base64 and add contentBase64
          fileDataToAdd.contentBase64 = arrayBufferToBase64(buffer);
        }

        // Add the file metadata *with* the content to the input store
        addAttachedFile(fileDataToAdd);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Failed to read VFS file ${node.path}:`, error);
        toast.error(
          `Failed to attach "${node.name}": ${error instanceof Error ? error.message : "Read error"}`,
        );
      }
    });

    await Promise.all(processingPromises);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) attached from VFS.`);
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount} file(s) could not be attached.`);
    }

    clearSelection();
    setIsAttaching(false);
    setIsDialogOpen(false);
  }, [selectedVfsNodes, addAttachedFile, clearSelection, isAttaching]);

  // --- Other handlers remain the same ---
  const handleDialogClose = useCallback(
    (open: boolean) => {
      if (!open) {
        if (selectedFileIds.size > 0) {
          clearSelection();
        }
        setIsDialogOpen(false);
      } else {
        setIsDialogOpen(true);
      }
    },
    [clearSelection, selectedFileIds.size],
  );

  const getCurrentParentId = useVfsStore.getState().currentParentId;
  const getCurrentPath = () => {
    const parentNode = getCurrentParentId
      ? useVfsStore.getState().nodes[getCurrentParentId]
      : useVfsStore.getState().nodes[useVfsStore.getState().rootId || ""];
    return parentNode?.path || "/";
  };

  const handleFileDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        try {
          await uploadFiles(getCurrentParentId, files);
          toast.success(
            `${files.length} file(s) added to VFS at ${getCurrentPath()}. Select them in the manager.`,
          );
        } catch (error) {
          console.error("Error adding files via drop:", error);
          toast.error("Failed to add dropped files.");
        }
      }
    },
    [uploadFiles, getCurrentParentId],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const attachedVfsCount = attachedFilesMetadata.filter(
    (f) => f.source === "vfs",
  ).length;

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
              className="inline-block"
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "relative h-10 w-10 rounded-full",
                    attachedVfsCount > 0 && "text-blue-500 hover:text-blue-600",
                  )}
                  aria-label={`Attach files from VFS (${attachedVfsCount} selected)`}
                >
                  <FolderOpenIcon className="h-5 w-5" />
                  {attachedVfsCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                      {attachedVfsCount}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Attach files from VFS ({attachedVfsCount} selected)</p>
            <p className="text-xs text-muted-foreground">Drag & drop enabled</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="max-w-[1200px] h-[85vh] sm:max-w-4xl flex flex-col">
        <DialogHeader>
          <DialogTitle>File Manager</DialogTitle>
          <DialogDescription>
            Manage files in the virtual filesystem. Select files and click
            "Attach Selected" to add them to your prompt.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden">
          <FileManager />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleFileSelectConfirm}
            disabled={selectedVfsNodes.length === 0 || isAttaching} // Disable while attaching
          >
            {isAttaching && (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isAttaching
              ? "Attaching..."
              : `Attach Selected (${selectedVfsNodes.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Registration hook remains the same
export const useVfsControlRegistration = () => {
  const registerControl = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  const { enableVfs } = useVfsStore(
    useShallow((state) => ({
      enableVfs: state.enableVfs,
    })),
  );

  useEffect(() => {
    const control: PromptControl = {
      id: CONTROL_ID,
      triggerRenderer: () => <VfsPromptControl />,
      show: () => enableVfs,
      order: 40,
    };

    const unregister = registerControl(control);
    return unregister;
  }, [registerControl, enableVfs]);

  return null;
};
