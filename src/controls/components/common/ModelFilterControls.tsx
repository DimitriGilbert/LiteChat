import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FilterIcon, BrainCircuitIcon, SearchIcon, WrenchIcon, ImageIcon, CheckIcon, BanIcon, DollarSignIcon, ArrowUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActionTooltipButton } from "@/components/LiteChat/common/ActionTooltipButton";
import { cn } from "@/lib/utils";
import { DbProviderConfig } from "@/types/litechat/provider";
import { useTranslation } from "react-i18next";

type CapabilityFilter = "reasoning" | "webSearch" | "tools" | "multimodal";
type EnabledFilterStatus = "all" | "enabled" | "disabled";

type SortField = "name" | "price_input" | "price_output" | "context_length" | "created";
type SortDirection = "asc" | "desc";

interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface ModelFilterControlsProps {
  // State from parent
  currentCapabilityFilters: Record<CapabilityFilter, boolean>;
  currentSelectedProviders?: Set<string>; // Optional, for provider filter
  currentEnabledFilter?: EnabledFilterStatus; // Optional, for status filter
  currentMinInputPrice?: string; // Optional, for price filter
  currentMaxInputPrice?: string; // Optional, for price filter
  currentMinOutputPrice?: string; // Optional, for price filter
  currentMaxOutputPrice?: string; // Optional, for price filter
  allProviders?: DbProviderConfig[]; // Optional, for provider filter
  currentSort?: SortState; // Optional, for sorting

  // Callbacks to update parent state
  onCapabilityFilterChange: (filters: Record<CapabilityFilter, boolean>) => void;
  onSortChange?: (sort: SortState) => void;
  onProviderFilterChange?: (selectedProviderIds: Set<string>) => void;
  onEnabledFilterChange?: (status: EnabledFilterStatus) => void;
  onPriceFilterChange?: (minIn: string, maxIn: string, minOut: string, maxOut: string) => void;

  // Configuration for display
  showCapabilityFilters?: boolean;
  showProviderFilter?: boolean;
  showStatusFilter?: boolean;
  showPriceFilters?: boolean;
  showSortControls?: boolean;

  disabled?: boolean;
  totalActiveFilters: number; // Calculated by parent
}

