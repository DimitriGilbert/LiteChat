// src/components/LiteChat/prompt/control/VfsControlRegistration.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
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
import { useInputStore } from "@/store/input.store"; // Correct store
import { cn } from "@/lib/utils";
import type { PromptControl } from "@/types/litechat/prompt";
// Import VfsFile and VfsFileObject
import type { VfsFile, VfsFileObject } from "@/types/litechat/vfs"; // Correct path
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

const CONTROL_ID = "core-vfs-control";

// --- VFS Prompt Control Component ---
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

  // Use correct actions from InputStore
  const { setSelectedFiles, selectedVfsFiles, clearSelectedFiles } =
    useInputStore(
      useShallow((state) => ({
        setSelectedFiles: state.setSelectedFiles, // Correct action name
        selectedVfsFiles: state.selectedVfsFiles, // Correct state name
        clearSelectedFiles: state.clearSelectedFiles, // Correct action name
      })),
    );

  const selectedVfsNodes: VfsFile[] = React.useMemo(() => {
    return Array.from(selectedFileIds)
      .map((id) => nodes[id])
      .filter((node): node is VfsFile => !!node && node.type === "file");
  }, [selectedFileIds, nodes]);

  // Map VFS nodes to VfsFileObject for InputStore
  const mapToInputStoreFormat = useCallback(
    (vfsNodes: VfsFile[]): VfsFileObject[] => {
      // Add return type
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
  ]); // Add mapToInputStoreFormat

  const handleFileSelectConfirm = useCallback(() => {
    const inputStoreFiles = mapToInputStoreFormat(selectedVfsNodes);
    setSelectedFiles(inputStoreFiles);
    console.log(
      "Files attached from VFS:",
      inputStoreFiles.map((f) => f.path),
    );
    toast.success(`${inputStoreFiles.length} file(s) attached from VFS.`);
    setIsDialogOpen(false);
  }, [selectedVfsNodes, setSelectedFiles, mapToInputStoreFormat]); // Add mapToInputStoreFormat

  const handleDialogClose = useCallback(() => {
    clearSelection();
    clearSelectedFiles(); // Use correct action
    setIsDialogOpen(false);
  }, [clearSelection, clearSelectedFiles]); // Use correct action

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
  ); // Use correct state name

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  <Paperclip className="h-5 w-5" />
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

// --- Registration Hook ---
export const useVfsControlRegistration = () => {
  const registerControl = useControlRegistryStore(
    (state) => state.registerPromptControl,
  );
  // Use correct state name from VfsStore
  const { enableVfs } = useVfsStore(
    useShallow((state) => ({
      enableVfs: state.enableVfs, // Correct state name
    })),
  );

  useEffect(() => {
    const control: PromptControl = {
      id: CONTROL_ID,
      status: () => "ready",
      trigger: () => <VfsPromptControl />,
      show: () => enableVfs, // Use correct state name
      getMetadata: () => {
        // Use correct state name from InputStore
        const selected = useInputStore.getState().selectedVfsFiles;
        if (selected.length === 0) return null;
        return {
          attachedVfsFiles: selected.map((f) => ({ id: f.id, path: f.path })),
        };
      },
      clearOnSubmit: () => {
        // Use correct action name from InputStore
        useInputStore.getState().clearSelectedFiles();
        useVfsStore.getState().clearSelection();
      },
      order: 40,
    };

    const unregister = registerControl(control);
    return unregister;
  }, [registerControl, enableVfs]); // Use correct state name

  return null;
};
