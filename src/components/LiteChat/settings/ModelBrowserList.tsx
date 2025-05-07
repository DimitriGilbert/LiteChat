// src/components/LiteChat/settings/ModelBrowserList.tsx
// FULL FILE
import React, { useState, useMemo, useCallback } from "react";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  SearchIcon,
  InfoIcon,
  CheckIcon,
  BanIcon,
  BrainCircuitIcon,
  WrenchIcon,
  ImageIcon,
  FilterIcon,
  DollarSignIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ActionTooltipButton } from "../common/ActionTooltipButton";
import type { ModelListItem } from "@/types/litechat/provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ModelBrowserListProps {
  onSelectModelForDetails: (combinedModelId: string | null) => void;
}

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";

const parsePrice = (priceStr: string | null | undefined): number | null => {
  if (!priceStr) return null;
  const priceNum = parseFloat(priceStr);
  return isNaN(priceNum) ? null : priceNum / 1_000_000;
};

export const ModelBrowserList: React.FC<ModelBrowserListProps> = ({
  onSelectModelForDetails,
}) => {
  const {
    getAvailableModelListItems,
    dbProviderConfigs,
    updateProviderConfig,
    isLoading,
  } = useProviderStore(
    useShallow((state) => ({
      getAvailableModelListItems: state.getAvailableModelListItems,
      dbProviderConfigs: state.dbProviderConfigs,
      updateProviderConfig: state.updateProviderConfig,
      isLoading: state.isLoading,
    })),
  );

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [enabledFilter, setEnabledFilter] = useState<
    "all" | "enabled" | "disabled"
  >("all");
  const [capabilityFilters, setCapabilityFilters] = useState<
    Record<CapabilityFilter, boolean>
  >({
    reasoning: false,
    webSearch: false,
    tools: false,
    multimodal: false,
  });
  const [minInputPrice, setMinInputPrice] = useState<string>("");
  const [maxInputPrice, setMaxInputPrice] = useState<string>("");
  const [minOutputPrice, setMinOutputPrice] = useState<string>("");
  const [maxOutputPrice, setMaxOutputPrice] = useState<string>("");

  const allModelItems = useMemo(
    () => getAvailableModelListItems(),
    [getAvailableModelListItems],
  );

  const providerConfigsMap = useMemo(
    () => new Map(dbProviderConfigs.map((p) => [p.id, p])),
    [dbProviderConfigs],
  );

  const filteredModels = useMemo(() => {
    let models = allModelItems;

    if (enabledFilter !== "all") {
      models = models.filter((model) => {
        const providerConfig = providerConfigsMap.get(model.providerId);
        const simpleModelId = model.id.split(":")[1];
        const isEnabled =
          providerConfig?.isEnabled &&
          providerConfig?.enabledModels?.includes(simpleModelId) === true;
        return enabledFilter === "enabled" ? isEnabled : !isEnabled;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      models = models.filter(
        (model) =>
          model.name.toLowerCase().includes(query) ||
          model.providerName.toLowerCase().includes(query) ||
          model.id.toLowerCase().includes(query),
      );
    }

    const activeCapabilityFilters = Object.entries(capabilityFilters)
      .filter(([, isActive]) => isActive)
      .map(([key]) => key as CapabilityFilter);

    if (activeCapabilityFilters.length > 0) {
      models = models.filter((model) => {
        const supportedParams = new Set(
          model.metadataSummary?.supported_parameters ?? [],
        );
        const inputModalities = new Set(
          model.metadataSummary?.input_modalities ?? [],
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

    const minIn = parseFloat(minInputPrice);
    const maxIn = parseFloat(maxInputPrice);
    const minOut = parseFloat(minOutputPrice);
    const maxOut = parseFloat(maxOutputPrice);
    const hasMinIn = !isNaN(minIn);
    const hasMaxIn = !isNaN(maxIn);
    const hasMinOut = !isNaN(minOut);
    const hasMaxOut = !isNaN(maxOut);

    if (hasMinIn || hasMaxIn || hasMinOut || hasMaxOut) {
      models = models.filter((model) => {
        const promptPrice = parsePrice(model.metadataSummary?.pricing?.prompt);
        const completionPrice = parsePrice(
          model.metadataSummary?.pricing?.completion,
        );
        const minInPerToken = hasMinIn ? minIn / 1_000_000 : -Infinity;
        const maxInPerToken = hasMaxIn ? maxIn / 1_000_000 : Infinity;
        const minOutPerToken = hasMinOut ? minOut / 1_000_000 : -Infinity;
        const maxOutPerToken = hasMaxOut ? maxOut / 1_000_000 : Infinity;
        const inputPriceMatch =
          promptPrice !== null &&
          promptPrice >= minInPerToken &&
          promptPrice <= maxInPerToken;
        const outputPriceMatch =
          completionPrice !== null &&
          completionPrice >= minOutPerToken &&
          completionPrice <= maxOutPerToken;
        let match = true;
        if (hasMinIn || hasMaxIn) match &&= inputPriceMatch;
        if (hasMinOut || hasMaxOut) match &&= outputPriceMatch;
        return match;
      });
    }

    return models.sort((a, b) => {
      const nameComp = a.name.localeCompare(b.name);
      if (nameComp !== 0) return nameComp;
      return a.providerName.localeCompare(b.providerName);
    });
  }, [
    allModelItems,
    searchQuery,
    enabledFilter,
    providerConfigsMap,
    capabilityFilters,
    minInputPrice,
    maxInputPrice,
    minOutputPrice,
    maxOutputPrice,
  ]);

  const handleToggleModel = useCallback(
    async (modelItem: ModelListItem, checked: boolean) => {
      const providerConfig = providerConfigsMap.get(modelItem.providerId);
      if (!providerConfig) {
        toast.error("Provider configuration not found.");
        return;
      }
      const simpleModelId = modelItem.id.split(":")[1];
      const currentEnabledSet = new Set(providerConfig.enabledModels ?? []);
      if (checked) {
        currentEnabledSet.add(simpleModelId);
      } else {
        currentEnabledSet.delete(simpleModelId);
      }
      const newEnabledModels = Array.from(currentEnabledSet);
      try {
        await updateProviderConfig(providerConfig.id, {
          enabledModels: newEnabledModels,
        });
        toast.success(
          `Model "${modelItem.name}" ${checked ? "enabled" : "disabled"}.`,
        );
      } catch (error) {
        toast.error("Failed to update model status.");
      }
    },
    [providerConfigsMap, updateProviderConfig],
  );

  const toggleCapabilityFilter = (filter: CapabilityFilter) => {
    setCapabilityFilters((prev) => ({ ...prev, [filter]: !prev[filter] }));
  };

  const activeFilterCount =
    (enabledFilter !== "all" ? 1 : 0) +
    Object.values(capabilityFilters).filter(Boolean).length +
    (minInputPrice || maxInputPrice || minOutputPrice || maxOutputPrice
      ? 1
      : 0);

  if (isLoading) {
    return (
      <div className="space-y-3 h-full flex flex-col">
        <Skeleton className="h-9 w-full flex-shrink-0" />
        <Skeleton className="h-9 w-1/4 flex-shrink-0" />
        <div className="flex-grow space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-grow">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter models by name or provider..."
            className="pl-8 h-9 w-full text-xs"
            type="text"
          />
        </div>
        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-3 relative">
              <FilterIcon className="h-4 w-4 mr-1" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-primary rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Status</Label>
              <div className="flex gap-1">
                <Button
                  variant={enabledFilter === "all" ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setEnabledFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={
                    enabledFilter === "enabled" ? "secondary" : "outline"
                  }
                  size="sm"
                  onClick={() => setEnabledFilter("enabled")}
                >
                  <CheckIcon className="h-3 w-3 mr-1" /> Enabled
                </Button>
                <Button
                  variant={
                    enabledFilter === "disabled" ? "secondary" : "outline"
                  }
                  size="sm"
                  onClick={() => setEnabledFilter("disabled")}
                >
                  <BanIcon className="h-3 w-3 mr-1" /> Disabled
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Capabilities</Label>
              <div className="flex flex-wrap gap-1">
                <ActionTooltipButton
                  tooltipText="Reasoning"
                  aria-label="Reasoning"
                  icon={<BrainCircuitIcon />}
                  onClick={() => toggleCapabilityFilter("reasoning")}
                  variant={
                    capabilityFilters.reasoning ? "secondary" : "outline"
                  }
                  className={cn(capabilityFilters.reasoning && "text-primary")}
                />
                <ActionTooltipButton
                  tooltipText="Web Search"
                  aria-label="Web Search"
                  icon={<SearchIcon />}
                  onClick={() => toggleCapabilityFilter("webSearch")}
                  variant={
                    capabilityFilters.webSearch ? "secondary" : "outline"
                  }
                  className={cn(capabilityFilters.webSearch && "text-primary")}
                />
                <ActionTooltipButton
                  tooltipText="Tools"
                  aria-label="Tools"
                  icon={<WrenchIcon />}
                  onClick={() => toggleCapabilityFilter("tools")}
                  variant={capabilityFilters.tools ? "secondary" : "outline"}
                  className={cn(capabilityFilters.tools && "text-primary")}
                />
                <ActionTooltipButton
                  tooltipText="Multimodal"
                  aria-label="Multimodal"
                  icon={<ImageIcon />}
                  onClick={() => toggleCapabilityFilter("multimodal")}
                  variant={
                    capabilityFilters.multimodal ? "secondary" : "outline"
                  }
                  className={cn(capabilityFilters.multimodal && "text-primary")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <DollarSignIcon className="h-3 w-3" /> Price Range ($ / 1M
                Tokens)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min Input"
                  value={minInputPrice}
                  onChange={(e) => setMinInputPrice(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max Input"
                  value={maxInputPrice}
                  onChange={(e) => setMaxInputPrice(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min Output"
                  value={minOutputPrice}
                  onChange={(e) => setMinOutputPrice(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max Output"
                  value={maxOutputPrice}
                  onChange={(e) => setMaxOutputPrice(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <ScrollArea className="flex-grow border rounded-md p-2 bg-background/50">
        {filteredModels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No models match your filters.
          </p>
        ) : (
          <div className="space-y-1">
            {filteredModels.map((model) => {
              const providerConfig = providerConfigsMap.get(model.providerId);
              const simpleModelId = model.id.split(":")[1];
              const isEnabled =
                providerConfig?.isEnabled &&
                providerConfig?.enabledModels?.includes(simpleModelId) === true;
              return (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-muted"
                >
                  <div className="flex items-center space-x-2 flex-grow mr-2">
                    <Switch
                      id={`browse-enable-${model.id}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        handleToggleModel(model, checked)
                      }
                      className="flex-shrink-0"
                      disabled={!providerConfig?.isEnabled}
                    />
                    <Label
                      htmlFor={`browse-enable-${model.id}`}
                      className="text-sm font-normal cursor-pointer space-y-0.5"
                    >
                      <span className="block font-medium">{model.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Provider: {model.providerName}
                      </span>
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onSelectModelForDetails(model.id)}
                    title="View Model Details"
                  >
                    <InfoIcon className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
