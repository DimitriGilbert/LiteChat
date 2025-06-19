// src/components/LiteChat/common/ActionDialog.tsx
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | React.ReactNode;
  children: React.ReactNode
  submitLabel?: string;
  onSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  submitDisabled?: boolean
  className?: string;
  contentClassName?: string;
}

export const ActionDialog: React.FC<ActionDialogProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  submitLabel = "Submit",
  onSubmit,
  isSubmitting,
  submitDisabled = false,
  className,
  contentClassName,
}) => {
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (isSubmitting || submitDisabled) return;
    await onSubmit();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(className)}>
        <DialogHeader className="p-2 md:p-3 pb-1 md:pb-2 flex-shrink-0">
          <DialogTitle className="p-2">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("py-4", contentClassName)}>{children}</div>
        <DialogFooter className="p-2 md:p-3 pt-1 md:pt-2">
          {/* Use DialogClose for the Cancel button */}
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || submitDisabled}
          >
            {isSubmitting && (
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isSubmitting ? "Submitting..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
