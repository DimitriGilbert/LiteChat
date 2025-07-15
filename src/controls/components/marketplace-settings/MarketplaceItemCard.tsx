// src/controls/components/marketplace-settings/MarketplaceItemCard.tsx

import React from "react";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useShallow } from "zustand/react/shallow";
import { emitter } from "@/lib/litechat/event-emitter";
import { marketplaceEvent } from "@/types/litechat/events/marketplace.events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ExternalLink, FileText, Bot, Workflow, Server, Settings, Archive } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import type { MarketplaceItem } from "@/types/litechat/marketplace";

interface MarketplaceItemCardProps {
  item: MarketplaceItem;
}

const getItemIcon = (type: string) => {
  switch (type) {
    case "rule":
      return FileText;
    case "template":
      return FileText;
    case "agent":
      return Bot;
    case "workflow":
      return Workflow;
    case "mcp-server":
      return Server;
    case "config-bundle":
      return Archive;
    default:
      return Settings;
  }
};

const getItemTypeColor = (type: string) => {
  switch (type) {
    case "rule":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "template":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "agent":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "workflow":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "mcp-server":
      return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300";
    case "config-bundle":
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({ item }) => {
  const { t } = useTranslation('settings');

  const {
    installedItems,
  } = useMarketplaceStore(
    useShallow((state) => ({
      installedItems: state.installedItems,
    }))
  );

  const isInstalled = installedItems[item.id];
  const Icon = getItemIcon(item.type);

  const handleInstall = () => {
    if (item.sourceId) {
      emitter.emit(marketplaceEvent.installMarketplaceItemRequest, { 
        sourceId: item.sourceId, 
        itemId: item.id 
      });
    }
  };

  const handleOpenPreview = () => {
    if (item.previewUrl) {
      window.open(item.previewUrl, '_blank');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg leading-tight">{item.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getItemTypeColor(item.type)}>
                  {t(`marketplace.types.${item.type}`, item.type)}
                </Badge>
                {item.version && (
                  <span className="text-xs text-muted-foreground">v{item.version}</span>
                )}
              </div>
            </div>
          </div>
          
          <Button 
            size="sm" 
            disabled={!!isInstalled}
            onClick={handleInstall}
            className="shrink-0"
          >
            {isInstalled ? (
              <>
                <Download className="h-4 w-4 mr-1" />
                {t('marketplace.installed.label', 'Installed')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                {t('marketplace.install', 'Install')}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {item.description}
        </p>
        
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {item.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{item.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
        
        <div className="mt-auto space-y-2">
          {item.author && (
            <div className="text-xs text-muted-foreground">
              {t('marketplace.by', 'By')} {item.author}
            </div>
          )}
          
          {item.lastUpdated && (
            <div className="text-xs text-muted-foreground">
              {t('marketplace.updated', 'Updated')} {format(new Date(item.lastUpdated), "MMM d, yyyy")}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {item.downloadCount && (
                <span>{item.downloadCount.toLocaleString()} {t('marketplace.downloads', 'downloads')}</span>
              )}
              {item.rating && (
                <span>★ {item.rating.toFixed(1)}</span>
              )}
            </div>
            
            {item.previewUrl && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleOpenPreview}
                className="h-auto p-1"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};