// src/components/LiteChat/settings/GlobalModelOrganizer.tsx
import React, { useCallback, useMemo, useState } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchIcon } from "lucide-react";
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
  // Select underlying data and the selector function
  const {
    setGlobalModelSortOrder,
    getGloballyEnabledAndOrderedModels, // Select the function
    dbProviderConfigs, // Select underlying data
    globalModelSortOrder, // Select underlying data
    isLoading,
  } = useProviderStore(
    useShallow((state) => ({
      setGlobalModelSortOrder: state.setGlobalModelSortOrder,
      getGloballyEnabledAndOrderedModels:
        state.getGloballyEnabledAndOrderedModels, // The selector function
      // Select the state the selector depends on
      dbProviderConfigs: state.dbProviderConfigs,
      globalModelSortOrder: state.globalModelSortOrder,
      isLoading: state.isLoading,
    })),
  );

  const [filterText, setFilterText] = useState("");

  // Call the selector outside the hook and memoize its result
  const enabledAndOrderedModels = useMemo(() => {
    return getGloballyEnabledAndOrderedModels
      ? getGloballyEnabledAndOrderedModels()
      : [];
  }, [
    // not an error, needed to update and prevent render loop from hell
    getGloballyEnabledAndOrderedModels,
    dbProviderConfigs,
    globalModelSortOrder,
  ]);

  // Filter the models based on filterText
  const filteredAndOrderedModels = useMemo(() => {
    if (!filterText.trim()) {
      return enabledAndOrderedModels; // Use the memoized result
    }
    const lowerCaseFilter = filterText.toLowerCase();
    return enabledAndOrderedModels.filter(
      (model) =>
        model.name.toLowerCase().includes(lowerCaseFilter) ||
        model.providerName.toLowerCase().includes(lowerCaseFilter) ||
        model.id.toLowerCase().includes(lowerCaseFilter),
    );
  }, [enabledAndOrderedModels, filterText]); // Depend on the memoized result

  // The IDs for SortableContext are derived from the *filtered* models
  const orderedCombinedIds = useMemo(
    () => filteredAndOrderedModels.map((m) => m.id),
    [filteredAndOrderedModels],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        // Get the *current* full order directly from the memoized result
        const currentFullOrder = enabledAndOrderedModels.map((m) => m.id);

        const activeId = active.id as string;
        const overId = over.id as string;

        // Find indices in the full, unfiltered list
        const oldIndexInFull = currentFullOrder.indexOf(activeId);
        const newIndexInFull = currentFullOrder.indexOf(overId);

        if (oldIndexInFull !== -1 && newIndexInFull !== -1) {
          const newOrder = arrayMove(
            currentFullOrder,
            oldIndexInFull,
            newIndexInFull,
          );
          // This call will update the store, triggering a re-render
          // because globalModelSortOrder changes, which updates enabledAndOrderedModels
          setGlobalModelSortOrder(newOrder);
        } else {
          console.error(
            "Failed to find dragged items in the full model order. Cannot reorder.",
          );
        }
      }
    },
    [enabledAndOrderedModels, setGlobalModelSortOrder], // Depend on the memoized data
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
        define their display order in the chat input selector. Filtering only
        affects the view below, not the actual order saved.
      </p>
      <Separator />
      <div className="space-y-3">
        <Label className="text-base font-medium text-card-foreground">
          Enabled & Ordered Models
        </Label>

        {/* Filter Input */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter models by name or provider..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="pl-8 w-full"
            disabled={isLoading}
          />
        </div>

        <ScrollArea className="h-80 w-full rounded-md border border-border p-3 bg-background/50">
          {filteredAndOrderedModels.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedCombinedIds} // Use IDs from the filtered list
                strategy={verticalListSortingStrategy}
              >
                {/* Render based on the filtered models */}
                {filteredAndOrderedModels.map((model) => (
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
              {filterText.trim()
                ? "No models match your filter."
                : "No models enabled globally. Enable models within provider configurations below."}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
