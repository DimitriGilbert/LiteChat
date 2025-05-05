// src/components/LiteChat/canvas/interaction/CardActions.tsx
// FULL FILE - Adjusted positioning for mobile
import React from "react";
import { RefreshCwIcon, Trash2Icon, EditIcon } from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { cn } from "@/lib/utils"; // Import cn

interface CardActionsProps {
  interactionId: string;
  onRegenerate?: (interactionId: string) => void;
  onDelete?: (interactionId: string) => void;
  onEdit?: (interactionId: string) => void;
}

export const CardActions: React.FC<CardActionsProps> = ({
  interactionId,
  onRegenerate,
  onDelete,
  onEdit,
}) => {
  const handleDelete = () => {
    if (
      onDelete &&
      window.confirm("Are you sure you want to delete this interaction?")
    ) {
      onDelete(interactionId);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(interactionId);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(interactionId);
    }
  };

  return (
    <div
      className={cn(
        "absolute bottom-1 right-1 md:bottom-2 md:right-2 flex items-center space-x-0.5 md:space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200", // Adjust spacing for mobile
        "bg-card/80 backdrop-blur-sm p-0.5 md:p-1 rounded-md shadow-md z-20", // Adjust padding
      )}
    >
      {onEdit && (
        <ActionTooltipButton
          tooltipText="Edit"
          onClick={handleEdit}
          aria-label="Edit User Prompt"
          icon={<EditIcon />}
          className="h-5 w-5 md:h-6 md:w-6" // Adjust size
        />
      )}
      {onRegenerate && (
        <ActionTooltipButton
          tooltipText="Regenerate"
          onClick={handleRegenerate}
          aria-label="Regenerate Response"
          icon={<RefreshCwIcon />}
          className="h-5 w-5 md:h-6 md:w-6" // Adjust size
        />
      )}
      {onDelete && (
        <ActionTooltipButton
          tooltipText="Delete"
          onClick={handleDelete}
          aria-label="Delete Interaction"
          icon={<Trash2Icon />}
          className="h-5 w-5 md:h-6 md:w-6 text-destructive hover:text-destructive/80" // Adjust size
        />
      )}
    </div>
  );
};
