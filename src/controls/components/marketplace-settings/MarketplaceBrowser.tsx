// src/controls/components/marketplace-settings/MarketplaceBrowser.tsx

import React from "react";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useShallow } from "zustand/react/shallow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MarketplaceItemCard } from "./MarketplaceItemCard";
import type { MarketplaceItemType } from "@/types/litechat/marketplace";

export const MarketplaceBrowser: React.FC = () => {
  const { t } = useTranslation('settings');

  const {
    searchQuery,
    selectedCategory,
    selectedType,
    isRefreshing,
    getFilteredItems,
    setSearchQuery,
    setSelectedCategory,
    setSelectedType,
    refreshAllMarketplaces,
  } = useMarketplaceStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      selectedCategory: state.selectedCategory,
      selectedType: state.selectedType,
      isRefreshing: state.isRefreshing,
      getFilteredItems: state.getFilteredItems,
      setSearchQuery: state.setSearchQuery,
      setSelectedCategory: state.setSelectedCategory,
      setSelectedType: state.setSelectedType,
      refreshAllMarketplaces: state.refreshAllMarketplaces,
    }))
  );

  const filteredItems = getFilteredItems();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value === "all" ? null : value);
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value === "all" ? null : (value as MarketplaceItemType));
  };

  const handleRefreshAll = async () => {
    await refreshAllMarketplaces();
  };

  // Get unique categories from available items
  const allItems = useMarketplaceStore(state => state.getAllAvailableItems());
  const categories = Array.from(new Set(allItems.map(item => item.category).filter((cat): cat is string => Boolean(cat))));

  const itemTypes = [
    { value: "rule", label: t('marketplace.types.rule', 'Rules') },
    { value: "template", label: t('marketplace.types.template', 'Templates') },
    { value: "agent", label: t('marketplace.types.agent', 'Agents') },
    { value: "workflow", label: t('marketplace.types.workflow', 'Workflows') },
    { value: "mcp-server", label: t('marketplace.types.mcpServer', 'MCP Servers') },
    { value: "config-bundle", label: t('marketplace.types.configBundle', 'Config Bundles') },
  ];

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('marketplace.browser.searchPlaceholder', 'Search marketplace...')}
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={selectedCategory || "all"} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('marketplace.browser.category', 'Category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('marketplace.browser.allCategories', 'All Categories')}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType || "all"} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder={t('marketplace.browser.type', 'Type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('marketplace.browser.allTypes', 'All Types')}</SelectItem>
              {itemTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={handleRefreshAll} 
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Results */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Filter className="h-8 w-8" />
          </div>
          <h3 className="font-medium mb-2">
            {searchQuery || selectedCategory || selectedType
              ? t('marketplace.browser.noResults', 'No items found')
              : t('marketplace.browser.noItems', 'No marketplace items available')
            }
          </h3>
          <p className="text-sm">
            {searchQuery || selectedCategory || selectedType
              ? t('marketplace.browser.tryDifferentSearch', 'Try adjusting your search or filters')
              : t('marketplace.browser.addSources', 'Add marketplace sources to discover items')
            }
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-4">
            {t('marketplace.browser.showingResults', 'Showing {{count}} items', { count: filteredItems.length })}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <MarketplaceItemCard key={`${item.sourceId}-${item.id}`} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};