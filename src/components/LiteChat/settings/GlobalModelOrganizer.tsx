// src/components/LiteChat/settings/GlobalModelOrganizer.tsx
import React, { useCallback, useMemo } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableModelItem } from "@/components/LiteChat/settings/SortableModelItem";

export const GlobalModelOrganizer: React.FC = () => {
  const {
    globalModelSortOrder,
    setGlobalModelSortOrder,
    getGloballyEnabledAndOrderedModels,
    isLoading,
    // Add dbProviderConfigs to dependencies for reactivity
    dbProviderConfigs,
  } = useProviderStore(
    useShallow((state) => ({
      globalModelSortOrder: state.globalModelSortOrder,
      setGlobalModelSortOrder: state.setGlobalModelSortOrder,
      getGloballyEnabledAndOrderedModels:
        state.getGloballyEnabledAndOrderedModels,
      isLoading: state.isLoading,
      // Select dbProviderConfigs to trigger re-calculation when it changes
      dbProviderConfigs: state.dbProviderConfigs,
    })),
  );

  // Get the models already enabled and ordered by the store selector
  // This memo now correctly depends on the underlying data
  const enabledAndOrderedModels = useMemo(
    () =>
      getGloballyEnabledAndOrderedModels
        ? getGloballyEnabledAndOrderedModels()
        : [],
    // Depend on the actual data that the selector uses
    [
      getGloballyEnabledAndOrderedModels,
      dbProviderConfigs,
      globalModelSortOrder,
    ],
  );

  // The IDs for SortableContext are derived from the already ordered models
  const orderedCombinedIds = useMemo(
    () => enabledAndOrderedModels.map((m) => m.id),
    [enabledAndOrderedModels],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = globalModelSortOrder.indexOf(active.id as string);
        const newIndex = globalModelSortOrder.indexOf(over.id as string);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(globalModelSortOrder, oldIndex, newIndex);
          // Update the state, which will trigger re-render and useMemo recalculation
          setGlobalModelSortOrder(newOrder);
        } else {
          console.warn(
            "Dragged item indices not found in current globalModelSortOrder state. Using displayed order as base.",
          );
          const displayOrderIds = enabledAndOrderedModels.map((m) => m.id);
          const displayOldIndex = displayOrderIds.indexOf(active.id as string);
          const displayNewIndex = displayOrderIds.indexOf(over.id as string);
          if (displayOldIndex !== -1 && displayNewIndex !== -1) {
            const newOrder = arrayMove(
              displayOrderIds,
              displayOldIndex,
              displayNewIndex,
            );
            setGlobalModelSortOrder(newOrder);
          } else {
            console.error(
              "Failed to calculate new order even from displayed items.",
            );
          }
        }
      }
    },
    [globalModelSortOrder, enabledAndOrderedModels, setGlobalModelSortOrder],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (isLoading) {
    return (
      <div className="space-y-4 border border-border rounded-lg p-4 bg-card shadow-sm">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 border border-border rounded-lg p-4 bg-card shadow-sm">
      <h3 className="text-lg font-semibold text-card-foreground">
        Global Model Order
      </h3>
      <p className="text-sm text-muted-foreground">
        Drag and drop the globally enabled models (set per provider below) to
        define their display order in the chat input selector.
      </p>
      <Separator />
      <div className="space-y-3">
        <Label className="text-base font-medium text-card-foreground">
          Enabled & Ordered Models
        </Label>
        <ScrollArea className="h-80 w-full rounded-md border border-border p-3 bg-background/50">
          {enabledAndOrderedModels.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedCombinedIds} // Use IDs from the ordered list
                strategy={verticalListSortingStrategy}
              >
                {/* Render based on the reactive enabledAndOrderedModels */}
                {enabledAndOrderedModels.map((model) => (
                  <SortableModelItem
                    key={model.id}
                    id={model.id}
                    name={`${model.name} (${model.providerName})`}
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No models enabled globally. Enable models within provider
              configurations below.
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
