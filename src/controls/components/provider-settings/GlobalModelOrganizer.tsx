// src/controls/components/provider-settings/GlobalModelOrganizer.tsx
// FULL FILE
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableModelItem } from "@/components/LiteChat/common/SortableModelItem";
import type { ModelListItem } from "@/types/litechat/provider";
import { combineModelId } from "@/lib/litechat/provider-helpers";
import { ModelFilterControls } from "@/controls/components/common/ModelFilterControls";

interface GlobalModelOrganizerProps {
  // Props passed by ProviderSettingsModule
  // These are now primarily for the setGlobalModelSortOrderFromModule
  // The component will fetch its own display data from the store.
  setGlobalModelSortOrderFromModule: (ids: string[]) => void;
}

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";

export const GlobalModelOrganizer: React.FC<GlobalModelOrganizerProps> = ({
  setGlobalModelSortOrderFromModule,
}) => {
  const {
    dbProviderConfigs,
    globalModelSortOrder,
    isLoading,
    getAvailableModelListItems,
  } = useProviderStore(
    useShallow((state) => ({
      dbProviderConfigs: state.dbProviderConfigs,
      globalModelSortOrder: state.globalModelSortOrder,
      isLoading: state.isLoading,
      getAvailableModelListItems: state.getAvailableModelListItems,
    }))
  );

  const [filterText, setFilterText] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    () => new Set(dbProviderConfigs.map((p) => p.id))
  );
  const [capabilityFilters, setCapabilityFilters] = useState<
    Record<CapabilityFilter, boolean>
  >({
    reasoning: false,
    webSearch: false,
    tools: false,
    multimodal: false,
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedProviders(new Set(dbProviderConfigs.map((p) => p.id)));
  }, [dbProviderConfigs]);

  const enabledAndOrderedModels = useMemo(() => {
    const allModelListItems = getAvailableModelListItems();
    const modelItemsMap = new Map(allModelListItems.map((m) => [m.id, m]));
    const globallyEnabledCombinedIds = new Set<string>();
    dbProviderConfigs.forEach((config) => {
      if (config.isEnabled && config.enabledModels) {
        config.enabledModels.forEach((modelId) => {
          globallyEnabledCombinedIds.add(combineModelId(config.id, modelId));
        });
      }
    });
    const globallyEnabledModels = allModelListItems.filter((item) =>
      globallyEnabledCombinedIds.has(item.id)
    );
    const sortedModels: ModelListItem[] = [];
    const addedIds = new Set<string>();
    globalModelSortOrder.forEach((combinedId) => {
      if (globallyEnabledCombinedIds.has(combinedId)) {
        const details = modelItemsMap.get(combinedId);
        if (details && !addedIds.has(combinedId)) {
          sortedModels.push(details);
          addedIds.add(combinedId);
        }
      }
    });
    globallyEnabledModels.forEach((item) => {
      if (!addedIds.has(item.id)) {
        sortedModels.push(item);
      }
    });
    return sortedModels;
  }, [dbProviderConfigs, globalModelSortOrder, getAvailableModelListItems]);

  const filteredAndOrderedModelsForDisplay = useMemo(() => {
    let models = enabledAndOrderedModels;
    if (selectedProviders.size !== dbProviderConfigs.length) {
      models = models.filter((model) =>
        selectedProviders.has(model.providerId)
      );
    }
    if (filterText.trim()) {
      const lowerCaseFilter = filterText.toLowerCase();
      models = models.filter(
        (model) =>
          model.name.toLowerCase().includes(lowerCaseFilter) ||
          model.providerName.toLowerCase().includes(lowerCaseFilter) ||
          model.id.toLowerCase().includes(lowerCaseFilter)
      );
    }
    const activeCapabilityFilters = Object.entries(capabilityFilters)
      .filter(([, isActive]) => isActive)
      .map(([key]) => key as CapabilityFilter);
    if (activeCapabilityFilters.length > 0) {
      models = models.filter((model: ModelListItem) => {
        const supportedParams = new Set(
          model.metadataSummary?.supported_parameters ?? []
        );
        const inputModalities = new Set(
          model.metadataSummary?.input_modalities ?? []
        );
        return activeCapabilityFilters.every((filter) => {
          switch (filter) {
            case "reasoning":
              return supportedParams.has("reasoning");
            case "webSearch":
              return (
                supportedParams.has("web_search") ||
                supportedParams.has("web_search_options")
              );
            case "tools":
              return supportedParams.has("tools");
            case "multimodal":
              return Array.from(inputModalities).some((mod) => mod !== "text");
            default:
              return true;
          }
        });
      });
    }
    return models;
  }, [
    enabledAndOrderedModels,
    filterText,
    selectedProviders,
    dbProviderConfigs.length,
    capabilityFilters,
  ]);

  const isAnyFilterActive = useMemo(() => (
    filterText.trim().length > 0 ||
    selectedProviders.size !== dbProviderConfigs.length ||
    Object.values(capabilityFilters).some(Boolean)
  ), [filterText, selectedProviders, dbProviderConfigs.length, capabilityFilters]);

  const totalActiveFilters = useMemo(() => {
    const activeProviderFilterCount = selectedProviders.size !== dbProviderConfigs.length ? 1 : 0;
    const activeCapabilityFilterCount = Object.values(capabilityFilters).filter(Boolean).length;
    return activeProviderFilterCount + activeCapabilityFilterCount;
  }, [selectedProviders, dbProviderConfigs.length, capabilityFilters]);

  const sortableItemIdsForDisplay = useMemo(
    () => filteredAndOrderedModelsForDisplay.map((m: ModelListItem) => m.id),
    [filteredAndOrderedModelsForDisplay]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        // Operate on the full `enabledAndOrderedModels` list for reordering
        const currentFullOrderIds = enabledAndOrderedModels.map((m) => m.id);
        const draggedId = active.id as string;
        const overId = over.id as string;

        const oldIndexInFullList = currentFullOrderIds.indexOf(draggedId);
        const newIndexInFullList = currentFullOrderIds.indexOf(overId);

        if (oldIndexInFullList !== -1 && newIndexInFullList !== -1) {
          const newFullOrder = arrayMove(
            currentFullOrderIds,
            oldIndexInFullList,
            newIndexInFullList
          );
          setGlobalModelSortOrderFromModule(newFullOrder);
        } else {
          console.warn(
            "DND: Could not find dragged items in the full model order. This might happen if the underlying list changed during drag or items are filtered out."
          );
        }
      }
      setActiveId(null);
    },
    [enabledAndOrderedModels, setGlobalModelSortOrderFromModule]
  );

  const handleMove = useCallback(
    (modelId: string, direction: "top" | "up" | "down") => {
      if (isAnyFilterActive) return; // Buttons are disabled if filters are active

      const currentFullOrderIds = enabledAndOrderedModels.map(
        (m: ModelListItem) => m.id
      );
      const currentIndex = currentFullOrderIds.indexOf(modelId);

      if (currentIndex === -1) return;

      let newOrder;
      if (direction === "top") {
        if (currentIndex === 0) return;
        const item = currentFullOrderIds.splice(currentIndex, 1)[0];
        currentFullOrderIds.unshift(item);
        newOrder = currentFullOrderIds;
      } else if (direction === "up") {
        if (currentIndex === 0) return;
        newOrder = arrayMove(
          currentFullOrderIds,
          currentIndex,
          currentIndex - 1
        );
      } else {
        // down
        if (currentIndex === currentFullOrderIds.length - 1) return;
        newOrder = arrayMove(
          currentFullOrderIds,
          currentIndex,
          currentIndex + 1
        );
      }
      setGlobalModelSortOrderFromModule(newOrder);
    },
    [
      enabledAndOrderedModels,
      setGlobalModelSortOrderFromModule,
      isAnyFilterActive,
    ]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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
        Drag and drop the globally enabled models to define their display order.
        Filtering affects the view below. Move buttons (up/down/top) are
        disabled when filters are active.
      </p>
      <Separator />
      <div className="space-y-3">
        <Label className="text-base font-medium text-card-foreground">
          Enabled & Ordered Models
        </Label>

        <div className="flex items-center gap-2">
          <div className="relative flex-grow">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Filter models by name or provider..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-8 w-full h-9"
              disabled={isLoading}
            />
          </div>
          <ModelFilterControls
            currentCapabilityFilters={capabilityFilters}
            onCapabilityFilterChange={setCapabilityFilters}
            currentSelectedProviders={selectedProviders}
            onProviderFilterChange={setSelectedProviders}
            allProviders={dbProviderConfigs}
            showProviderFilter={true}
            showCapabilityFilters={true}
            disabled={isLoading || dbProviderConfigs.length === 0}
            totalActiveFilters={totalActiveFilters}
          />
        </div>

        <div className="w-full rounded-md border border-border p-3 bg-background/50">
          {filteredAndOrderedModelsForDisplay.length > 0 ? (
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                modifiers={[]}
              >
              <SortableContext
                items={sortableItemIdsForDisplay}
                strategy={verticalListSortingStrategy}
              >
                {filteredAndOrderedModelsForDisplay.map(
                  (model: ModelListItem) => (
                    <SortableModelItem
                      key={model.id}
                      id={model.id}
                      modelDetails={model}
                      onMoveToTop={() => handleMove(model.id, "top")}
                      onMoveUp={() => handleMove(model.id, "up")}
                      onMoveDown={() => handleMove(model.id, "down")}
                      isFirst={
                        enabledAndOrderedModels.findIndex(
                          (m: ModelListItem) => m.id === model.id
                        ) === 0
                      }
                      isLast={
                        enabledAndOrderedModels.findIndex(
                          (m: ModelListItem) => m.id === model.id
                        ) ===
                        enabledAndOrderedModels.length - 1
                      }
                      buttonsDisabled={isAnyFilterActive}
                    />
                  )
                )}
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activeId ? (
                  <SortableModelItem
                    id={activeId}
                    modelDetails={filteredAndOrderedModelsForDisplay.find(m => m.id === activeId)!}
                    onMoveToTop={() => {}}
                    onMoveUp={() => {}}
                    onMoveDown={() => {}}
                    isFirst={false}
                    isLast={false}
                    buttonsDisabled={true}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {isAnyFilterActive
                ? "No models match your filters."
                : "No models enabled globally. Enable models within provider configurations."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
