// src/store/marketplace.store.ts

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { emitter } from "@/lib/litechat/event-emitter";
import { PersistenceService } from "@/services/persistence.service";
import {
  marketplaceEvent,
  type MarketplaceEventPayloads,
} from "@/types/litechat/events/marketplace.events";
import type {
  MarketplaceSource,
  MarketplaceIndex,
  MarketplaceItem,
  MarketplaceItemType,
  InstalledMarketplaceItem,
} from "@/types/litechat/marketplace";
import type { RegisteredActionHandler } from "@/types/litechat/control";

interface MarketplaceState {
  // Marketplace sources
  marketplaceSources: MarketplaceSource[];
  
  // Cached marketplace data
  marketplaceIndexes: Record<string, MarketplaceIndex>;
  
  // Installation status
  installedItems: Record<string, InstalledMarketplaceItem>;
  
  // UI state
  isRefreshing: boolean;
  refreshStatus: Record<string, "idle" | "refreshing" | "error">;
  searchQuery: string;
  selectedCategory: string | null;
  selectedType: MarketplaceItemType | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

interface MarketplaceActions {
  // Source management
  addMarketplaceSource: (source: Omit<MarketplaceSource, "id" | "createdAt">) => Promise<void>;
  updateMarketplaceSource: (id: string, updates: Partial<MarketplaceSource>) => Promise<void>;
  deleteMarketplaceSource: (id: string) => Promise<void>;
  loadMarketplaceSources: () => Promise<void>;
  
  // Refresh
  refreshAllMarketplaces: () => Promise<void>;
  refreshMarketplace: (sourceId: string) => Promise<void>;
  
  // Installation
  installMarketplaceItem: (sourceId: string, itemId: string) => Promise<void>;
  uninstallMarketplaceItem: (packageId: string) => Promise<void>;
  enableMarketplaceItem: (packageId: string, enabled: boolean) => Promise<void>;
  loadInstalledItems: () => Promise<void>;
  
  // Search and filtering
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  setSelectedType: (type: MarketplaceItemType | null) => void;
  
  // Data access
  getAllAvailableItems: () => MarketplaceItem[];
  getInstalledItems: () => InstalledMarketplaceItem[];
  getFilteredItems: () => MarketplaceItem[];
  
  // Initialization
  loadMarketplaceData: () => Promise<void>;
  
