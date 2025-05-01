// src/components/LiteChat/settings/SettingsProviders.tsx
// Entire file content provided
import React, { useState, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import type { DbProviderConfig } from "@/types/litechat/provider";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { ProviderRow } from "./SettingsProviderRow";
import { AddProviderForm } from "./AddProviderForm";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
// Removed GlobalModelOrganizer and Separator imports

// This component now focuses solely on the list and adding providers
const SettingsProvidersComponent: React.FC = () => {
  const {
    addDbProviderConfig,
    updateDbProviderConfig,
    deleteDbProviderConfig,
    fetchModels,
    providerFetchStatus,
    dbProviderConfigs,
    apiKeys,
    isLoading,
  } = useProviderStore(
    useShallow((state) => ({
      addDbProviderConfig: state.addProviderConfig,
      updateDbProviderConfig: state.updateProviderConfig,
      deleteDbProviderConfig: state.deleteProviderConfig,
      fetchModels: state.fetchModels,
      providerFetchStatus: state.providerFetchStatus,
      dbProviderConfigs: state.dbProviderConfigs,
      apiKeys: state.dbApiKeys,
      isLoading: state.isLoading,
    })),
  );

  const [isAdding, setIsAdding] = useState(false);

  const handleAddNew = () => setIsAdding(true);
  const handleCancelNew = useCallback(() => setIsAdding(false), []);

  const handleFetchModels = useCallback(
    async (providerId: string): Promise<void> => {
      await fetchModels(providerId);
    },
    [fetchModels],
  );

  const providersToDisplay = useMemo(
    () => dbProviderConfigs || [],
    [dbProviderConfigs],
  );

  return (
    // Ensure this component uses flex-col and h-full to occupy space correctly
    <div className="space-y-6 h-full flex flex-col">
      {/* Provider Configuration Section */}
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Provider Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Add, remove, or configure connections to AI providers. Enable models
          within each provider's edit section.
        </p>
      </div>

      {/* Add Provider Button / Form */}
      <div className="flex-shrink-0">
        {!isAdding ? (
          <Button
            onClick={handleAddNew}
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            <PlusIcon className="h-4 w-4 mr-1" /> Add Provider Configuration
          </Button>
        ) : (
          <AddProviderForm
            apiKeys={apiKeys || []}
            onAddProvider={addDbProviderConfig}
            onCancel={handleCancelNew}
          />
        )}
      </div>

      {/* Provider List - Takes remaining space, NO internal ScrollArea */}
      {/* The parent div in SettingsModal handles scrolling */}
      <div className="flex-grow border-t border-border pt-4 mt-4">
        {" "}
        {/* Removed overflow-hidden */}
        <div className="space-y-2">
          {isLoading && !isAdding ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {providersToDisplay.map((provider: DbProviderConfig) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  apiKeys={apiKeys || []}
                  onUpdate={updateDbProviderConfig}
                  onDelete={deleteDbProviderConfig}
                  onFetchModels={handleFetchModels}
                  fetchStatus={providerFetchStatus[provider.id] || "idle"}
                />
              ))}
            </div>
          )}
          {!isLoading && providersToDisplay.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No providers configured yet. Click "Add Provider Configuration"
              above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export const SettingsProviders = React.memo(SettingsProvidersComponent);
