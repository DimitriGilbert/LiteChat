// src/components/LiteChat/settings/ModelBrowserList.tsx
// FULL FILE
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchIcon, FilterIcon } from "lucide-react";
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

interface ModelBrowserListProps {
  onSelectModelForDetails: (combinedModelId: string | null) => void;
}

export const ModelBrowserList: React.FC<ModelBrowserListProps> = ({
  onSelectModelForDetails,
}) => {
  const {
    getAvailableModelListItems,
    isLoading,
    dbProviderConfigs, // Need provider configs for filtering
  } = useProviderStore(
    useShallow((state) => ({
      getAvailableModelListItems: state.getAvailableModelListItems,
      isLoading: state.isLoading,
      dbProviderConfigs: state.dbProviderConfigs,
    }))
  );

  const [filterText, setFilterText] = useState("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  // State for provider filters
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(
    () => new Set(dbProviderConfigs.map((p) => p.id)) // Initially select all
  );

  const allModelListItems = useMemo(
    () => getAvailableModelListItems(),
    [getAvailableModelListItems]
  );

  // Update selectedProviders if dbProviderConfigs change
  useEffect(() => {
    setSelectedProviders(new Set(dbProviderConfigs.map((p) => p.id)));
  }, [dbProviderConfigs]);

  const filteredModels = useMemo(() => {
    let models = allModelListItems;

    // Filter by selected providers
    if (selectedProviders.size !== dbProviderConfigs.length) {
      models = models.filter((model) =>
        selectedProviders.has(model.providerId)
      );
    }

    // Filter by text
    if (filterText.trim()) {
      const query = filterText.toLowerCase();
      models = models.filter(
        (model) =>
          model.name.toLowerCase().includes(query) ||
          model.providerName.toLowerCase().includes(query) ||
          model.id.toLowerCase().includes(query)
      );
    }

    // Sort remaining models
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
  ]);

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

  const handleRowClick = (modelId: string) => {
    onSelectModelForDetails(modelId);
  };

  const activeFilterCount =
    selectedProviders.size !== dbProviderConfigs.length ? 1 : 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
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
              Providers
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-primary rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
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
                      id={`provider-filter-${provider.id}`}
                      checked={selectedProviders.has(provider.id)}
                      onCheckedChange={(checked) =>
                        handleProviderFilterChange(provider.id, !!checked)
                      }
                    />
                    <Label
                      htmlFor={`provider-filter-${provider.id}`}
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
      </div>
      <ScrollArea className="flex-grow border rounded-md">
        {filteredModels.length > 0 ? (
          <ul className="p-1">
            {filteredModels.map((model) => (
              <li key={model.id}>
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={cn(
                          "w-full text-left p-1.5 rounded hover:bg-muted/50 flex justify-between items-center"
                          // Add visual cue for clickability if needed
                        )}
                        onClick={() => handleRowClick(model.id)}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {model.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {model.providerName}
                          </span>
                        </div>
                        {/* Optional: Add indicator or icon */}
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
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
            No models match your filters.
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
