// src/components/LiteChat/prompt/control/GlobalModelSelector.tsx
// FULL FILE
import React, { useMemo, useState, useCallback } from "react";
import {
  Check,
  ChevronsUpDown,
  BrainCircuitIcon,
  SearchIcon as SearchIconLucide,
  WrenchIcon,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Skeleton } from "@/components/ui/skeleton";
// Import ModelListItem
import type { ModelListItem } from "@/types/litechat/provider";
import { combineModelId } from "@/lib/litechat/provider-helpers";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";

interface GlobalModelSelectorProps {
  /** The effective model ID for the current context */
  value: string | null;
  /** Callback to update the GLOBAL default model selection */
  onChange: (value: string | null) => void;
  /** Optional flag to disable the selector */
  disabled?: boolean;
  /** Optional className for the trigger */
  className?: string;
}

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";

export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> =
  React.memo(({ value, onChange, disabled = false, className }) => {
    const [open, setOpen] = useState(false);
    const [filterText, setFilterText] = useState("");
    // State for capability filters
    const [capabilityFilters, setCapabilityFilters] = useState<
      Record<CapabilityFilter, boolean>
    >({
      reasoning: false,
      webSearch: false,
      tools: false,
      multimodal: false,
    });

    const {
      dbProviderConfigs,
      globalModelSortOrder,
      isLoading,
      // Use the new selector
      getAvailableModelListItems,
    } = useProviderStore(
      useShallow((state) => ({
        dbProviderConfigs: state.dbProviderConfigs,
        globalModelSortOrder: state.globalModelSortOrder,
        isLoading: state.isLoading,
        // Use the new selector
        getAvailableModelListItems: state.getAvailableModelListItems,
      })),
    );

    const orderedModels: ModelListItem[] = useMemo(() => {
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

      const sorted: ModelListItem[] = [];
      const added = new Set<string>();

      // Use globalModelSortOrder (which contains combined IDs)
      globalModelSortOrder.forEach((id) => {
        if (globallyEnabledCombinedIds.has(id)) {
          const details = modelItemsMap.get(id);
          if (details && !added.has(id)) {
            sorted.push(details);
            added.add(id);
          }
        }
      });

      // Add any remaining enabled models not in the sort order yet
      globallyEnabledModels.forEach((item) => {
        if (!added.has(item.id)) {
          sorted.push(item);
        }
      });

      return sorted;
    }, [dbProviderConfigs, globalModelSortOrder, getAvailableModelListItems]);

    const filteredModels = useMemo(() => {
      // 1. Filter by text
      let textFiltered = orderedModels;
      if (filterText.trim()) {
        const lowerFilter = filterText.toLowerCase();
        textFiltered = orderedModels.filter(
          (model) =>
            model.name.toLowerCase().includes(lowerFilter) ||
            model.providerName.toLowerCase().includes(lowerFilter) ||
            model.id.toLowerCase().includes(lowerFilter),
        );
      }

      // 2. Filter by active capabilities
      const activeFilters = Object.entries(capabilityFilters)
        .filter(([, isActive]) => isActive)
        .map(([key]) => key as CapabilityFilter);

      if (activeFilters.length === 0) {
        return textFiltered;
      }

      return textFiltered.filter((model) => {
        // Use metadataSummary for filtering
        const supportedParams = new Set(
          model.metadataSummary?.supported_parameters ?? [],
        );
        const inputModalities = new Set(
          model.metadataSummary?.input_modalities ?? [],
        );

        return activeFilters.every((filter) => {
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
              // Check if any input modality is NOT 'text'
              return Array.from(inputModalities).some((mod) => mod !== "text");
            default:
              return true;
          }
        });
      });
    }, [orderedModels, filterText, capabilityFilters]);

    const selectedModelDetails = useMemo(() => {
      return orderedModels.find((m) => m.id === value);
    }, [orderedModels, value]);

    const handleSelect = useCallback(
      (currentValue: string) => {
        const newValue = currentValue === value ? null : currentValue;
        onChange(newValue);
        setOpen(false);
        setFilterText("");
        // Optionally reset capability filters on select? Decided against for now.
        // setCapabilityFilters({ reasoning: false, webSearch: false, tools: false, multimodal: false });
      },
      [onChange, value],
    );

    const toggleCapabilityFilter = (filter: CapabilityFilter) => {
      setCapabilityFilters((prev) => ({
        ...prev,
        [filter]: !prev[filter],
      }));
    };

    if (isLoading) {
      return <Skeleton className={cn("h-9 w-[250px]", className)} />;
    }

    const activeFilterCount =
      Object.values(capabilityFilters).filter(Boolean).length;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || orderedModels.length === 0}
            className={cn(
              "w-auto justify-between h-9 text-sm font-normal",
              className,
            )}
          >
            <span className="truncate max-w-[200px] sm:max-w-[300px]">
              {selectedModelDetails
                ? `${selectedModelDetails.name} (${selectedModelDetails.providerName})`
                : "Select Model..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] max-h-[--radix-popover-content-available-height] p-0">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <SearchIconLucide className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <CommandInput
                placeholder="Search model..."
                value={filterText}
                onValueChange={setFilterText}
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              {/* Capability Filter Buttons */}
              <div className="flex items-center gap-0.5 ml-auto pl-2">
                <ActionTooltipButton
                  tooltipText="Filter: Reasoning"
                  icon={<BrainCircuitIcon />}
                  onClick={() => toggleCapabilityFilter("reasoning")}
                  variant={capabilityFilters.reasoning ? "secondary" : "ghost"}
                  className={cn(
                    "h-7 w-7",
                    capabilityFilters.reasoning && "text-primary",
                  )}
                  aria-label="Filter by reasoning capability"
                />
                <ActionTooltipButton
                  tooltipText="Filter: Web Search"
                  icon={<SearchIconLucide />}
                  onClick={() => toggleCapabilityFilter("webSearch")}
                  variant={capabilityFilters.webSearch ? "secondary" : "ghost"}
                  className={cn(
                    "h-7 w-7",
                    capabilityFilters.webSearch && "text-primary",
                  )}
                  aria-label="Filter by web search capability"
                />
                <ActionTooltipButton
                  tooltipText="Filter: Tools"
                  icon={<WrenchIcon />}
                  onClick={() => toggleCapabilityFilter("tools")}
                  variant={capabilityFilters.tools ? "secondary" : "ghost"}
                  className={cn(
                    "h-7 w-7",
                    capabilityFilters.tools && "text-primary",
                  )}
                  aria-label="Filter by tool usage capability"
                />
                <ActionTooltipButton
                  tooltipText="Filter: Multimodal"
                  icon={<ImageIcon />}
                  onClick={() => toggleCapabilityFilter("multimodal")}
                  variant={capabilityFilters.multimodal ? "secondary" : "ghost"}
                  className={cn(
                    "h-7 w-7",
                    capabilityFilters.multimodal && "text-primary",
                  )}
                  aria-label="Filter by multimodal capability"
                />
              </div>
            </div>
            <CommandList>
              <CommandEmpty>
                {activeFilterCount > 0
                  ? "No models match all active filters."
                  : "No model found."}
              </CommandEmpty>
              <CommandGroup>
                {filteredModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id} // Use combined ID as value
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === model.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">
                      {model.name} ({model.providerName})
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  });
GlobalModelSelector.displayName = "GlobalModelSelector";
