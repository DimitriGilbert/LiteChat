// src/controls/components/provider-settings/GlobalModelOrganizer.tsx
// FULL FILE
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SearchIcon,
  FilterIcon,
  BrainCircuitIcon,
  WrenchIcon,
  ImageIcon,
} from "lucide-react";
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
import type {
  ModelListItem,
  DbProviderConfig,
} from "@/types/litechat/provider";
import { combineModelId } from "@/lib/litechat/provider-helpers";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { cn } from "@/lib/utils";

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
  const [providerFilterOpen, setProviderFilterOpen] = useState(false);
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

  const isAnyFilterActive =
    filterText.trim().length > 0 ||
    selectedProviders.size !== dbProviderConfigs.length ||
    Object.values(capabilityFilters).some(Boolean);

  const sortableItemIdsForDisplay = useMemo(
    () => filteredAndOrderedModelsForDisplay.map((m: ModelListItem) => m.id),
    [filteredAndOrderedModelsForDisplay]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        // Operate on the full `enabledAndOrderedModels` list for reordering
        const currentFullOrderIds = enabledAndOrderedModels.map((m) => m.id);
        const activeId = active.id as string;
        const overId = over.id as string;

        const oldIndexInFullList = currentFullOrderIds.indexOf(activeId);
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
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleProviderFilterChange = useCallback(
    (providerId: string, checked: boolean) => {
      setSelectedProviders((prev) => {
        const next = new Set(prev);
        if (checked) next.add(providerId);
        else next.delete(providerId);
        return next;
      });
    },
    []
  );

  const toggleCapabilityFilter = (filter: CapabilityFilter) => {
    setCapabilityFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  const activeProviderFilterCount =
    selectedProviders.size !== dbProviderConfigs.length ? 1 : 0;
  const activeCapabilityFilterCount =
    Object.values(capabilityFilters).filter(Boolean).length;
  const totalActiveFilters =
    activeProviderFilterCount + activeCapabilityFilterCount;

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
          <Popover
            open={providerFilterOpen}
            onOpenChange={setProviderFilterOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 relative"
                disabled={isLoading || dbProviderConfigs.length === 0}
              >
                <FilterIcon className="h-4 w-4 mr-1" />
                Filters
                {totalActiveFilters > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-primary rounded-full">
                    {totalActiveFilters}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0">
              <div className="p-2 space-y-3">
                <div>
                  <Label className="text-xs px-2 font-semibold block mb-1">
                    Providers
                  </Label>
                  <ScrollArea className="h-32 border rounded-md p-1">
                    {dbProviderConfigs.map((provider: DbProviderConfig) => (
                      <div
                        key={provider.id}
                        className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted"
                      >
                        <Checkbox
                          id={`organizer-provider-filter-${provider.id}`}
                          checked={selectedProviders.has(provider.id)}
                          onCheckedChange={(checked) =>
                            handleProviderFilterChange(provider.id, !!checked)
                          }
                        />
                        <Label
                          htmlFor={`organizer-provider-filter-${provider.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {provider.name} ({provider.type})
                        </Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                <div>
                  <Label className="text-xs px-2 font-semibold block mb-1">
                    Capabilities
                  </Label>
                  <div className="flex flex-wrap gap-1 p-1 border rounded-md">
                    <ActionTooltipButton
                      tooltipText="Reasoning"
                      icon={<BrainCircuitIcon />}
                      onClick={() => toggleCapabilityFilter("reasoning")}
                      variant={
                        capabilityFilters.reasoning ? "secondary" : "outline"
                      }
                      className={cn(
                        "h-7 w-auto px-2 text-xs",
                        capabilityFilters.reasoning && "text-primary"
                      )}
                    >
                      Reasoning
                    </ActionTooltipButton>
                    <ActionTooltipButton
                      tooltipText="Web Search"
                      icon={<SearchIcon />}
                      onClick={() => toggleCapabilityFilter("webSearch")}
                      variant={
                        capabilityFilters.webSearch ? "secondary" : "outline"
                      }
                      className={cn(
                        "h-7 w-auto px-2 text-xs",
                        capabilityFilters.webSearch && "text-primary"
                      )}
                    >
                      Web
                    </ActionTooltipButton>
                    <ActionTooltipButton
                      tooltipText="Tools"
                      icon={<WrenchIcon />}
                      onClick={() => toggleCapabilityFilter("tools")}
                      variant={
                        capabilityFilters.tools ? "secondary" : "outline"
                      }
                      className={cn(
                        "h-7 w-auto px-2 text-xs",
                        capabilityFilters.tools && "text-primary"
                      )}
                    >
                      Tools
                    </ActionTooltipButton>
                    <ActionTooltipButton
                      tooltipText="Multimodal"
                      icon={<ImageIcon />}
                      onClick={() => toggleCapabilityFilter("multimodal")}
                      variant={
                        capabilityFilters.multimodal ? "secondary" : "outline"
                      }
                      className={cn(
                        "h-7 w-auto px-2 text-xs",
                        capabilityFilters.multimodal && "text-primary"
                      )}
                    >
                      Multimodal
                    </ActionTooltipButton>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <ScrollArea className="h-[calc(20*2.75rem+2px)] w-full rounded-md border border-border p-3 bg-background/50">
          {filteredAndOrderedModelsForDisplay.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableItemIdsForDisplay} // Use IDs of filtered items for SortableContext
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
                          // Check against full list for button state
                          (m: ModelListItem) => m.id === model.id
                        ) === 0
                      }
                      isLast={
                        enabledAndOrderedModels.findIndex(
                          // Check against full list for button state
                          (m: ModelListItem) => m.id === model.id
                        ) ===
                        enabledAndOrderedModels.length - 1
                      }
                      buttonsDisabled={isAnyFilterActive}
                    />
                  )
                )}
              </SortableContext>
            </DndContext>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {isAnyFilterActive
                ? "No models match your filters."
                : "No models enabled globally. Enable models within provider configurations."}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
