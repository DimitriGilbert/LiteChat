// src/components/LiteChat/canvas/interaction/CardActions.tsx
// FULL FILE
import React from "react";
import { RefreshCwIcon, Trash2Icon, EditIcon } from "lucide-react";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { cn } from "@/lib/utils";
import { InteractionRating } from "./InteractionRating"; // Import the new component
import type { Interaction } from "@/types/litechat/interaction"; // Import Interaction type

interface CardActionsProps {
  interaction: Interaction; // Pass the full interaction object
  onRegenerate?: (interactionId: string) => void;
  onDelete?: (interactionId: string) => void;
  onEdit?: (interactionId: string) => void;
}

export const CardActions: React.FC<CardActionsProps> = ({
  interaction, // Destructure interaction
  onRegenerate,
  onDelete,
  onEdit,
}) => {
  const handleDelete = () => {
    if (
      onDelete &&
      window.confirm("Are you sure you want to delete this interaction?")
    ) {
      onDelete(interaction.id);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(interaction.id);
    }
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(interaction.id);
    }
  };

  return (
    <div
      className={cn(
        "absolute bottom-1 right-1 md:bottom-2 md:right-2 flex items-center space-x-0.5 md:space-x-1 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200",
        "bg-card/80 backdrop-blur-sm p-0.5 md:p-1 rounded-md shadow-md z-20",
      )}
    >
      {/* Add the Rating Component */}
      <InteractionRating
        interactionId={interaction.id}
        currentRating={interaction.rating}
      />

      {/* Existing Action Buttons */}
      {onEdit && (
        <ActionTooltipButton
          tooltipText="Edit"
          onClick={handleEdit}
          aria-label="Edit User Prompt"
          icon={<EditIcon />}
          className="h-5 w-5 md:h-6 md:w-6"
        />
      )}
      {onRegenerate && (
        <ActionTooltipButton
          tooltipText="Regenerate"
          onClick={handleRegenerate}
          aria-label="Regenerate Response"
          icon={<RefreshCwIcon />}
          className="h-5 w-5 md:h-6 md:w-6"
        />
      )}
      {onDelete && (
        <ActionTooltipButton
          tooltipText="Delete"
          onClick={handleDelete}
          aria-label="Delete Interaction"
          icon={<Trash2Icon />}
          className="h-5 w-5 md:h-6 md:w-6 text-destructive hover:text-destructive/80"
        />
      )}
    </div>
  );
};
