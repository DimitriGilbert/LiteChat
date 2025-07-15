// src/controls/components/marketplace-settings/MarketplaceSourcesList.tsx

import React from "react";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, RefreshCw, Trash2, Edit, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";

export const MarketplaceSourcesList: React.FC = () => {
  const { t } = useTranslation('settings');

  const {
    marketplaceSources,
    refreshStatus,
    refreshMarketplace,
    deleteMarketplaceSource,
    updateMarketplaceSource,
  } = useMarketplaceStore(
    useShallow((state) => ({
      marketplaceSources: state.marketplaceSources,
      refreshStatus: state.refreshStatus,
      refreshMarketplace: state.refreshMarketplace,
      deleteMarketplaceSource: state.deleteMarketplaceSource,
      updateMarketplaceSource: state.updateMarketplaceSource,
    }))
  );

  const handleToggleEnabled = async (sourceId: string, enabled: boolean) => {
    await updateMarketplaceSource(sourceId, { enabled });
  };

  const handleRefresh = async (sourceId: string) => {
    await refreshMarketplace(sourceId);
  };

  const handleDelete = async (sourceId: string) => {
    if (confirm(t('marketplace.sources.confirmDelete', 'Are you sure you want to delete this marketplace source?'))) {
      await deleteMarketplaceSource(sourceId);
    }
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank');
  };

  if (marketplaceSources.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{t('marketplace.sources.empty', 'No marketplace sources configured')}</p>
        <p className="text-sm mt-1">
          {t('marketplace.sources.addFirst', 'Add your first marketplace source below')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {marketplaceSources.map((source) => {
        const isRefreshing = refreshStatus[source.id] === "refreshing";
        const hasError = refreshStatus[source.id] === "error";

        return (
          <div
            key={source.id}
            className="flex items-center justify-between p-4 border rounded-lg bg-card"
          >
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium">{source.name}</h4>
                <Badge variant={source.enabled ? "default" : "secondary"}>
                  {source.enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
                </Badge>
                {hasError && (
                  <Badge variant="destructive">
                    {t('common.error', 'Error')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{source.url}</p>
              {source.lastRefreshed && (
                <p className="text-xs text-muted-foreground">
                  {t('marketplace.sources.lastRefreshed', 'Last refreshed')} {formatDistanceToNow(source.lastRefreshed, { addSuffix: true })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRefresh(source.id)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleToggleEnabled(source.id, !source.enabled)}
                  >
                    {source.enabled ? (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        {t('common.disable', 'Disable')}
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        {t('common.enable', 'Enable')}
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleOpenUrl(source.url)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t('marketplace.sources.openUrl', 'Open URL')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(source.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('common.delete', 'Delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
};