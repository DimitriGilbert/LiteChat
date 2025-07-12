// src/controls/components/openrouter/OpenRouterProviderDialogContent.tsx
import React, { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2Icon, ServerIcon } from "lucide-react";
import type { OpenRouterProviderControlModule } from "@/controls/modules/OpenRouterProviderControlModule";

interface OpenRouterProviderDialogContentProps {
  module: OpenRouterProviderControlModule;
}

export const OpenRouterProviderDialogContent: React.FC<
  OpenRouterProviderDialogContentProps
> = ({ module }) => {
  
  const availableProviders = module.getAvailableProviders();
  const selectedProviders = module.getSelectedProviders();
  const isLoading = module.getIsLoading();

  const handleProviderToggle = useCallback(
    (providerId: string, checked: boolean) => {
      module.setSelectedProviders((prev) => {
        const nextProviders = new Set(prev);
        if (checked) {
          nextProviders.add(providerId);
        } else {
          nextProviders.delete(providerId);
        }
        return nextProviders;
      });
    },
    [module]
  );

  const renderProviderList = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2Icon className="h-6 w-6 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">
            Loading inference providers...
          </span>
        </div>
      );
    }

    if (availableProviders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ServerIcon className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No inference providers available
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Try selecting a different model
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {availableProviders.map((providerId) => (
          <div
            key={providerId}
            className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
          >
            <Label
              htmlFor={`provider-${providerId}`}
              className="text-sm font-normal cursor-pointer flex-grow"
            >
              {providerId}
            </Label>
            <Switch
              id={`provider-${providerId}`}
              checked={selectedProviders.has(providerId)}
              onCheckedChange={(checked) =>
                handleProviderToggle(providerId, checked)
              }
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 max-w-sm">
      <div className="mb-3">
        <h3 className="font-medium text-sm mb-1">Inference Providers</h3>
        <p className="text-xs text-muted-foreground">
          Select specific providers for this model
        </p>
      </div>
      <div className="border rounded-md p-2 bg-background/50">
        {renderProviderList()}
      </div>
      {selectedProviders.size > 0 && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            {selectedProviders.size} provider{selectedProviders.size > 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
};