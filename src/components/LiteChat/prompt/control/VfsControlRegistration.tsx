// src/components/LiteChat/prompt/control/VfsControlRegistration.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
// Changed icon from Paperclip to FolderOpen
import { FolderOpenIcon } from "lucide-react";
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
import type { VfsFile, VfsFileObject } from "@/types/litechat/vfs";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

const CONTROL_ID = "core-vfs-control";

const VfsPromptControl: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { nodes, selectedFileIds, clearSelection, uploadFiles } = useVfsStore(
    useShallow((state) => ({
      nodes: state.nodes,
      selectedFileIds: state.selectedFileIds,
      clearSelection: state.clearSelection,
      uploadFiles: state.uploadFiles,
      currentParentId: state.currentParentId,
    })),
  );

  const { setSelectedFiles, selectedVfsFiles, clearSelectedFiles } =
    useInputStore(
      useShallow((state) => ({
        setSelectedFiles: state.setSelectedFiles,
        selectedVfsFiles: state.selectedVfsFiles,
        clearSelectedFiles: state.clearSelectedFiles,
      })),
    );

  const selectedVfsNodes: VfsFile[] = React.useMemo(() => {
    return Array.from(selectedFileIds)
      .map((id) => nodes[id])
      .filter((node): node is VfsFile => !!node && node.type === "file");
  }, [selectedFileIds, nodes]);

  const mapToInputStoreFormat = useCallback(
    (vfsNodes: VfsFile[]): VfsFileObject[] => {
      return vfsNodes.map((node) => ({
        id: node.id,
        name: node.name,
        size: node.size,
        type: node.mimeType || "application/octet-stream",
        path: node.path,
      }));
    },
    [],
  );

  useEffect(() => {
    if (isDialogOpen) {
      const inputStoreFiles = mapToInputStoreFormat(selectedVfsNodes);
      if (
        inputStoreFiles.length !== selectedVfsFiles.length ||
        JSON.stringify(inputStoreFiles) !== JSON.stringify(selectedVfsFiles)
      ) {
        setSelectedFiles(inputStoreFiles);
      }
    }
  }, [
    isDialogOpen,
    selectedVfsNodes,
    setSelectedFiles,
    selectedVfsFiles,
    mapToInputStoreFormat,
  ]);

  const handleFileSelectConfirm = useCallback(() => {
    const inputStoreFiles = mapToInputStoreFormat(selectedVfsNodes);
    setSelectedFiles(inputStoreFiles);
    console.log(
      "Files attached from VFS:",
      inputStoreFiles.map((f) => f.path),
    );
    toast.success(`${inputStoreFiles.length} file(s) attached from VFS.`);
    setIsDialogOpen(false);
  }, [selectedVfsNodes, setSelectedFiles, mapToInputStoreFormat]);

  const handleDialogClose = useCallback(() => {
    if (selectedFileIds.size > 0) {
      clearSelection();
    }
    clearSelectedFiles();
    setIsDialogOpen(false);
  }, [clearSelection, clearSelectedFiles, selectedFileIds.size]);

  const getCurrentParentId = useVfsStore.getState().currentParentId;

  const handleFileDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        try {
          await uploadFiles(getCurrentParentId, files);
          toast.success(
            `${files.length} file(s) added to VFS. Select them in the manager.`,
          );
          setIsDialogOpen(true);
        } catch (error) {
          console.error("Error adding files via drop:", error);
          toast.error("Failed to add dropped files.");
        }
      }
    },
    [uploadFiles, getCurrentParentId, setIsDialogOpen],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    [],
  );

  const attachedVfsCount = useInputStore(
    (state) => state.selectedVfsFiles.length,
  );

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleDialogClose();
        } else {
          setIsDialogOpen(true);
        }
      }}
    >
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
                  {/* Changed Icon */}
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
      <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
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
            <Button variant="outline" onClick={handleDialogClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleFileSelectConfirm}
            disabled={selectedVfsNodes.length === 0}
          >
            Attach Selected ({selectedVfsNodes.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
      getMetadata: () => {
        const selected = useInputStore.getState().selectedVfsFiles;
        if (selected.length === 0) return undefined;
        const validFiles = selected
          .filter((f): f is typeof f & { path: string } => !!f.path)
          .map((f) => ({ id: f.id, path: f.path }));
        return validFiles.length > 0
          ? { attachedVfsFiles: validFiles }
          : undefined;
      },
      clearOnSubmit: () => {
        useInputStore.getState().clearSelectedFiles();
        const vfsStore = useVfsStore.getState();
        if (vfsStore.selectedFileIds.size > 0) {
          vfsStore.clearSelection();
        }
      },
      order: 40,
    };

    const unregister = registerControl(control);
    return unregister;
  }, [registerControl, enableVfs]);

  return null;
};
