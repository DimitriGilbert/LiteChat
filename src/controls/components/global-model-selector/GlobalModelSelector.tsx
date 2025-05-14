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
// REMOVED: import { useProviderStore } from "@/store/provider.store";
// REMOVED: import { useShallow } from "zustand/react/shallow";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ModelListItem,
  DbProviderConfig,
} from "@/types/litechat/provider";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GlobalModelSelectorModule } from "@/controls/modules/GlobalModelSelectorModule";
import { useProviderStore } from "@/store/provider.store"; // Only for dbProviderConfigs for filter UI

interface GlobalModelSelectorProps {
  module?: GlobalModelSelectorModule;
  value?: string | null;
  onChange?: (newModelId: string | null) => void;
  className?: string;
  disabled?: boolean;
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

      useEffect(() => {
        if (module) {
          module.setNotifyCallback(() => forceUpdate({}));
          return () => module.setNotifyCallback(null);
        }
      }, [module]);

      const isModuleDriven = !!module;

      const currentValue = isModuleDriven
        ? module.selectedModelId
        : directValue;
      const isDisabled = isModuleDriven ? module.isStreaming : directDisabled;
      const isLoadingProviders = isModuleDriven
        ? module.isLoadingProviders
        : false; // Fallback for direct use, assuming data is ready

      // Models are now passed directly from the module
      const modelsFromSource: ModelListItem[] = isModuleDriven
        ? module.globallyEnabledModels
        : // For direct use, we might need a way to get this, or assume it's passed if not module-driven
          // For now, let's assume direct use implies a simpler scenario or data passed differently.
          // If direct use needs store access, it should be handled by the parent component.
          [];

      // dbProviderConfigs is only needed for rendering the provider filter UI
      const dbProviderConfigs = useProviderStore(
        (state) => state.dbProviderConfigs
      );

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

      const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
        () => new Set(dbProviderConfigs.map((p) => p.id))
      );

      useEffect(() => {
        setSelectedProviders(new Set(dbProviderConfigs.map((p) => p.id)));
      }, [dbProviderConfigs]);

      const filteredModels = useMemo(() => {
        let providerFiltered = modelsFromSource;
        if (selectedProviders.size !== dbProviderConfigs.length) {
          providerFiltered = modelsFromSource.filter((model) =>
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
        const activeCapabilityFilters = Object.entries(capabilityFilters)
          .filter(([, isActive]) => isActive)
          .map(([key]) => key as CapabilityFilter);
        if (activeCapabilityFilters.length === 0) {
          return textFiltered;
        }
        return textFiltered.filter((model: ModelListItem) => {
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
                return Array.from(inputModalities).some(
                  (mod) => mod !== "text"
                );
              default:
                return true;
            }
          });
        });
      }, [
        modelsFromSource,
        filterText,
        capabilityFilters,
        selectedProviders,
        dbProviderConfigs.length,
      ]);

      const selectedModelDetails = useMemo(() => {
        return modelsFromSource.find(
          (m: ModelListItem) => m.id === currentValue
        );
      }, [modelsFromSource, currentValue]);

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

      if (isLoadingProviders) {
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
              disabled={isDisabled || modelsFromSource.length === 0}
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
          <PopoverContent
            className="w-[--radix-popover-trigger-width] p-0"
            style={{
              maxHeight: "min(40vh, 400px)",
              overflow: "hidden",
            }}
          >
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
                          {dbProviderConfigs.map(
                            (provider: DbProviderConfig) => (
                              <div
                                key={provider.id}
                                className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted"
                              >
                                <Checkbox
                                  id={`selector-provider-filter-${provider.id}`}
                                  checked={selectedProviders.has(provider.id)}
                                  onCheckedChange={(checked) =>
                                    handleProviderFilterChange(
                                      provider.id,
                                      !!checked
                                    )
                                  }
                                />
                                <Label
                                  htmlFor={`selector-provider-filter-${provider.id}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  {provider.name} ({provider.type})
                                </Label>
                              </div>
                            )
                          )}
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
              <CommandList className="max-h-[calc(min(40vh,400px)-70px)] overflow-y-auto">
                <CommandEmpty>
                  {totalActiveFilters > 0
                    ? "No models match all active filters."
                    : modelsFromSource.length === 0
                    ? "No models enabled globally."
                    : "No model found."}
                </CommandEmpty>
                <CommandGroup>
                  {filteredModels.map((model: ModelListItem) => {
                    const supportedParams = new Set(
                      model.metadataSummary?.supported_parameters ?? []
                    );
                    const inputModalities = new Set(
                      model.metadataSummary?.input_modalities ?? []
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
                      <CommandItem
                        key={model.id}
                        value={model.id}
                        onSelect={handleSelect}
                        className="flex justify-between items-center"
                      >
                        <div className="flex items-center min-w-0">
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 flex-shrink-0",
                              currentValue === model.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="truncate">
                            {model.name} ({model.providerName})
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-1 pl-2 flex-shrink-0">
                          {hasReasoning && (
                            <BrainCircuitIcon className="h-3 w-3 text-blue-500" />
                          )}
                          {hasWebSearch && (
                            <SearchIconLucide className="h-3 w-3 text-green-500" />
                          )}
                          {hasTools && (
                            <WrenchIcon className="h-3 w-3 text-orange-500" />
                          )}
                          {isMultimodal && (
                            <ImageIcon className="h-3 w-3 text-purple-500" />
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }
  );
GlobalModelSelector.displayName = "GlobalModelSelector";
