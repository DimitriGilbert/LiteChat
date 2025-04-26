// src/components/LiteChat/settings/SortableModelItem.tsx
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils"; // Import cn

interface SortableModelItemProps {
  id: string;
  name: string;
  disabled?: boolean;
}

export const SortableModelItem: React.FC<SortableModelItemProps> = ({
  id,
  name,
  disabled,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id, disabled: disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    cursor: disabled ? "not-allowed" : "grab",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Use cn for conditional styling
      className={cn(
        "flex items-center space-x-2 p-1 rounded bg-muted/50 hover:bg-muted mb-1",
        isDragging && "shadow-lg", // Add shadow when dragging
      )}
    >
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        className={cn(
          "p-1 text-muted-foreground",
          !disabled &&
            "hover:text-foreground cursor-grab active:cursor-grabbing",
          disabled && "cursor-not-allowed",
        )}
        aria-label="Drag to reorder model"
      >
        <GripVerticalIcon className="h-4 w-4" />
      </button>
      <Label className="text-sm font-normal text-foreground flex-grow truncate">
        {name || id}
      </Label>
    </div>
  );
};
