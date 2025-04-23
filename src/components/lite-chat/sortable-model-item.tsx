
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { Label } from "@/components/ui/label";

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
    zIndex: isDragging ? 10 : undefined, // Ensure dragging item is on top
    cursor: disabled ? "not-allowed" : "grab",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-2 p-1 rounded bg-gray-700 hover:bg-gray-600 mb-1"
    >
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        className={`p-1 text-gray-400 ${!disabled ? "hover:text-white cursor-grab active:cursor-grabbing" : "cursor-not-allowed"}`}
        aria-label="Drag to reorder model"
      >
        <GripVerticalIcon className="h-4 w-4" />
      </button>
      <Label className="text-sm font-normal text-white flex-grow truncate">
        {name || id}
      </Label>
    </div>
  );
};
