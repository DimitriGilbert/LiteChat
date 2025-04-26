// src/components/LiteChat/settings/SortableModelItem.tsx
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes} // Apply attributes to the main div
      {...listeners} // Apply listeners to the main div
      className={cn(
        "flex items-center space-x-2 p-2 rounded border border-transparent bg-muted/50 hover:bg-muted mb-1", // Adjusted padding/bg
        isDragging && "shadow-lg border-primary bg-card", // Style when dragging
        !disabled && "cursor-grab active:cursor-grabbing", // Cursor styles
        disabled && "cursor-not-allowed opacity-50",
      )}
      aria-label={`Drag to reorder model ${name}`}
    >
      <GripVerticalIcon
        className={cn(
          "h-5 w-5 text-muted-foreground flex-shrink-0", // Slightly larger icon
          !disabled && "hover:text-foreground",
        )}
      />
      <Label
        className={cn(
          "text-sm font-normal text-foreground flex-grow truncate pointer-events-none", // Prevent label interfering with drag
        )}
      >
        {name || id}
      </Label>
    </div>
  );
};