export const ModelFilterControls: React.FC<ModelFilterControlsProps> = ({
  currentCapabilityFilters,
  onCapabilityFilterChange,
  currentSelectedProviders,
  onProviderFilterChange,
  currentEnabledFilter,
  onEnabledFilterChange,
  currentMinInputPrice,
  currentMaxInputPrice,
  currentMinOutputPrice,
  currentMaxOutputPrice,
  onPriceFilterChange,
  allProviders,
  currentSort,
  onSortChange,
  showCapabilityFilters = true,
  showProviderFilter = false,
  showStatusFilter = false,
  showPriceFilters = false,
  showSortControls = false,
  disabled = false,
  totalActiveFilters,
}) => {
  const { t } = useTranslation('controls');
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);

  const toggleCapabilityFilter = useCallback((filter: CapabilityFilter) => {
    onCapabilityFilterChange({
      ...currentCapabilityFilters,
      [filter]: !currentCapabilityFilters[filter],
    });
  }, [currentCapabilityFilters, onCapabilityFilterChange]);

  const handleProviderCheckboxChange = useCallback(
    (providerId: string, checked: boolean) => {
      if (!currentSelectedProviders || !onProviderFilterChange) return;
      const next = new Set(currentSelectedProviders);
      if (checked) next.add(providerId);
      else next.delete(providerId);
      onProviderFilterChange(next);
    },
    [currentSelectedProviders, onProviderFilterChange]
  );

  const handlePriceInputChange = useCallback((type: 'minInput' | 'maxInput' | 'minOutput' | 'maxOutput', value: string) => {
    if (!onPriceFilterChange) return;
    const minIn = type === 'minInput' ? value : (currentMinInputPrice ?? '');
    const maxIn = type === 'maxInput' ? value : (currentMaxInputPrice ?? '');
    const minOut = type === 'minOutput' ? value : (currentMinOutputPrice ?? '');
    const maxOut = type === 'maxOutput' ? value : (currentMaxOutputPrice ?? '');
    onPriceFilterChange(minIn, maxIn, minOut, maxOut);
  }, [onPriceFilterChange, currentMinInputPrice, currentMaxInputPrice, currentMinOutputPrice, currentMaxOutputPrice]);


  return (
    <div className="flex items-center gap-2">
      {showSortControls && currentSort && onSortChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3"
              disabled={disabled}
            >
              <ArrowUpDown className="h-4 w-4 mr-1" />
              {t('modelFilter.sort', 'Sort')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onSortChange({ field: "name", direction: "asc" })}>
              {t('modelFilter.nameAsc', 'Name (A-Z)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "name", direction: "desc" })}>
              {t('modelFilter.nameDesc', 'Name (Z-A)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "price_input", direction: "asc" })}>
              {t('modelFilter.inputPriceAsc', 'Input Price (Low-High)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "price_input", direction: "desc" })}>
              {t('modelFilter.inputPriceDesc', 'Input Price (High-Low)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "price_output", direction: "asc" })}>
              {t('modelFilter.outputPriceAsc', 'Output Price (Low-High)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "price_output", direction: "desc" })}>
              {t('modelFilter.outputPriceDesc', 'Output Price (High-Low)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "context_length", direction: "desc" })}>
              {t('modelFilter.contextLengthDesc', 'Context Length (High-Low)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "context_length", direction: "asc" })}>
              {t('modelFilter.contextLengthAsc', 'Context Length (Low-High)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "created", direction: "desc" })}>
              {t('modelFilter.releaseDateDesc', 'Release Date (Newest)')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange({ field: "created", direction: "asc" })}>
              {t('modelFilter.releaseDateAsc', 'Release Date (Oldest)')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      
      <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 relative"
            disabled={disabled}
          >
            <FilterIcon className="h-4 w-4 mr-1" />
            {t('modelFilter.filters', 'Filters')}
            {totalActiveFilters > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-primary rounded-full">
                {totalActiveFilters}
              </span>
            )}
          </Button>
        </PopoverTrigger>
      <PopoverContent
        className="p-4 space-y-4 w-72 bg-popover shadow-lg relative"
        align="end"
      >
        {showStatusFilter && currentEnabledFilter !== undefined && onEnabledFilterChange && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('modelFilter.status', 'Status')}</Label>
            <div className="flex gap-1">
              <Button
                variant={currentEnabledFilter === "all" ? "secondary" : "outline"}
                size="sm"
                onClick={() => onEnabledFilterChange("all")}
              >
                {t('modelFilter.all', 'All')}
              </Button>
              <Button
                variant={currentEnabledFilter === "enabled" ? "secondary" : "outline"}
                size="sm"
                onClick={() => onEnabledFilterChange("enabled")}
              >
                <CheckIcon className="h-3 w-3 mr-1" /> {t('modelFilter.enabled', 'Enabled')}
              </Button>
              <Button
                variant={currentEnabledFilter === "disabled" ? "secondary" : "outline"}
                size="sm"
                onClick={() => onEnabledFilterChange("disabled")}
              >
                <BanIcon className="h-3 w-3 mr-1" /> {t('modelFilter.disabled', 'Disabled')}
              </Button>
            </div>
          </div>
        )}

        {showProviderFilter && currentSelectedProviders && allProviders && onProviderFilterChange && (
          <div>
            <Label className="text-xs px-2 font-semibold block mb-1">
              {t('modelFilter.providers', 'Providers')}
            </Label>
            <ScrollArea className="h-32 border rounded-md p-1">
              {allProviders.map((provider: DbProviderConfig) => (
                <div
                  key={provider.id}
                  className="flex items-center space-x-2 p-1.5 rounded hover:bg-muted"
                >
                  <Checkbox
                    id={`filter-provider-${provider.id}`}
                    checked={currentSelectedProviders.has(provider.id)}
                    onCheckedChange={(checked) => {
                      handleProviderCheckboxChange(provider.id, !!checked);
                    }}
                  />
                  <Label
                    htmlFor={`filter-provider-${provider.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {provider.name} ({provider.type})
                  </Label>
                </div>
              ))}
            </ScrollArea>
          </div>
        )}

        {showCapabilityFilters && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">{t('modelFilter.capabilities', 'Capabilities')}</Label>
            <div className="flex flex-wrap gap-1">
              <ActionTooltipButton
                tooltipText={t('modelFilter.reasoning', 'Reasoning')}
                aria-label="Reasoning"
                icon={<BrainCircuitIcon />}
                onClick={() => toggleCapabilityFilter("reasoning")}
                variant={currentCapabilityFilters.reasoning ? "secondary" : "outline"}
                className={cn(currentCapabilityFilters.reasoning && "text-primary")}
              />
              <ActionTooltipButton
                tooltipText={t('modelFilter.webSearch', 'Web Search')}
                aria-label="Web Search"
                icon={<SearchIcon />}
                onClick={() => toggleCapabilityFilter("webSearch")}
                variant={currentCapabilityFilters.webSearch ? "secondary" : "outline"}
                className={cn(currentCapabilityFilters.webSearch && "text-primary")}
              />
              <ActionTooltipButton
                tooltipText={t('modelFilter.tools', 'Tools')}
                aria-label="Tools"
                icon={<WrenchIcon />}
                onClick={() => toggleCapabilityFilter("tools")}
                variant={currentCapabilityFilters.tools ? "secondary" : "outline"}
                className={cn(currentCapabilityFilters.tools && "text-primary")}
              />
              <ActionTooltipButton
                tooltipText={t('modelFilter.multimodal', 'Multimodal')}
                aria-label="Multimodal"
                icon={<ImageIcon />}
                onClick={() => toggleCapabilityFilter("multimodal")}
                variant={currentCapabilityFilters.multimodal ? "secondary" : "outline"}
                className={cn(currentCapabilityFilters.multimodal && "text-primary")}
              />
            </div>
          </div>
        )}

        {showPriceFilters && currentMinInputPrice !== undefined && onPriceFilterChange && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <DollarSignIcon className="h-3 w-3" /> {t('modelFilter.priceRange', 'Price Range ($ / 1M Tokens)')}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('modelFilter.minInput', 'Min Input')}
                value={currentMinInputPrice}
                onChange={(e) => handlePriceInputChange('minInput', e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('modelFilter.maxInput', 'Max Input')}
                value={currentMaxInputPrice}
                onChange={(e) => handlePriceInputChange('maxInput', e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('modelFilter.minOutput', 'Min Output')}
                value={currentMinOutputPrice}
                onChange={(e) => handlePriceInputChange('minOutput', e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('modelFilter.maxOutput', 'Max Output')}
                value={currentMaxOutputPrice}
                onChange={(e) => handlePriceInputChange('maxOutput', e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
    </div>
  );
};