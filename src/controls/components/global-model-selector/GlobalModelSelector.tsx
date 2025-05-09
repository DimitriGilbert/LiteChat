// src/controls/components/global-model-selector/GlobalModelSelector.tsx
// FULL FILE
import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Check,
  ChevronsUpDown,
  BrainCircuitIcon,
  SearchIcon as SearchIconLucide,
  WrenchIcon,
  ImageIcon,
  FilterIcon,
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
import type { ModelListItem } from "@/types/litechat/provider";
import { combineModelId } from "@/lib/litechat/provider-helpers";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GlobalModelSelectorModule } from "@/controls/modules/GlobalModelSelectorModule";

interface GlobalModelSelectorProps {
  module?: GlobalModelSelectorModule; // Module is now optional
  value?: string | null; // Direct value prop
  onChange?: (newModelId: string | null) => void; // Direct onChange prop
  className?: string;
  disabled?: boolean; // Allow direct disabling
}

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";

export const GlobalModelSelector: React.FC<GlobalModelSelectorProps> =
  React.memo(
    ({
      module,
      value: directValue,
      onChange: directOnChange,
      className,
      disabled: directDisabled,
    }) => {
      const [, forceUpdate] = useState({});

      // State and handlers for module-driven mode
      useEffect(() => {
        if (module) {
          module.setNotifyCallback(() => forceUpdate({}));
          return () => module.setNotifyCallback(null);
        }
      }, [module]);

      // Determine if operating in module-driven or direct prop mode
      const isModuleDriven = !!module;

      const currentValue = isModuleDriven
        ? module.selectedModelId
        : directValue;
      const isDisabled = isModuleDriven ? module.isStreaming : directDisabled;
      const isLoadingProviders = isModuleDriven
        ? module.isLoadingProviders
        : useProviderStore((state) => state.isLoading);

      const [open, setOpen] = useState(false);
      const [providerFilterOpen, setProviderFilterOpen] = useState(false);
      const [filterText, setFilterText] = useState("");
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
        getAvailableModelListItems,
      } = useProviderStore(
        useShallow((state) => ({
          dbProviderConfigs: state.dbProviderConfigs,
          globalModelSortOrder: state.globalModelSortOrder,
          getAvailableModelListItems: state.getAvailableModelListItems,
        }))
      );

      const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
        () => new Set(dbProviderConfigs.map((p) => p.id))
      );

      useEffect(() => {
        setSelectedProviders(new Set(dbProviderConfigs.map((p) => p.id)));
      }, [dbProviderConfigs]);

      const orderedModels: ModelListItem[] = useMemo(() => {
        const allModelListItems = getAvailableModelListItems();
        const modelItemsMap = new Map(allModelListItems.map((m) => [m.id, m]));
        const globallyEnabledCombinedIds = new Set<string>();
        dbProviderConfigs.forEach((config) => {
          if (config.isEnabled && config.enabledModels) {
            config.enabledModels.forEach((modelId) => {
              globallyEnabledCombinedIds.add(
                combineModelId(config.id, modelId)
              );
            });
          }
        });
        const globallyEnabledModels = allModelListItems.filter((item) =>
          globallyEnabledCombinedIds.has(item.id)
        );
        const sorted: ModelListItem[] = [];
        const added = new Set<string>();
        globalModelSortOrder.forEach((id) => {
          if (globallyEnabledCombinedIds.has(id)) {
            const details = modelItemsMap.get(id);
            if (details && !added.has(id)) {
              sorted.push(details);
              added.add(id);
            }
          }
        });
        globallyEnabledModels.forEach((item) => {
          if (!added.has(item.id)) {
            sorted.push(item);
          }
        });
        return sorted;
      }, [dbProviderConfigs, globalModelSortOrder, getAvailableModelListItems]);

      const filteredModels = useMemo(() => {
        let providerFiltered = orderedModels;
        if (selectedProviders.size !== dbProviderConfigs.length) {
          providerFiltered = orderedModels.filter((model) =>
            selectedProviders.has(model.providerId)
          );
        }
        let textFiltered = providerFiltered;
        if (filterText.trim()) {
          const lowerFilter = filterText.toLowerCase();
          textFiltered = providerFiltered.filter(
            (model) =>
              model.name.toLowerCase().includes(lowerFilter) ||
              model.providerName.toLowerCase().includes(lowerFilter) ||
              model.id.toLowerCase().includes(lowerFilter)
          );
        }
        const activeFilters = Object.entries(capabilityFilters)
          .filter(([, isActive]) => isActive)
          .map(([key]) => key as CapabilityFilter);
        if (activeFilters.length === 0) {
          return textFiltered;
        }
        return textFiltered.filter((model) => {
          const supportedParams = new Set(
            model.metadataSummary?.supported_parameters ?? []
          );
          const inputModalities = new Set(
            model.metadataSummary?.input_modalities ?? []
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
                return Array.from(inputModalities).some(
                  (mod) => mod !== "text"
                );
              default:
                return true;
            }
          });
        });
      }, [
        orderedModels,
        filterText,
        capabilityFilters,
        selectedProviders,
        dbProviderConfigs.length,
      ]);

      const selectedModelDetails = useMemo(() => {
        return orderedModels.find((m) => m.id === currentValue);
      }, [orderedModels, currentValue]);

      const handleSelect = useCallback(
        (currentValFromCommand: string) => {
          const newValue =
            currentValFromCommand === currentValue
              ? null
              : currentValFromCommand;
          if (isModuleDriven && module) {
            module.handleSelectionChange(newValue);
          } else if (directOnChange) {
            directOnChange(newValue);
          }
          setOpen(false);
          setFilterText("");
        },
        [isModuleDriven, module, directOnChange, currentValue]
      );

      const toggleCapabilityFilter = (filter: CapabilityFilter) => {
        setCapabilityFilters((prev) => ({
          ...prev,
          [filter]: !prev[filter],
        }));
      };

      const handleProviderFilterChange = useCallback(
        (providerId: string, checked: boolean) => {
          setSelectedProviders((prev) => {
            const next = new Set(prev);
            if (checked) {
              next.add(providerId);
            } else {
              next.delete(providerId);
            }
            return next;
          });
        },
        []
      );

      if (isLoadingProviders && isModuleDriven) {
        // Only show skeleton if module-driven and loading
        return <Skeleton className={cn("h-9 w-[250px]", className)} />;
      }

      const activeCapabilityFilterCount =
        Object.values(capabilityFilters).filter(Boolean).length;
      const activeProviderFilterCount =
        selectedProviders.size !== dbProviderConfigs.length ? 1 : 0;
      const totalActiveFilters =
        activeCapabilityFilterCount + activeProviderFilterCount;

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={isDisabled || orderedModels.length === 0}
              className={cn(
                "w-auto justify-between h-9 text-sm font-normal relative",
                className
              )}
            >
              <span className="truncate max-w-[200px] sm:max-w-[300px]">
                {selectedModelDetails
                  ? `${selectedModelDetails.name} (${selectedModelDetails.providerName})`
                  : "Select Model..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              {totalActiveFilters > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-primary rounded-full">
                  {totalActiveFilters}
                </span>
              )}
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
                <div className="flex items-center gap-0.5 ml-auto pl-2">
                  <Popover
                    open={providerFilterOpen}
                    onOpenChange={setProviderFilterOpen}
                  >
                    <PopoverTrigger asChild>
                      <ActionTooltipButton
                        tooltipText="Filter by Provider"
                        icon={<FilterIcon />}
                        variant={
                          activeProviderFilterCount > 0 ? "secondary" : "ghost"
                        }
                        className={cn(
                          "h-7 w-7 relative",
                          activeProviderFilterCount > 0 && "text-primary"
                        )}
                        aria-label="Filter by provider"
                      >
                        {activeProviderFilterCount > 0 && (
                          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1 text-[10px] font-semibold leading-none text-white bg-primary rounded-full">
                            {selectedProviders.size}
                          </span>
                        )}
                      </ActionTooltipButton>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-0">
                      <div className="p-2 space-y-1">
                        <Label className="text-xs px-2 font-semibold">
                          Filter by Provider
                        </Label>
                        <ScrollArea className="h-48">
                          {dbProviderConfigs.map((provider) => (
                            <div
                              key={provider.id}
                              className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted"
                            >
                              <Checkbox
                                id={`popover-provider-filter-${provider.id}`}
                                checked={selectedProviders.has(provider.id)}
                                onCheckedChange={(checked) =>
                                  handleProviderFilterChange(
                                    provider.id,
                                    !!checked
                                  )
                                }
                              />
                              <Label
                                htmlFor={`popover-provider-filter-${provider.id}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {provider.name} ({provider.type})
                              </Label>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <ActionTooltipButton
                    tooltipText="Filter: Reasoning"
                    icon={<BrainCircuitIcon />}
                    onClick={() => toggleCapabilityFilter("reasoning")}
                    variant={
                      capabilityFilters.reasoning ? "secondary" : "ghost"
                    }
                    className={cn(
                      "h-7 w-7",
                      capabilityFilters.reasoning && "text-primary"
                    )}
                    aria-label="Filter by reasoning capability"
                  />
                  <ActionTooltipButton
                    tooltipText="Filter: Web Search"
                    icon={<SearchIconLucide />}
                    onClick={() => toggleCapabilityFilter("webSearch")}
                    variant={
                      capabilityFilters.webSearch ? "secondary" : "ghost"
                    }
                    className={cn(
                      "h-7 w-7",
                      capabilityFilters.webSearch && "text-primary"
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
                      capabilityFilters.tools && "text-primary"
                    )}
                    aria-label="Filter by tool usage capability"
                  />
                  <ActionTooltipButton
                    tooltipText="Filter: Multimodal"
                    icon={<ImageIcon />}
                    onClick={() => toggleCapabilityFilter("multimodal")}
                    variant={
                      capabilityFilters.multimodal ? "secondary" : "ghost"
                    }
                    className={cn(
                      "h-7 w-7",
                      capabilityFilters.multimodal && "text-primary"
                    )}
                    aria-label="Filter by multimodal capability"
                  />
                </div>
              </div>
              <CommandList>
                <CommandEmpty>
                  {totalActiveFilters > 0
                    ? "No models match all active filters."
                    : "No model found."}
                </CommandEmpty>
                <CommandGroup>
                  {filteredModels.map((model) => (
                    <CommandItem
                      key={model.id}
                      value={model.id}
                      onSelect={handleSelect}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentValue === model.id
                            ? "opacity-100"
                            : "opacity-0"
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
    }
  );
GlobalModelSelector.displayName = "GlobalModelSelector";
