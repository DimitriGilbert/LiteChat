// src/controls/components/settings/ModelBrowserList.tsx
// FULL FILE
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SearchIcon,
  FilterIcon,
  BrainCircuitIcon,
  WrenchIcon,
  ImageIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { useVirtualizer } from "@tanstack/react-virtual";

interface ModelBrowserListProps {
  onSelectModelForDetails: (combinedModelId: string | null) => void;
}
type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";

export const ModelBrowserList: React.FC<ModelBrowserListProps> = ({
  onSelectModelForDetails,
}) => {
  // @ts-expect-error we do not use it but cant remove, thank you unamed array destruct ! @AI DONT TOUCH !!
  const [scrollAreaContainer, setScrollAreaContainer] =
    useState<HTMLDivElement | null>(null);
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(
    null
  );

  const scrollAreaRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setScrollAreaContainer(node);
      const vp = node.querySelector<HTMLDivElement>(
        "[data-radix-scroll-area-viewport]"
      );
      if (vp) {
        setViewportElement(vp);
      } else {
        const observer = new MutationObserver(() => {
          const observedVp = node.querySelector<HTMLDivElement>(
            "[data-radix-scroll-area-viewport]"
          );
          if (observedVp) {
            setViewportElement(observedVp);
            observer.disconnect();
          }
        });
        observer.observe(node, { childList: true, subtree: true });
        return () => observer.disconnect();
      }
    } else {
      setScrollAreaContainer(null);
      setViewportElement(null);
    }
  }, []);

  const { getAvailableModelListItems, isLoading, dbProviderConfigs } =
    useProviderStore(
      useShallow((state) => ({
        getAvailableModelListItems: state.getAvailableModelListItems,
        isLoading: state.isLoading,
        dbProviderConfigs: state.dbProviderConfigs,
      }))
    );

  const [filterText, setFilterText] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
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

  const allModelListItems = useMemo(
    () => getAvailableModelListItems(),
    [getAvailableModelListItems]
  );

  useEffect(() => {
    setSelectedProviders(new Set(dbProviderConfigs.map((p) => p.id)));
  }, [dbProviderConfigs]);

  const filteredModels = useMemo(() => {
    let models = allModelListItems;
    if (selectedProviders.size !== dbProviderConfigs.length) {
      models = models.filter((model) =>
        selectedProviders.has(model.providerId)
      );
    }
    if (filterText.trim()) {
      const query = filterText.toLowerCase();
      models = models.filter(
        (model) =>
          model.name.toLowerCase().includes(query) ||
          model.providerName.toLowerCase().includes(query) ||
          model.id.toLowerCase().includes(query)
      );
    }
    const activeFilters = Object.entries(capabilityFilters)
      .filter(([, isActive]) => isActive)
      .map(([key]) => key as CapabilityFilter);

    if (activeFilters.length > 0) {
      models = models.filter((model) => {
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
              return Array.from(inputModalities).some((mod) => mod !== "text");
            default:
              return true;
          }
        });
      });
    }
    return models.sort((a, b) => {
      const providerCompare = a.providerName.localeCompare(b.providerName);
      if (providerCompare !== 0) return providerCompare;
      return a.name.localeCompare(b.name);
    });
  }, [
    allModelListItems,
    filterText,
    selectedProviders,
    dbProviderConfigs.length,
    capabilityFilters,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: filteredModels.length,
    getScrollElement: () => viewportElement,
    estimateSize: () => 48,
    overscan: 10,
  });

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

  const handleRowClick = (modelId: string) => {
    onSelectModelForDetails(modelId);
  };

  const activeProviderFilterCount =
    selectedProviders.size !== dbProviderConfigs.length ? 1 : 0;
  const activeCapabilityFilterCount =
    Object.values(capabilityFilters).filter(Boolean).length;
  const totalActiveFilters =
    activeProviderFilterCount + activeCapabilityFilterCount;

  if (isLoading) {
    return (
      <div className="space-y-2 h-full flex flex-col">
        <Skeleton className="h-9 w-full flex-shrink-0" />
        <Skeleton className="h-full w-full flex-grow" />
      </div>
    );
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center gap-2 flex-shrink-0">
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
        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
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
                  {dbProviderConfigs.map((provider) => (
                    <div
                      key={provider.id}
                      className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted"
                    >
                      <Checkbox
                        id={`model-browser-provider-filter-${provider.id}`}
                        checked={selectedProviders.has(provider.id)}
                        onCheckedChange={(checked) =>
                          handleProviderFilterChange(provider.id, !!checked)
                        }
                      />
                      <Label
                        htmlFor={`model-browser-provider-filter-${provider.id}`}
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
                    variant={capabilityFilters.tools ? "secondary" : "outline"}
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
      <ScrollArea
        className="flex-grow border rounded-md bg-background/50 h-[calc(15*2.5rem+2px)]"
        ref={scrollAreaRef}
      >
        {viewportElement && (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {filteredModels.length === 0 && !isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4 absolute inset-0 flex items-center justify-center">
                No models match your filters.
              </p>
            ) : (
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const model = filteredModels[virtualRow.index];
                if (!model) return null;
                return (
                  <div
                    key={model.id}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="p-1"
                  >
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="w-full text-left p-1.5 rounded hover:bg-muted/50 flex flex-col"
                            onClick={() => handleRowClick(model.id)}
                          >
                            <span className="text-sm font-medium truncate">
                              {model.name}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {model.providerName}
                            </span>
                          </button>
                        </TooltipTrigger>
                        {model.metadataSummary?.description && (
                          <TooltipContent
                            side="bottom"
                            align="start"
                            className="max-w-xs"
                          >
                            <p>{model.metadataSummary.description}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                );
              })
            )}
          </div>
        )}
        {!viewportElement && !isLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Initializing list...
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
