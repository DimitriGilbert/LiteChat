import React, { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ChevronsUpDown,
  Search as SearchIconLucide,
  Image as ImageIcon,
  Brain,
  Globe,
  Wrench,
  Palette,
  ArrowUpDown,
} from "lucide-react";
import type { ModelListItem } from "@/types/litechat/provider";
import { useTranslation } from "react-i18next";

interface ModelSelectorProps {
  models: ModelListItem[];
  value?: string | null;
  onChange?: (newModelId: string | null) => void;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

type CapabilityFilter =
  | "reasoning"
  | "webSearch"
  | "tools"
  | "multimodal"
  | "imageGeneration";

type SortField =
  | "name"
  | "price_input"
  | "price_output"
  | "context_length"
  | "created";
type SortDirection = "asc" | "desc";

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models: modelsFromSource,
  value: currentValue,
  onChange: handleChange,
  className,
  disabled,
  isLoading,
}) => {
  const { t } = useTranslation('controls');
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [sortActive, setSortActive] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [capabilityFilters, setCapabilityFilters] = useState<
    Record<CapabilityFilter, boolean>
  >({
    reasoning: false,
    webSearch: false,
    tools: false,
    multimodal: false,
    imageGeneration: false,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const getModelPrice = useCallback(
    (model: ModelListItem, type: "input" | "output"): number => {
      const pricing = model.metadataSummary?.pricing;
      if (!pricing) return 0;
      const priceField = type === "input" ? "prompt" : "completion";
      return parseFloat(pricing[priceField] || "0");
    },
    []
  );

  const filteredModels = useMemo(() => {
    let textFiltered = modelsFromSource;
    if (filterText.trim()) {
      const lowerFilter = filterText.toLowerCase();
      textFiltered = modelsFromSource.filter(
        (model) =>
          model.name.toLowerCase().includes(lowerFilter) ||
          model.providerName.toLowerCase().includes(lowerFilter) ||
          model.id.toLowerCase().includes(lowerFilter)
      );
    }

    const activeCapabilityFilters = Object.entries(capabilityFilters)
      .filter(([, isActive]) => isActive)
      .map(([key]) => key as CapabilityFilter);

    if (activeCapabilityFilters.length > 0) {
      textFiltered = textFiltered.filter((model: ModelListItem) => {
        const supportedParams = new Set(
          model.metadataSummary?.supported_parameters ?? []
        );
        const inputModalities = new Set(
          model.metadataSummary?.input_modalities ?? []
        );
        const outputModalities = new Set(
          model.metadataSummary?.output_modalities ?? []
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
            case "imageGeneration":
              return outputModalities.has("image");
            default:
              return true;
          }
        });
      });
    }

    if (!sortActive) {
      return textFiltered;
    }
    // Apply sorting
    const sorted = [...textFiltered].sort((a, b) => {
      let aValue: any, bValue: any;
      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "price_input":
          aValue = getModelPrice(a, "input");
          bValue = getModelPrice(b, "input");
          break;
        case "price_output":
          aValue = getModelPrice(a, "output");
          bValue = getModelPrice(b, "output");
          break;
        case "context_length":
          aValue = a.metadataSummary?.context_length || 0;
          bValue = b.metadataSummary?.context_length || 0;
          break;
        case "created":
          aValue = a.metadataSummary?.created || 0;
          bValue = b.metadataSummary?.created || 0;
          break;
        default:
          return 0;
      }
      if (aValue === bValue) return 0;
      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [
    modelsFromSource,
    filterText,
    capabilityFilters,
    sortActive,
    sortField,
    sortDirection,
    getModelPrice,
  ]);

  const selectedModelDetails = useMemo(() => {
    return modelsFromSource.find((m: ModelListItem) => m.id === currentValue);
  }, [modelsFromSource, currentValue]);

  const handleSelect = useCallback(
    (currentValFromCommand: string) => {
      const newValue =
        currentValFromCommand === currentValue ? null : currentValFromCommand;
      handleChange?.(newValue);
      setOpen(false);
      setFilterText("");
    },
    [currentValue, handleChange]
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

  const activeCapabilityFilterCount =
    Object.values(capabilityFilters).filter(Boolean).length;
  const totalActiveFilters = activeCapabilityFilterCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || modelsFromSource.length === 0}
          className={cn(
            "w-auto justify-between h-9 text-sm font-normal relative",
            className
          )}
          ref={triggerRef}
        >
          <span className="truncate max-w-[200px] sm:max-w-[300px]">
            {selectedModelDetails
              ? `${selectedModelDetails.name} (${selectedModelDetails.providerName})`
              : t('modelSelector.selectModel')}
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
          <div className="flex items-center border-b px-3 gap-2">
            <SearchIconLucide className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={t('modelSelector.searchPlaceholder')}
              value={filterText}
              onValueChange={setFilterText}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="flex items-center gap-0.5 ml-auto pl-2">
              <Button
                variant={sortActive ? "secondary" : "ghost"}
                size="sm"
                className="h-7 w-7 p-0"
                title={t('modelSelector.sortTitle')}
                aria-label={t('modelSelector.sortAriaLabel')}
                onClick={() => setSortActive((v) => !v)}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
              {sortActive && (
                <select
                  className="ml-2 h-8 text-xs border rounded px-1 bg-background"
                  value={`${sortField}:${sortDirection}`}
                  autoFocus
                  onBlur={() => setSortActive(false)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split(":");
                    setSortField(field as SortField);
                    setSortDirection(direction as SortDirection);
                  }}
                  style={{ minWidth: 120 }}
                  aria-label={t('modelSelector.sortAriaLabel')}
                >
                  <option value="name:asc">{t('modelSelector.sortOptions.nameAsc')}</option>
                  <option value="name:desc">{t('modelSelector.sortOptions.nameDesc')}</option>
                  <option value="price_input:asc">
                    {t('modelSelector.sortOptions.inputPriceAsc')}
                  </option>
                  <option value="price_input:desc">
                    {t('modelSelector.sortOptions.inputPriceDesc')}
                  </option>
                  <option value="price_output:asc">
                    {t('modelSelector.sortOptions.outputPriceAsc')}
                  </option>
                  <option value="price_output:desc">
                    {t('modelSelector.sortOptions.outputPriceDesc')}
                  </option>
                  <option value="context_length:desc">
                    {t('modelSelector.sortOptions.contextLengthDesc')}
                  </option>
                  <option value="context_length:asc">
                    {t('modelSelector.sortOptions.contextLengthAsc')}
                  </option>
                  <option value="created:desc">{t('modelSelector.sortOptions.releaseDateDesc')}</option>
                  <option value="created:asc">{t('modelSelector.sortOptions.releaseDateAsc')}</option>
                </select>
              )}
              <Button
                variant={capabilityFilters.reasoning ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.reasoning && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("reasoning")}
                title={t('modelSelector.filterTitles.reasoning')}
                aria-label={t('modelSelector.filterAriaLabels.reasoning')}
              >
                <Brain className="h-4 w-4" />
              </Button>
              <Button
                variant={capabilityFilters.webSearch ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.webSearch && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("webSearch")}
                title={t('modelSelector.filterTitles.webSearch')}
                aria-label={t('modelSelector.filterAriaLabels.webSearch')}
              >
                <Globe className="h-4 w-4" />
              </Button>
              <Button
                variant={capabilityFilters.tools ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.tools && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("tools")}
                title={t('modelSelector.filterTitles.tools')}
                aria-label={t('modelSelector.filterAriaLabels.tools')}
              >
                <Wrench className="h-4 w-4" />
              </Button>
              <Button
                variant={capabilityFilters.multimodal ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.multimodal && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("multimodal")}
                title={t('modelSelector.filterTitles.multimodal')}
                aria-label={t('modelSelector.filterAriaLabels.multimodal')}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={
                  capabilityFilters.imageGeneration ? "secondary" : "ghost"
                }
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  capabilityFilters.imageGeneration && "text-primary"
                )}
                onClick={() => toggleCapabilityFilter("imageGeneration")}
                title={t('modelSelector.filterTitles.imageGeneration')}
                aria-label={t('modelSelector.filterAriaLabels.imageGeneration')}
              >
                <Palette className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CommandList className="max-h-[calc(min(40vh,400px)-70px)] overflow-y-auto">
            <CommandEmpty>
              {totalActiveFilters > 0
                ? t('modelSelector.emptyState.noMatch')
                : modelsFromSource.length === 0
                ? t('modelSelector.emptyState.noModels')
                : t('modelSelector.emptyState.notFound')}
            </CommandEmpty>
            <CommandGroup>
              {filteredModels.map((model: ModelListItem) => (
                <CommandItem
                  key={model.id}
                  value={model.id}
                  onSelect={handleSelect}
                  className="flex items-center"
                >
                  <div className="flex-1 truncate flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {model.providerName}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {model.metadataSummary?.supported_parameters?.includes(
                        "reasoning"
                      ) && <Brain className="h-3.5 w-3.5 text-purple-500" />}
                      {(model.metadataSummary?.supported_parameters?.includes(
                        "web_search"
                      ) ||
                        model.metadataSummary?.supported_parameters?.includes(
                          "web_search_options"
                        )) && <Globe className="h-3.5 w-3.5 text-blue-500" />}
                      {model.metadataSummary?.supported_parameters?.includes(
                        "tools"
                      ) && <Wrench className="h-3.5 w-3.5 text-orange-500" />}
                      {model.metadataSummary?.input_modalities?.some(
                        (mod) => mod !== "text"
                      ) && <ImageIcon className="h-3.5 w-3.5 text-green-500" />}
                      {model.metadataSummary?.output_modalities?.includes(
                        "image"
                      ) && <Palette className="h-3.5 w-3.5 text-pink-500" />}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
