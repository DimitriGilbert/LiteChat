// src/components/LiteChat/settings/SettingsProviders.tsx
import React, { useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import type {
  DbProviderConfig,
  DbProviderType,
  DbApiKey,
} from "@/types/litechat/provider"; // Correct path
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProviderRow } from "./SettingsProviderRow";
import { AddProviderForm } from "./AddProviderForm";
// REMOVED incorrect import for useChatStorage
import { DEFAULT_MODELS } from "@/lib/litechat/provider-helpers";
import { Skeleton } from "@/components/ui/skeleton";

const SettingsProvidersComponent: React.FC = () => {
  // Fetch actions AND data directly from ProviderStore
  const {
    addDbProviderConfig,
    updateDbProviderConfig,
    deleteDbProviderConfig,
    fetchModels,
    providerFetchStatus,
    // Fetch data directly from the store state
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
      // Select data directly from the store state
      dbProviderConfigs: state.dbProviderConfigs,
      apiKeys: state.dbApiKeys, // Use dbApiKeys from state
      isLoading: state.isLoading,
    })),
  );

  // getAllAvailableModelDefs remains the same, using data from the store state
  const getAllAvailableModelDefs = useCallback(
    (providerConfigId: string): { id: string; name: string }[] => {
      const config = (dbProviderConfigs || []).find(
        (p: DbProviderConfig) => p.id === providerConfigId,
      );
      const getDefaultModels = (
        type: DbProviderType,
      ): { id: string; name: string }[] => {
        return DEFAULT_MODELS[type] || [];
      };
      if (!config) return [];
      return config.fetchedModels && config.fetchedModels.length > 0
        ? config.fetchedModels
        : getDefaultModels(config.type);
    },
    [dbProviderConfigs], // Dependency is the data from the store
  );

  const [isAdding, setIsAdding] = useState(false);
  const handleAddNew = () => setIsAdding(true);
  const handleCancelNew = useCallback(() => setIsAdding(false), []);

  // handleFetchModels remains the same
  const handleFetchModels = useCallback(
    async (providerId: string): Promise<void> => {
      await fetchModels(providerId);
    },
    [fetchModels],
  );

  return (
    <div className="p-4 space-y-4 flex flex-col h-full">
      <div>
        <h3 className="text-lg font-bold text-white">AI Provider Settings</h3>
        <p className="text-sm text-gray-400">
          Configure connections to AI providers. Select models to enable and
          define their display order for the chat dropdown.
        </p>
      </div>

      {/* Add Provider Button / Form */}
      <div className="flex-shrink-0">
        {!isAdding ? (
          <Button
            onClick={handleAddNew}
            className="w-full"
            disabled={isLoading}
          >
            <PlusIcon className="h-4 w-4 mr-1" /> Add Provider
          </Button>
        ) : (
          <AddProviderForm
            apiKeys={apiKeys || []} // Use data from store
            onAddProvider={addDbProviderConfig}
            onCancel={handleCancelNew}
          />
        )}
      </div>

      {/* Provider List */}
      <ScrollArea className="flex-grow pr-3 -mr-3 border-t border-border pt-4 mt-4">
        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : (
            (dbProviderConfigs || []).map((provider: DbProviderConfig) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                apiKeys={apiKeys || []} // Use data from store
                onUpdate={updateDbProviderConfig}
                onDelete={deleteDbProviderConfig}
                onFetchModels={handleFetchModels}
                fetchStatus={providerFetchStatus[provider.id] || "idle"}
                getAllAvailableModelDefs={getAllAvailableModelDefs}
              />
            ))
          )}
          {!isLoading && dbProviderConfigs?.length === 0 && !isAdding && (
            <p className="text-sm text-gray-500 text-center py-4">
              No providers configured yet. Click "Add Provider" above.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export const SettingsProviders = React.memo(SettingsProvidersComponent);
