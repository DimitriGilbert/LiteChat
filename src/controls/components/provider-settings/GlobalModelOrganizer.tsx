// src/components/LiteChat/settings/GlobalModelOrganizer.tsx
// FULL FILE
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
import { SortableModelItem } from "@/components/LiteChat/common/SortableModelItem";
// Import ModelListItem
import type { ModelListItem } from "@/types/litechat/provider";
import { combineModelId } from "@/lib/litechat/provider-helpers";

export const GlobalModelOrganizer: React.FC = () => {
  const {
    setGlobalModelSortOrder,
    dbProviderConfigs,
    globalModelSortOrder,
    isLoading,
    // Use the new selector
    getAvailableModelListItems,
  } = useProviderStore(
    useShallow((state) => ({
      setGlobalModelSortOrder: state.setGlobalModelSortOrder,
      dbProviderConfigs: state.dbProviderConfigs,
      globalModelSortOrder: state.globalModelSortOrder,
      isLoading: state.isLoading,
      // Use the new selector
      getAvailableModelListItems: state.getAvailableModelListItems,
    })),
  );

  const [filterText, setFilterText] = useState("");

  const enabledAndOrderedModels = useMemo(() => {
    // Get all list items (already filtered by provider enablement implicitly by how they are constructed)
    const allModelListItems = getAvailableModelListItems();
    const modelItemsMap = new Map(allModelListItems.map((m) => [m.id, m]));

    // Filter these items based on whether they are in any provider's `enabledModels` list
    const globallyEnabledCombinedIds = new Set<string>();
    dbProviderConfigs.forEach((config) => {
      if (config.isEnabled && config.enabledModels) {
        config.enabledModels.forEach((modelId) => {
          globallyEnabledCombinedIds.add(combineModelId(config.id, modelId));
        });
      }
    });

    const globallyEnabledModels = allModelListItems.filter((item) =>
      globallyEnabledCombinedIds.has(item.id),
    );

    const sortedModels: ModelListItem[] = [];
    const addedIds = new Set<string>();

    // Use globalModelSortOrder (which contains combined IDs)
    globalModelSortOrder.forEach((combinedId) => {
      if (globallyEnabledCombinedIds.has(combinedId)) {
        const details = modelItemsMap.get(combinedId);
        if (details && !addedIds.has(combinedId)) {
          sortedModels.push(details);
          addedIds.add(combinedId);
        }
      }
    });

    // Add any remaining enabled models not in the sort order yet
    globallyEnabledModels.forEach((item) => {
      if (!addedIds.has(item.id)) {
        sortedModels.push(item);
        addedIds.add(item.id); // Should not be necessary here but good practice
      }
    });

    return sortedModels;
  }, [
    dbProviderConfigs,
    globalModelSortOrder,
    getAvailableModelListItems, // Depend on the new selector
  ]);

  const filteredAndOrderedModels = useMemo(() => {
    if (!filterText.trim()) {
      return enabledAndOrderedModels;
    }
    const lowerCaseFilter = filterText.toLowerCase();
    return enabledAndOrderedModels.filter(
      (model) =>
        model.name.toLowerCase().includes(lowerCaseFilter) ||
        model.providerName.toLowerCase().includes(lowerCaseFilter) ||
        model.id.toLowerCase().includes(lowerCaseFilter),
    );
  }, [enabledAndOrderedModels, filterText]);

  const orderedCombinedIds = useMemo(
    () => filteredAndOrderedModels.map((m) => m.id),
    [filteredAndOrderedModels],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const currentFullOrder = enabledAndOrderedModels.map((m) => m.id);
        const activeId = active.id as string;
        const overId = over.id as string;
        const oldIndexInFull = currentFullOrder.indexOf(activeId);
        const newIndexInFull = currentFullOrder.indexOf(overId);

        if (oldIndexInFull !== -1 && newIndexInFull !== -1) {
          const newOrder = arrayMove(
            currentFullOrder,
            oldIndexInFull,
            newIndexInFull,
          );
          setGlobalModelSortOrder(newOrder);
        } else {
          console.error(
            "Failed to find dragged items in the full model order. Cannot reorder.",
          );
        }
      }
    },
    [enabledAndOrderedModels, setGlobalModelSortOrder],
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
                items={orderedCombinedIds}
                strategy={verticalListSortingStrategy}
              >
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
