// src/services/marketplace.service.ts

import type { 
  MarketplaceSource, 
  MarketplaceIndex, 
  MarketplaceItem, 
  MarketplacePackage 
} from "@/types/litechat/marketplace";
import { emitter } from "@/lib/litechat/event-emitter";
import { PersistenceService } from "./persistence.service";

export class MarketplaceService {
  private static instance: MarketplaceService;
  private refreshPromises = new Map<string, Promise<MarketplaceIndex>>();

  public static getInstance(): MarketplaceService {
    if (!MarketplaceService.instance) {
      MarketplaceService.instance = new MarketplaceService();
    }
    return MarketplaceService.instance;
  }

  /**
   * Fetch marketplace index from a source URL
   */
  async fetchMarketplaceIndex(source: MarketplaceSource): Promise<MarketplaceIndex> {
    try {
      const response = await fetch(source.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch marketplace: ${response.status} ${response.statusText}`);
      }

      const indexData = await response.json();
      
      // Validate the index structure
      if (!indexData.name || !indexData.version || !Array.isArray(indexData.items)) {
        throw new Error('Invalid marketplace index format');
      }

      const marketplaceIndex: MarketplaceIndex = {
        name: indexData.name,
        version: indexData.version,
        description: indexData.description || '',
        lastUpdated: new Date(indexData.lastUpdated || new Date().toISOString()),
        items: indexData.items.map((item: Partial<MarketplaceItem>) => ({
          id: item.id || '',
          name: item.name || '',
          type: item.type || 'rule',
          description: item.description || '',
          version: item.version || '1.0.0',
          author: item.author || '',
          downloadUrl: item.downloadUrl || '',
          tags: item.tags || [],
          dependencies: item.dependencies || [],
          lastUpdated: new Date(item.lastUpdated || new Date().toISOString())
        } as MarketplaceItem))
      };

      // Cache the index in database
      await PersistenceService.saveMarketplaceIndex(source.id!, marketplaceIndex);

      emitter.emit('marketplace:index-refreshed', { sourceId: source.id!, index: marketplaceIndex });
      
      return marketplaceIndex;

    } catch (error) {
      console.error(`Failed to fetch marketplace index from ${source.url}:`, error);
      emitter.emit('marketplace:refresh-failed', { 
        sourceId: source.id!, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Refresh marketplace index for a source (with deduplication)
   */
  async refreshMarketplaceIndex(source: MarketplaceSource): Promise<MarketplaceIndex> {
    // Prevent duplicate refresh requests
    const existingPromise = this.refreshPromises.get(source.url);
    if (existingPromise) {
      return existingPromise;
    }

    const refreshPromise = this.fetchMarketplaceIndex(source);
    this.refreshPromises.set(source.url, refreshPromise);

    try {
      const result = await refreshPromise;
      return result;
    } finally {
      this.refreshPromises.delete(source.url);
    }
  }

  /**
   * Fetch and parse a marketplace package
   */
  async fetchMarketplacePackage(packageUrl: string): Promise<MarketplacePackage> {
    try {
      const response = await fetch(packageUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch package: ${response.status} ${response.statusText}`);
      }

      const packageData = await response.json();
      
      // Validate package structure based on type
      if (!packageData.id || !packageData.name || !packageData.type) {
        throw new Error('Invalid package format: missing required fields');
      }

      return packageData as MarketplacePackage;

    } catch (error) {
      console.error(`Failed to fetch package from ${packageUrl}:`, error);
      throw error;
    }
  }

  /**
   * Install a marketplace item
   */
  async installMarketplaceItem(
    sourceId: string, 
    item: MarketplaceItem
  ): Promise<void> {
    try {
      emitter.emit('marketplace:install-started', { sourceId, item });

      // Fetch the package
      const packageData = await this.fetchMarketplacePackage(item.downloadUrl);

      // Validate package matches item
      if (packageData.metadata.id !== item.id) {
        throw new Error('Package ID mismatch');
      }

      // Import the package based on type
      switch (item.type) {
        case 'rule':
          await this.importRule(packageData);
          break;
        case 'template':
          await this.importPromptTemplate(packageData);
          break;
        case 'agent':
          await this.importAgent(packageData);
          break;
        case 'workflow':
          await this.importWorkflow(packageData);
          break;
        case 'mcp-server':
          await this.importMcpServer(packageData);
          break;
        default:
          throw new Error(`Unsupported package type: ${item.type}`);
      }

      // Mark as installed
      await PersistenceService.saveInstalledMarketplaceItem({
        packageId: item.id,
        sourceId,
        installedAt: new Date(),
        enabled: true,
        version: item.version,
        installedRules: [],
        installedTemplates: [],
        installedMcpServers: []
      }, packageData);

      emitter.emit('marketplace:install-completed', { sourceId, item });

    } catch (error) {
      console.error(`Failed to install marketplace item ${item.id}:`, error);
      emitter.emit('marketplace:install-failed', { 
        sourceId, 
        item, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Uninstall a marketplace item
   */
  async uninstallMarketplaceItem(
    sourceId: string, 
    item: MarketplaceItem
  ): Promise<void> {
    try {
      emitter.emit('marketplace:uninstall-started', { sourceId, item });

      // Remove from installed items
      const installedItems = await PersistenceService.loadInstalledMarketplaceItems();
      const itemToRemove = installedItems.find(
        (installed: { packageId: string; sourceId: string; id?: string }) => installed.packageId === item.id && installed.sourceId === sourceId
      );

      if (itemToRemove) {
        await PersistenceService.deleteInstalledMarketplaceItem(itemToRemove.packageId);
      }

      // Note: We don't remove the actual imported content (rules, templates, etc.)
      // as it might be used independently. The user can manually remove if needed.

      emitter.emit('marketplace:uninstall-completed', { sourceId, item });

    } catch (error) {
      console.error(`Failed to uninstall marketplace item ${item.id}:`, error);
      emitter.emit('marketplace:uninstall-failed', { 
        sourceId, 
        item, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Check if an item is already installed
   */
  async isItemInstalled(sourceId: string, itemId: string): Promise<boolean> {
    const installedItems = await PersistenceService.loadInstalledMarketplaceItems();
    return installedItems.some(
      (installed: { packageId: string; sourceId: string }) => installed.packageId === itemId && installed.sourceId === sourceId
    );
  }

  /**
   * Get cached marketplace index or fetch if expired
   */
  async getMarketplaceIndex(source: MarketplaceSource): Promise<MarketplaceIndex | null> {
    try {
      const cachedIndex = await PersistenceService.loadMarketplaceIndex(source.id!);
      
      // Cache validity is already checked in the persistence service
      if (cachedIndex) {
        return cachedIndex;
      }

      // Cache expired or doesn't exist, fetch fresh
      return await this.refreshMarketplaceIndex(source);

    } catch (error) {
      console.error(`Failed to get marketplace index for source ${source.name}:`, error);
      return null;
    }
  }

  // Private methods for importing different package types

  private async importRule(packageData: MarketplacePackage): Promise<void> {
    // Import rule using existing rules store/service
    emitter.emit('rules:import-rule', { rule: packageData.content });
  }

  private async importPromptTemplate(packageData: MarketplacePackage): Promise<void> {
    // Import prompt template using existing prompt template store
    emitter.emit('prompt-templates:import-template', { template: packageData.content });
  }

  private async importAgent(packageData: MarketplacePackage): Promise<void> {
    // Import agent configuration
    emitter.emit('agents:import-agent', { agent: packageData.content });
  }

  private async importWorkflow(packageData: MarketplacePackage): Promise<void> {
    // Import workflow using existing workflow store
    emitter.emit('workflows:import-workflow', { workflow: packageData.content });
  }

  private async importMcpServer(packageData: MarketplacePackage): Promise<void> {
    // Import MCP server configuration
    emitter.emit('mcp:import-server', { server: packageData.content });
  }
}

export const marketplaceService = MarketplaceService.getInstance();