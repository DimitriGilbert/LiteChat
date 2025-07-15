// src/controls/components/marketplace-settings/InstalledItemsList.tsx

import React from "react";
import { useMarketplaceStore } from "@/store/marketplace.store";
import { useShallow } from "zustand/react/shallow";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Package } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export const InstalledItemsList: React.FC = () => {
  const { t } = useTranslation('settings');

  const {
    installedItems,
    uninstallMarketplaceItem,
    enableMarketplaceItem,
  } = useMarketplaceStore(
    useShallow((state) => ({
      installedItems: state.installedItems,
      uninstallMarketplaceItem: state.uninstallMarketplaceItem,
      enableMarketplaceItem: state.enableMarketplaceItem,
    }))
  );

  const installedItemsList = Object.values(installedItems);

  const handleToggleEnabled = async (packageId: string, enabled: boolean) => {
    await enableMarketplaceItem(packageId, enabled);
  };

  const handleUninstall = async (packageId: string) => {
    if (confirm(t('marketplace.installed.confirmUninstall', 'Are you sure you want to uninstall this item?'))) {
      await uninstallMarketplaceItem(packageId);
    }
  };

  if (installedItemsList.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Package className="h-8 w-8" />
        </div>
        <h3 className="font-medium mb-2">
          {t('marketplace.installed.empty', 'No items installed')}
        </h3>
        <p className="text-sm">
          {t('marketplace.installed.emptyDescription', 'Browse the marketplace to install your first item')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {installedItemsList.map((item) => {
        // For now, we'll use a simplified display since we don't have the full item metadata
        // This could be enhanced by storing the full marketplace item data with the installation
        return (
          <div
            key={item.packageId}
            className="flex items-center justify-between p-4 border rounded-lg bg-card"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="p-2 rounded-lg bg-muted">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{item.packageId}</h4>
                  <Badge variant="outline">v{item.version}</Badge>
                  <Badge variant={item.enabled ? "default" : "secondary"}>
                    {item.enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
                  </Badge>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    {t('marketplace.installed.installedAt', 'Installed')} {format(item.installedAt, "MMM d, yyyy 'at' HH:mm")}
                  </p>
                  
                  {(item.installedRules.length > 0 || item.installedTemplates.length > 0 || item.installedMcpServers.length > 0) && (
                    <div className="flex gap-4 text-xs">
                      {item.installedRules.length > 0 && (
                        <span>{item.installedRules.length} {t('marketplace.installed.rules', 'rules')}</span>
                      )}
                      {item.installedTemplates.length > 0 && (
                        <span>{item.installedTemplates.length} {t('marketplace.installed.templates', 'templates')}</span>
                      )}
                      {item.installedMcpServers.length > 0 && (
                        <span>{item.installedMcpServers.length} {t('marketplace.installed.mcpServers', 'MCP servers')}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`enabled-${item.packageId}`}
                  checked={item.enabled}
                  onCheckedChange={(checked) => handleToggleEnabled(item.packageId, checked)}
                />
                <Label htmlFor={`enabled-${item.packageId}`} className="text-sm">
                  {t('common.enabled', 'Enabled')}
                </Label>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUninstall(item.packageId)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};