// src/types/litechat/events/marketplace.events.ts

import type { 
  MarketplaceSource, 
  MarketplaceItem, 
  InstalledMarketplaceItem,
  MarketplaceItemType
} from "@/types/litechat/marketplace";

export const marketplaceEvent = {
  // Source management
  addMarketplaceSourceRequest: "marketplace.add.source.request",
  marketplaceSourceAdded: "marketplace.source.added",
  updateMarketplaceSourceRequest: "marketplace.update.source.request",
  marketplaceSourceUpdated: "marketplace.source.updated",
  deleteMarketplaceSourceRequest: "marketplace.delete.source.request",
  marketplaceSourceDeleted: "marketplace.source.deleted",
  marketplaceSourcesLoaded: "marketplace.sources.loaded",
  
  // Refresh
  refreshAllMarketplacesRequest: "marketplace.refresh.all.request",
  refreshMarketplaceRequest: "marketplace.refresh.marketplace.request",
  marketplaceRefreshed: "marketplace.refreshed",
  marketplaceRefreshFailed: "marketplace.refresh.failed",
  
  // Installation
  installMarketplaceItemRequest: "marketplace.install.item.request",
  marketplaceItemInstalled: "marketplace.item.installed",
  marketplaceItemInstallFailed: "marketplace.item.install.failed",
  uninstallMarketplaceItemRequest: "marketplace.uninstall.item.request",
  marketplaceItemUninstalled: "marketplace.item.uninstalled",
  enableMarketplaceItemRequest: "marketplace.enable.item.request",
  marketplaceItemEnabledChanged: "marketplace.item.enabled.changed",
  
  // Search and filtering
  setSearchQueryRequest: "marketplace.set.search.query.request",
  searchQueryChanged: "marketplace.search.query.changed",
  setSelectedCategoryRequest: "marketplace.set.selected.category.request",
  selectedCategoryChanged: "marketplace.selected.category.changed",
  setSelectedTypeRequest: "marketplace.set.selected.type.request",
  selectedTypeChanged: "marketplace.selected.type.changed",
  
  // Data loading
  loadMarketplaceDataRequest: "marketplace.load.data.request",
  marketplaceDataLoaded: "marketplace.data.loaded",
  installedItemsLoaded: "marketplace.installed.items.loaded",
  
} as const;

export interface MarketplaceEventPayloads {
  [marketplaceEvent.addMarketplaceSourceRequest]: { 
    source: Omit<MarketplaceSource, "id" | "createdAt"> 
  };
  [marketplaceEvent.marketplaceSourceAdded]: { 
    source: MarketplaceSource 
  };
  [marketplaceEvent.updateMarketplaceSourceRequest]: { 
    id: string; 
    updates: Partial<Omit<MarketplaceSource, "id" | "createdAt">> 
  };
  [marketplaceEvent.marketplaceSourceUpdated]: { 
    source: MarketplaceSource 
  };
  [marketplaceEvent.deleteMarketplaceSourceRequest]: { 
    id: string 
  };
  [marketplaceEvent.marketplaceSourceDeleted]: { 
    id: string 
  };
  [marketplaceEvent.marketplaceSourcesLoaded]: { 
    sources: MarketplaceSource[] 
  };
  
  [marketplaceEvent.refreshAllMarketplacesRequest]: {};
  [marketplaceEvent.refreshMarketplaceRequest]: { 
    sourceId: string 
  };
  [marketplaceEvent.marketplaceRefreshed]: { 
    sourceId: string; 
    itemCount: number 
  };
  [marketplaceEvent.marketplaceRefreshFailed]: { 
    sourceId: string; 
    error: string 
  };
  
  [marketplaceEvent.installMarketplaceItemRequest]: { 
    sourceId: string; 
    itemId: string 
  };
  [marketplaceEvent.marketplaceItemInstalled]: { 
    packageId: string; 
    item: MarketplaceItem;
    installedItem: InstalledMarketplaceItem;
  };
  [marketplaceEvent.marketplaceItemInstallFailed]: { 
    sourceId: string; 
    itemId: string; 
    error: string 
  };
  [marketplaceEvent.uninstallMarketplaceItemRequest]: { 
    packageId: string 
  };
  [marketplaceEvent.marketplaceItemUninstalled]: { 
    packageId: string 
  };
  [marketplaceEvent.enableMarketplaceItemRequest]: { 
    packageId: string; 
    enabled: boolean 
  };
  [marketplaceEvent.marketplaceItemEnabledChanged]: { 
    packageId: string; 
    enabled: boolean 
  };
  
  [marketplaceEvent.setSearchQueryRequest]: { 
    query: string 
  };
  [marketplaceEvent.searchQueryChanged]: { 
    query: string 
  };
  [marketplaceEvent.setSelectedCategoryRequest]: { 
    category: string | null 
  };
  [marketplaceEvent.selectedCategoryChanged]: { 
    category: string | null 
  };
  [marketplaceEvent.setSelectedTypeRequest]: { 
    type: MarketplaceItemType | null 
  };
  [marketplaceEvent.selectedTypeChanged]: { 
    type: MarketplaceItemType | null 
  };
  
  [marketplaceEvent.loadMarketplaceDataRequest]: {};
  [marketplaceEvent.marketplaceDataLoaded]: { 
    sources: MarketplaceSource[];
    installedItems: InstalledMarketplaceItem[];
  };
  [marketplaceEvent.installedItemsLoaded]: { 
    items: InstalledMarketplaceItem[] 
  };
}