import React, { useState } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { NotebookPenIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { toast } from "sonner";

interface EditResponseControlProps {
  interactionId: string;
  response: string;
  disabled?: boolean;
}

export const EditResponseControl: React.FC<EditResponseControlProps> = ({ 
  interactionId, 
  response,
  disabled 
}) => {
  const [open, setOpen] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) {
      toast.info("Response editing is currently disabled.");
      return;
    }
    
    // Initialize the textarea with current response content
    setEditedContent(response || "");
    setOpen(true);
  };

  const handleSave = () => {
    if (editedContent.trim() === "") {
      toast.error("Response cannot be empty");
      return;
    }

    // Emit event to handle the response edit
    emitter.emit(canvasEvent.editResponseRequest, {
      interactionId,
      newContent: editedContent.trim()
    });

    setOpen(false);
    toast.success("Response edited successfully");
  };

  const handleCancel = () => {
    setOpen(false);
    setEditedContent("");
  };

  return (
    <>
      <ActionTooltipButton
        tooltipText="Edit Response"
        onClick={handleClick}
        aria-label="Edit Assistant Response"
        disabled={disabled}
        icon={<NotebookPenIcon />}
        className="h-5 max-w-7xl md:h-6 md:max-w-6xl"
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!w-[80vw] !h-[85vh] !max-w-none flex flex-col">
          <DialogHeader className="p-2 md:p-3 pb-1 md:pb-2 flex-shrink-0">
            <DialogTitle className="p-2">Edit Assistant Response</DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-4 overflow-hidden">
            <div className="space-y-2 h-full">
              <Label htmlFor="response-edit">Response Content</Label>
              <Textarea
                id="response-edit"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder="Edit the assistant's response..."
                className="min-h-[60vh] h-full resize-none text-sm leading-relaxed"
              />
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 p-2 md:p-3 pt-1 md:pt-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}; 