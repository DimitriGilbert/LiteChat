// src/components/LiteChat/common/SortableModelItem.tsx
// FULL FILE
import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVerticalIcon,
  InfoIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronsUpIcon,
  BrainCircuitIcon,
  SearchIcon as SearchIconLucide,
  WrenchIcon,
  ImageIcon,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ModelListItem } from "@/types/litechat/provider";
import { ActionTooltipButton } from "./ActionTooltipButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SortableModelItemProps {
  id: string;
  modelDetails: ModelListItem;
  buttonsDisabled?: boolean;
  onMoveToTop: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

export const SortableModelItem: React.FC<SortableModelItemProps> = ({
  id,
  modelDetails,
  buttonsDisabled,
  onMoveToTop,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id, disabled: false });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 9999 : undefined,
    position: isDragging ? ('relative' as const) : undefined,
  };

  const supportedParams = new Set(
    modelDetails.metadataSummary?.supported_parameters ?? []
  );
  const inputModalities = new Set(
    modelDetails.metadataSummary?.input_modalities ?? []
  );
  const hasReasoning = supportedParams.has("reasoning");
  const hasWebSearch =
    supportedParams.has("web_search") ||
    supportedParams.has("web_search_options");
  const hasTools = supportedParams.has("tools");
  const isMultimodal = Array.from(inputModalities).some(
    (mod) => mod !== "text"
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center space-x-2 p-2 rounded border border-transparent bg-muted/50 hover:bg-muted mb-1",
        isDragging && "shadow-2xl border-primary bg-card opacity-75 transform scale-105",
        "cursor-grab active:cursor-grabbing"
      )}
      aria-label={`Drag to reorder model ${modelDetails.name}`}
      onMouseDown={(e) => {
        // Only prevent default if not clicking on buttons
        const target = e.target as HTMLElement;
        if (!target.closest('button')) {
          e.preventDefault();
        }
      }}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className={cn("p-1 flex-shrink-0 touch-none", "hover:text-foreground")}
        aria-hidden="true"
        tabIndex={-1}
        style={{ touchAction: 'none' }}
      >
        <GripVerticalIcon className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-grow min-w-0">
        <Label
          className={cn(
            "text-sm font-normal text-foreground flex-grow truncate pointer-events-none"
          )}
        >
          {modelDetails.name}{" "}
          <span className="text-xs text-muted-foreground">
            ({modelDetails.providerName})
          </span>
        </Label>
        <div className="flex items-center gap-1 mt-0.5">
          {hasReasoning && (
            <BrainCircuitIcon className="h-3 w-3 text-blue-500" />
          )}
          {hasWebSearch && (
            <SearchIconLucide className="h-3 w-3 text-green-500" />
          )}
          {hasTools && <WrenchIcon className="h-3 w-3 text-orange-500" />}
          {isMultimodal && <ImageIcon className="h-3 w-3 text-purple-500" />}
        </div>
      </div>
      <div className="flex items-center gap-0.5 ml-auto flex-shrink-0">
        {modelDetails.metadataSummary?.description && (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="p-1 text-muted-foreground hover:text-foreground cursor-default"
                  aria-label="Model information"
                >
                  <InfoIcon className="h-4 w-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="end"
                className="max-w-xs break-words"
              >
                <p>{modelDetails.metadataSummary.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <ActionTooltipButton
          tooltipText="Move to Top"
          onClick={() => onMoveToTop(id)}
          disabled={isFirst || buttonsDisabled}
          icon={<ChevronsUpIcon />}
          className="h-6 w-6"
        />
        <ActionTooltipButton
          tooltipText="Move Up"
          onClick={() => onMoveUp(id)}
          disabled={isFirst || buttonsDisabled}
          icon={<ArrowUpIcon />}
          className="h-6 w-6"
        />
        <ActionTooltipButton
          tooltipText="Move Down"
          onClick={() => onMoveDown(id)}
          disabled={isLast || buttonsDisabled}
          icon={<ArrowDownIcon />}
          className="h-6 w-6"
        />
      </div>
    </div>
  );
};
