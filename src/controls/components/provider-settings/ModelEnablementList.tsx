// src/controls/components/settings/ModelEnablementList.tsx
// FULL FILE
import React, { useState, useMemo, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { SearchIcon, Brain, Globe, Wrench, Image as ImageIcon, Palette } from "lucide-react";
import type { OpenRouterModel } from "@/types/litechat/provider";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ModelFilterControls } from "@/controls/components/common/ModelFilterControls";

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";
type EnabledFilterStatus = "all" | "enabled" | "disabled";

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
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(
    null
  );

  const scrollAreaRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
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
      setViewportElement(null);
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState<string>("");
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

  const setCapabilityFiltersCallback = useCallback((filters: Record<CapabilityFilter, boolean>) => {
    setCapabilityFilters(filters);
  }, []);

  const handleEnabledFilterChange = useCallback((status: EnabledFilterStatus) => {
    setEnabledFilter(status);
  }, []);

  const handlePriceFilterChange = useCallback((minIn: string, maxIn: string, minOut: string, maxOut: string) => {
    setMinInputPrice(minIn);
    setMaxInputPrice(maxIn);
    setMinOutputPrice(minOut);
    setMaxOutputPrice(maxOut);
  }, []);

  const activeFilterCount = useMemo(() => (
    (enabledFilter !== "all" ? 1 : 0) +
    Object.values(capabilityFilters).filter(Boolean).length +
    (minInputPrice || maxInputPrice || minOutputPrice || maxOutputPrice ? 1 : 0)
  ), [enabledFilter, capabilityFilters, minInputPrice, maxInputPrice, minOutputPrice, maxOutputPrice]);

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
        <ModelFilterControls
          currentCapabilityFilters={capabilityFilters}
          onCapabilityFilterChange={setCapabilityFiltersCallback}
          currentEnabledFilter={enabledFilter}
          onEnabledFilterChange={handleEnabledFilterChange}
          currentMinInputPrice={minInputPrice}
          currentMaxInputPrice={maxInputPrice}
          currentMinOutputPrice={minOutputPrice}
          currentMaxOutputPrice={maxOutputPrice}
          onPriceFilterChange={handlePriceFilterChange}
          showStatusFilter={true}
          showCapabilityFilters={true}
          showPriceFilters={true}
          disabled={disabled}
          totalActiveFilters={activeFilterCount}
        />
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
                      className="text-sm font-normal text-card-foreground flex-grow cursor-pointer truncate pl-2 flex justify-between items-center"
                      title={model.name || model.id}
                      onClick={
                        onModelClick ? () => onModelClick(model.id) : undefined
                      }
                    >
                      <span className="truncate">
                        {model.name || model.id}
                      </span>
                      <div className="flex gap-1 ml-2 flex-shrink-0">
                        {model.supported_parameters?.includes("reasoning") && (
                          <Brain className="h-3.5 w-3.5 text-purple-500" />
                        )}
                        {(model.supported_parameters?.includes("web_search") ||
                          model.supported_parameters?.includes("web_search_options")) && (
                          <Globe className="h-3.5 w-3.5 text-blue-500" />
                        )}
                        {model.supported_parameters?.includes("tools") && (
                          <Wrench className="h-3.5 w-3.5 text-orange-500" />
                        )}
                        {model.architecture?.input_modalities?.some(
                          (mod) => mod !== "text"
                        ) && <ImageIcon className="h-3.5 w-3.5 text-green-500" />}
                        {model.architecture?.output_modalities?.includes("image") && (
                          <Palette className="h-3.5 w-3.5 text-pink-500" />
                        )}
                      </div>
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
