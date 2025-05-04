// src/components/LiteChat/canvas/interaction/CardActions.tsx

import React from "react";
import { RefreshCwIcon, Trash2Icon, EditIcon } from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

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
      className="absolute bottom-2 right-2 flex items-center space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200
                 bg-card/80 backdrop-blur-sm p-1 rounded-md shadow-md z-20"
    >
      {onEdit && (
        <ActionTooltipButton
          tooltipText="Edit"
          onClick={handleEdit}
          aria-label="Edit User Prompt"
          icon={<EditIcon />}
          className="h-6 w-6"
        />
      )}
      {onRegenerate && (
        <ActionTooltipButton
          tooltipText="Regenerate"
          onClick={handleRegenerate}
          aria-label="Regenerate Response"
          icon={<RefreshCwIcon />}
          className="h-6 w-6"
        />
      )}
      {onDelete && (
        <ActionTooltipButton
          tooltipText="Delete"
          onClick={handleDelete}
          aria-label="Delete Interaction"
          icon={<Trash2Icon />}
          className="h-6 w-6 text-destructive hover:text-destructive/80"
        />
      )}
    </div>
  );
};
