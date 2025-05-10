// src/controls/components/settings/ModelEnablementList.tsx
// FULL FILE
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SearchIcon,
  BrainCircuitIcon,
  WrenchIcon,
  ImageIcon,
  FilterIcon,
  CheckIcon,
  BanIcon,
  DollarSignIcon,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import type { OpenRouterModel } from "@/types/litechat/provider";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";

interface ModelEnablementListProps {
  providerId: string;
  allAvailableModels: OpenRouterModel[];
  enabledModelIds: Set<string>;
  onToggleModel: (modelId: string, isEnabled: boolean) => void;
  isLoading?: boolean;
  disabled?: boolean;
  listHeightClass?: string;
  onModelClick?: (modelId: string) => void;
}

const parsePrice = (priceStr: string | null | undefined): number | null => {
  if (!priceStr) return null;
  const priceNum = parseFloat(priceStr);
  return isNaN(priceNum) ? null : priceNum / 1_000_000;
};

export const ModelEnablementList: React.FC<ModelEnablementListProps> = ({
  providerId,
  allAvailableModels,
  enabledModelIds,
  onToggleModel,
  isLoading = false,
  disabled = false,
  listHeightClass = "h-[26rem]",
  onModelClick,
}) => {
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
        // Fallback if viewport not immediately available
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
        // Consider a timeout for the observer as well
        return () => observer.disconnect();
      }
    } else {
      setScrollAreaContainer(null);
      setViewportElement(null);
    }
  }, []);

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

  const filteredModels = useMemo(() => {
    let models = [...allAvailableModels];

    if (enabledFilter === "enabled") {
      models = models.filter((model) => enabledModelIds.has(model.id));
    } else if (enabledFilter === "disabled") {
      models = models.filter((model) => !enabledModelIds.has(model.id));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      models = models.filter(
        (model) =>
          model.name.toLowerCase().includes(query) ||
          model.id.toLowerCase().includes(query)
      );
    }
    const activeCapabilityFilters = Object.entries(capabilityFilters)
      .filter(([, isActive]) => isActive)
      .map(([key]) => key as CapabilityFilter);
    if (activeCapabilityFilters.length > 0) {
      models = models.filter((model) => {
        const supportedParams = new Set(model.supported_parameters ?? []);
        const inputModalities = new Set(
          model.architecture?.input_modalities ?? []
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
        const promptPrice = parsePrice(model.pricing?.prompt);
        const completionPrice = parsePrice(model.pricing?.completion);
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
    return models;
  }, [
    allAvailableModels,
    searchQuery,
    enabledFilter,
    enabledModelIds,
    capabilityFilters,
    minInputPrice,
    maxInputPrice,
    minOutputPrice,
    maxOutputPrice,
  ]);

  const rowVirtualizer = useVirtualizer({
    count: filteredModels.length,
    getScrollElement: () => viewportElement,
    estimateSize: () => 40,
    overscan: 10,
  });

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
      <div className={cn("space-y-2", listHeightClass)}>
        <div className="h-8 w-full bg-muted rounded animate-pulse" />
        <div className="h-8 w-full bg-muted rounded animate-pulse" />
        <div className="h-8 w-full bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (allAvailableModels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic pt-2">
        No models available for this provider. Try fetching models.
      </p>
    );
  }

  return (
    <div className="space-y-2 flex flex-col h-full">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative flex-grow">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter models by name..."
            className="pl-8 h-9 w-full text-xs"
            type="text"
            disabled={disabled}
          />
        </div>
        <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 relative"
              disabled={disabled}
            >
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
      <ScrollArea
        className={cn(
          "w-full rounded-md border border-border p-1 bg-background/50 flex-grow",
          listHeightClass
        )}
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
                No models match the current filters.
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
                    className="flex items-center justify-between space-x-2 p-1.5 rounded hover:bg-muted/50"
                  >
                    <Switch
                      id={`enable-model-${providerId}-${model.id}`}
                      checked={enabledModelIds.has(model.id)}
                      onCheckedChange={(checked) =>
                        onToggleModel(model.id, checked)
                      }
                      disabled={disabled}
                      aria-label={`Enable model ${model.name || model.id}`}
                      className="flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Label
                      htmlFor={`enable-model-${providerId}-${model.id}`}
                      className="text-sm font-normal text-card-foreground flex-grow cursor-pointer truncate pl-2"
                      title={model.name || model.id}
                      onClick={
                        onModelClick ? () => onModelClick(model.id) : undefined
                      }
                    >
                      {model.name || model.id}
                    </Label>
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
