// src/components/LiteChat/common/SettingsModal.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // Import cn

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[600px]", // Example width, adjust as needed
          "flex flex-col h-[80vh] max-h-[700px]", // Set height and max-height
        )}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage application settings.</DialogDescription>
        </DialogHeader>
        {/* Make content area scrollable */}
        <div className="flex-grow overflow-y-auto p-4 border-t border-b">
          Settings Content Placeholder - Tabs will go here later.
          {/* Add more placeholder content to test scrolling */}
          <div className="h-[500px] bg-muted/20 mt-4 p-2">
            Scrollable Area Test
          </div>
        </div>
        <DialogFooter className="flex-shrink-0 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
