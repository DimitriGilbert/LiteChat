import React, { useState, useCallback } from "react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { NotebookPenIcon, SaveIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitter } from "@/lib/litechat/event-emitter";
import { canvasEvent } from "@/types/litechat/events/canvas.events";
import { toast } from "sonner";

// Re-export InlineCodeEditor for backward compatibility
export { InlineCodeEditor } from "@/components/LiteChat/common/CodeEditor";

interface EditCodeBlockControlProps {
  interactionId?: string;
  codeBlockId?: string;
  language?: string;
  originalContent: string;
  editedContent: string;
  filepath?: string;
  disabled?: boolean;
  onEditModeChange?: (isEditing: boolean) => void;
}

export const EditCodeBlockControl: React.FC<EditCodeBlockControlProps> = ({
  interactionId,
  codeBlockId,
  language,
  originalContent,
  editedContent,
  filepath,
  disabled,
  onEditModeChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Mark as codeblock button interaction to prevent scroll interference
    const viewport = document.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (viewport) {
      (viewport as any)._isCodeblockButtonInteraction = true;
      setTimeout(() => {
        (viewport as any)._isCodeblockButtonInteraction = false;
      }, 100);
    }
    
    if (disabled || !originalContent || !interactionId || !codeBlockId) {
      toast.info("Code editing is currently disabled.");
      return;
    }
    
    setIsEditing(true);
    onEditModeChange?.(true);
  }, [disabled, originalContent, interactionId, codeBlockId, onEditModeChange]);

  const handleSave = useCallback(() => {
    if (!interactionId || !codeBlockId) {
      toast.error("Missing interaction or code block ID");
      return;
    }

    if (editedContent.trim() === "") {
      toast.error("Code cannot be empty");
      return;
    }

    // Emit event to handle the code block edit
    emitter.emit(canvasEvent.editCodeBlockRequest, {
      interactionId,
      codeBlockId,
      language,
      filepath,
      originalContent: originalContent,
      newContent: editedContent
    });

    setIsEditing(false);
    onEditModeChange?.(false);
    toast.success("Code block edited successfully");
  }, [interactionId, codeBlockId, language, filepath, originalContent, editedContent, onEditModeChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    onEditModeChange?.(false);
  }, [onEditModeChange]);



  // Only show edit button if there's substantial code content
  const shouldShow = originalContent && originalContent.trim().length > 0 && interactionId && codeBlockId;
  
  if (!shouldShow) {
    return null;
  }

  // If editing, return the editor controls
  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          onClick={handleSave}
          className="h-6 px-2 text-xs"
        >
          <SaveIcon className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          className="h-6 px-2 text-xs"
        >
          <XIcon className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    );
  }

  // If not editing, return the edit button
  return (
    <ActionTooltipButton
      tooltipText="Edit Code"
      onClick={handleStartEdit}
      aria-label="Edit code block"
      disabled={disabled || !originalContent || !interactionId || !codeBlockId}
      icon={<NotebookPenIcon />}
      iconClassName="h-3.5 w-3.5"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      tabIndex={-1}
    />
  );
};

 