// src/controls/components/marketplace-settings/SettingsMarketplace.tsx

import React, { useEffect } from "react";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Store, Package, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { MarketplaceSourcesList } from "./MarketplaceSourcesList";
import { AddMarketplaceSourceForm } from "./AddMarketplaceSourceForm";
import { MarketplaceBrowser } from "./MarketplaceBrowser";
import { InstalledItemsList } from "./InstalledItemsList";

const SettingsMarketplaceComponent: React.FC = () => {
  const { t } = useTranslation('settings');

  const {
    marketplaceSources,
    installedItems,
    isRefreshing,
    loadMarketplaceData,
    refreshAllMarketplaces,
  } = useMarketplaceStore(
    useShallow((state) => ({
      marketplaceSources: state.marketplaceSources,
      installedItems: state.installedItems,
      isRefreshing: state.isRefreshing,
      loadMarketplaceData: state.loadMarketplaceData,
      refreshAllMarketplaces: state.refreshAllMarketplaces,
    }))
  );

  // Load marketplace data on mount
  useEffect(() => {
    loadMarketplaceData();
  }, [loadMarketplaceData]);

  const handleRefreshAll = async () => {
    await refreshAllMarketplaces();
  };

  const installedItemsCount = Object.keys(installedItems).length;
  const enabledSourcesCount = marketplaceSources.filter(s => s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('marketplace.title', 'Marketplace')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('marketplace.description', 'Discover and install LiteChat components from various sources')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-muted-foreground">
            <div>{enabledSourcesCount} {t('marketplace.activeSources', 'active sources')}</div>
            <div>{installedItemsCount} {t('marketplace.installedItems', 'installed items')}</div>
          </div>
          <Button 
            onClick={handleRefreshAll} 
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('marketplace.refreshAll', 'Refresh All')}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Marketplace Sources Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {t('marketplace.sources.title', 'Marketplace Sources')}
          </CardTitle>
          <CardDescription>
            {t('marketplace.sources.description', 'Add marketplace URLs to discover and install LiteChat components')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MarketplaceSourcesList />
          <AddMarketplaceSourceForm />
        </CardContent>
      </Card>

      {/* Browse Marketplace Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {t('marketplace.browse.title', 'Browse Marketplace')}
          </CardTitle>
          <CardDescription>
            {t('marketplace.browse.description', 'Discover rules, templates, agents, and MCP servers')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MarketplaceBrowser />
        </CardContent>
      </Card>

      {/* Installed Items Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t('marketplace.installed.title', 'Installed Items')}
          </CardTitle>
          <CardDescription>
            {t('marketplace.installed.description', 'Manage your installed marketplace items')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstalledItemsList />
        </CardContent>
      </Card>
    </div>
  );
};

export const SettingsMarketplace = SettingsMarketplaceComponent;