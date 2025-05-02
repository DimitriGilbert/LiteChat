// src/components/LiteChat/settings/GlobalModelOrganizer.tsx
// Line 77: Access metadata correctly

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
import type { AiModelConfig } from "@/types/litechat/provider";
import { combineModelId } from "@/lib/litechat/provider-helpers";

export const GlobalModelOrganizer: React.FC = () => {
  const {
    setGlobalModelSortOrder,
    dbProviderConfigs,
    globalModelSortOrder,
    isLoading,
    getAllAvailableModelDefsForProvider, // Get the selector
  } = useProviderStore(
    useShallow((state) => ({
      setGlobalModelSortOrder: state.setGlobalModelSortOrder,
      dbProviderConfigs: state.dbProviderConfigs,
      globalModelSortOrder: state.globalModelSortOrder,
      isLoading: state.isLoading,
      getAllAvailableModelDefsForProvider:
        state.getAllAvailableModelDefsForProvider, // Get the selector
    })),
  );

  const [filterText, setFilterText] = useState("");

  const enabledAndOrderedModels = useMemo(() => {
    const globallyEnabledModelsMap = new Map<
      string,
      Omit<AiModelConfig, "instance">
    >();
    const enabledCombinedIds = new Set<string>();

    dbProviderConfigs.forEach((config) => {
      if (!config.isEnabled || !config.enabledModels) return;

      // Use the selector to get full model definitions
      const allProviderModels = getAllAvailableModelDefsForProvider(config.id);
      const providerModelsMap = new Map(
        allProviderModels.map((m) => [m.id, m]),
      );

      config.enabledModels.forEach((modelId) => {
        const combinedId = combineModelId(config.id, modelId);
        const modelDef = providerModelsMap.get(modelId);
        if (modelDef) {
          enabledCombinedIds.add(combinedId);
          globallyEnabledModelsMap.set(combinedId, {
            id: combinedId,
            name: modelDef.name || modelId,
            providerId: config.id,
            providerName: config.name,
            metadata: modelDef, // Store the full OpenRouterModel
          });
        }
      });
    });

    const sortedModels: Omit<AiModelConfig, "instance">[] = [];
    const addedIds = new Set<string>();

    globalModelSortOrder.forEach((combinedId) => {
      if (enabledCombinedIds.has(combinedId)) {
        const details = globallyEnabledModelsMap.get(combinedId);
        if (details && !addedIds.has(combinedId)) {
          sortedModels.push(details);
          addedIds.add(combinedId);
        }
      }
    });

    const remainingEnabled = Array.from(enabledCombinedIds)
      .filter((combinedId) => !addedIds.has(combinedId))
      .map((combinedId) => globallyEnabledModelsMap.get(combinedId))
      .filter((details): details is Omit<AiModelConfig, "instance"> =>
        Boolean(details),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...sortedModels, ...remainingEnabled];
  }, [
    dbProviderConfigs,
    globalModelSortOrder,
    getAllAvailableModelDefsForProvider,
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