  // Event integration
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

const DEFAULT_MARKETPLACE_SOURCES: MarketplaceSource[] = [
  {
    id: "official-litechat",
    name: "Official LiteChat Marketplace",
    url: "https://litechat.dev/marketplace/index.json",
    enabled: true,
    createdAt: new Date(),
  },
];

export const useMarketplaceStore = create(
  immer<MarketplaceState & MarketplaceActions>((set, get) => ({
    // Initial state
    marketplaceSources: [],
    marketplaceIndexes: {},
    installedItems: {},
    isRefreshing: false,
    refreshStatus: {},
    searchQuery: "",
    selectedCategory: null,
    selectedType: null,
    isLoading: false,
    error: null,

    // Source management
    addMarketplaceSource: async (sourceData) => {
      try {
        const source: MarketplaceSource = {
          ...sourceData,
          id: nanoid(),
          createdAt: new Date(),
        };
        
        await PersistenceService.saveMarketplaceSource(source);
        
        set((state) => {
          state.marketplaceSources.push(source);
        });
        
        emitter.emit(marketplaceEvent.marketplaceSourceAdded, { source });
        toast.success(`Marketplace source "${source.name}" added successfully.`);
        
        // Auto-refresh the new source
        await get().refreshMarketplace(source.id);
      } catch (error: any) {
        console.error("Failed to add marketplace source:", error);
        set((state) => {
          state.error = error.message;
        });
        toast.error(`Failed to add marketplace source: ${error.message}`);
      }
    },

    updateMarketplaceSource: async (id, updates) => {
      try {
        const existingSource = get().marketplaceSources.find(s => s.id === id);
        if (!existingSource) {
          throw new Error("Marketplace source not found");
        }
        
        const updatedSource = { ...existingSource, ...updates };
        await PersistenceService.saveMarketplaceSource(updatedSource);
        
        set((state) => {
          const index = state.marketplaceSources.findIndex(s => s.id === id);
          if (index !== -1) {
            state.marketplaceSources[index] = updatedSource;
          }
        });
        
        emitter.emit(marketplaceEvent.marketplaceSourceUpdated, { source: updatedSource });
        toast.success(`Marketplace source "${updatedSource.name}" updated successfully.`);
      } catch (error: any) {
        console.error("Failed to update marketplace source:", error);
        set((state) => {
          state.error = error.message;
        });
        toast.error(`Failed to update marketplace source: ${error.message}`);
      }
    },

    deleteMarketplaceSource: async (id) => {
      try {
        await PersistenceService.deleteMarketplaceSource(id);
        
        set((state) => {
          state.marketplaceSources = state.marketplaceSources.filter(s => s.id !== id);
          // Remove cached index
          delete state.marketplaceIndexes[id];
          // Remove refresh status
          delete state.refreshStatus[id];
          // Remove installed items from this source
          Object.keys(state.installedItems).forEach(packageId => {
            if (state.installedItems[packageId].sourceId === id) {
              delete state.installedItems[packageId];
            }
          });
        });
        
        emitter.emit(marketplaceEvent.marketplaceSourceDeleted, { id });
        toast.success("Marketplace source deleted successfully.");
      } catch (error: any) {
        console.error("Failed to delete marketplace source:", error);
        set((state) => {
          state.error = error.message;
        });
        toast.error(`Failed to delete marketplace source: ${error.message}`);
      }
    },

    loadMarketplaceSources: async () => {
      try {
        set((state) => {
          state.isLoading = true;
          state.error = null;
        });
        
        const sources = await PersistenceService.loadMarketplaceSources();
        
        // If no sources exist, add the default one
        if (sources.length === 0) {
          for (const defaultSource of DEFAULT_MARKETPLACE_SOURCES) {
            await PersistenceService.saveMarketplaceSource(defaultSource);
            sources.push(defaultSource);
          }
        }
        
        set((state) => {
          state.marketplaceSources = sources;
          state.isLoading = false;
        });
        
        emitter.emit(marketplaceEvent.marketplaceSourcesLoaded, { sources });
      } catch (error: any) {
        console.error("Failed to load marketplace sources:", error);
        set((state) => {
          state.error = error.message;
          state.isLoading = false;
        });
      }
    },

    // Refresh functionality will be implemented in the MarketplaceService
    refreshAllMarketplaces: async () => {
      const sources = get().marketplaceSources.filter(s => s.enabled);
      for (const source of sources) {
        await get().refreshMarketplace(source.id);
      }
    },

    refreshMarketplace: async (sourceId) => {
      // This will be implemented with the MarketplaceService
      console.log("Refresh marketplace:", sourceId);
      set((state) => {
        state.refreshStatus[sourceId] = "refreshing";
      });
      
      // For now, just set back to idle
      setTimeout(() => {
        set((state) => {
          state.refreshStatus[sourceId] = "idle";
        });
      }, 1000);
    },

    // Installation methods will be implemented with MarketplaceService
    installMarketplaceItem: async (sourceId, itemId) => {
      console.log("Install marketplace item:", sourceId, itemId);
    },

    uninstallMarketplaceItem: async (packageId) => {
      console.log("Uninstall marketplace item:", packageId);
    },

    enableMarketplaceItem: async (packageId, enabled) => {
      try {
        await PersistenceService.updateInstalledMarketplaceItem(packageId, { enabled });
        
        set((state) => {
          if (state.installedItems[packageId]) {
            state.installedItems[packageId].enabled = enabled;
          }
        });
        
        emitter.emit(marketplaceEvent.marketplaceItemEnabledChanged, { packageId, enabled });
        toast.success(`Marketplace item ${enabled ? 'enabled' : 'disabled'} successfully.`);
      } catch (error: any) {
        console.error("Failed to update marketplace item:", error);
        toast.error(`Failed to update marketplace item: ${error.message}`);
      }
    },

    loadInstalledItems: async () => {
      try {
        const items = await PersistenceService.loadInstalledMarketplaceItems();
        const itemsRecord: Record<string, InstalledMarketplaceItem> = {};
        items.forEach(item => {
          itemsRecord[item.packageId] = item;
        });
        
        set((state) => {
          state.installedItems = itemsRecord;
        });
        
        emitter.emit(marketplaceEvent.installedItemsLoaded, { items });
      } catch (error: any) {
        console.error("Failed to load installed marketplace items:", error);
        set((state) => {
          state.error = error.message;
        });
      }
    },

    // Search and filtering
    setSearchQuery: (query) => {
      set((state) => {
        state.searchQuery = query;
      });
      emitter.emit(marketplaceEvent.searchQueryChanged, { query });
    },

    setSelectedCategory: (category) => {
      set((state) => {
        state.selectedCategory = category;
      });
      emitter.emit(marketplaceEvent.selectedCategoryChanged, { category });
    },

    setSelectedType: (type) => {
      set((state) => {
        state.selectedType = type;
      });
      emitter.emit(marketplaceEvent.selectedTypeChanged, { type });
    },

    // Data access
    getAllAvailableItems: () => {
      const state = get();
      const allItems: MarketplaceItem[] = [];
      
      Object.values(state.marketplaceIndexes).forEach(index => {
        index.items.forEach(item => {
          allItems.push(item);
        });
      });
      
      return allItems;
    },

    getInstalledItems: () => {
      return Object.values(get().installedItems);
    },

    getFilteredItems: () => {
      const state = get();
      let items = state.getAllAvailableItems();
      
      // Apply search filter
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        items = items.filter(item => 
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.tags?.some(tag => tag.toLowerCase().includes(query))
        );
      }
      
      // Apply category filter
      if (state.selectedCategory && state.selectedCategory !== "all") {
        items = items.filter(item => item.category === state.selectedCategory);
      }
      
      // Apply type filter
      if (state.selectedType) {
        items = items.filter(item => item.type === state.selectedType);
      }
      
      return items;
    },

    // Initialization
    loadMarketplaceData: async () => {
      await Promise.all([
        get().loadMarketplaceSources(),
        get().loadInstalledItems(),
      ]);
      
      const { marketplaceSources, installedItems } = get();
      emitter.emit(marketplaceEvent.marketplaceDataLoaded, { 
        sources: marketplaceSources,
        installedItems: Object.values(installedItems)
      });
    },

    // Event integration
    getRegisteredActionHandlers: () => {
      const actions = get();
      const storeId = "marketplaceStore";
      
      return [
        {
          eventName: marketplaceEvent.addMarketplaceSourceRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.addMarketplaceSourceRequest]) =>
            actions.addMarketplaceSource(payload.source),
          storeId,
        },
        {
          eventName: marketplaceEvent.updateMarketplaceSourceRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.updateMarketplaceSourceRequest]) =>
            actions.updateMarketplaceSource(payload.id, payload.updates),
          storeId,
        },
        {
          eventName: marketplaceEvent.deleteMarketplaceSourceRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.deleteMarketplaceSourceRequest]) =>
            actions.deleteMarketplaceSource(payload.id),
          storeId,
        },
        {
          eventName: marketplaceEvent.refreshAllMarketplacesRequest,
          handler: () => actions.refreshAllMarketplaces(),
          storeId,
        },
        {
          eventName: marketplaceEvent.refreshMarketplaceRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.refreshMarketplaceRequest]) =>
            actions.refreshMarketplace(payload.sourceId),
          storeId,
        },
        {
          eventName: marketplaceEvent.installMarketplaceItemRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.installMarketplaceItemRequest]) =>
            actions.installMarketplaceItem(payload.sourceId, payload.itemId),
          storeId,
        },
        {
          eventName: marketplaceEvent.uninstallMarketplaceItemRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.uninstallMarketplaceItemRequest]) =>
            actions.uninstallMarketplaceItem(payload.packageId),
          storeId,
        },
        {
          eventName: marketplaceEvent.enableMarketplaceItemRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.enableMarketplaceItemRequest]) =>
            actions.enableMarketplaceItem(payload.packageId, payload.enabled),
          storeId,
        },
        {
          eventName: marketplaceEvent.setSearchQueryRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.setSearchQueryRequest]) =>
            actions.setSearchQuery(payload.query),
          storeId,
        },
        {
          eventName: marketplaceEvent.setSelectedCategoryRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.setSelectedCategoryRequest]) =>
            actions.setSelectedCategory(payload.category),
          storeId,
        },
        {
          eventName: marketplaceEvent.setSelectedTypeRequest,
          handler: (payload: MarketplaceEventPayloads[typeof marketplaceEvent.setSelectedTypeRequest]) =>
            actions.setSelectedType(payload.type),
          storeId,
        },
        {
          eventName: marketplaceEvent.loadMarketplaceDataRequest,
          handler: () => actions.loadMarketplaceData(),
          storeId,
        },
      ];
    },
  }))
);