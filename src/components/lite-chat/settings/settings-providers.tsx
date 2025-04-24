// src/components/lite-chat/settings/settings-providers.tsx
import React, { useState, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import type { DbProviderConfig, DbProviderType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProviderRow } from "./settings-provider-row";
import { AddProviderForm } from "./add-provider-form"; // Import the new form
import { useChatStorage } from "@/hooks/use-chat-storage";
import { DEFAULT_MODELS } from "@/lib/litechat";

const SettingsProvidersComponent: React.FC = () => {
  // --- Fetch actions and status from store ---
  const {
    addDbProviderConfig,
    updateDbProviderConfig,
    deleteDbProviderConfig,
    fetchModels,
    providerFetchStatus,
  } = useProviderStore(
    useShallow((state) => ({
      addDbProviderConfig: state.addDbProviderConfig,
      updateDbProviderConfig: state.updateDbProviderConfig,
      deleteDbProviderConfig: state.deleteDbProviderConfig,
      fetchModels: state.fetchModels,
      providerFetchStatus: state.providerFetchStatus,
    })),
  );
  const { providerConfigs: dbProviderConfigs, apiKeys } = useChatStorage();

  // Define getAllAvailableModelDefs locally using live data
  const getAllAvailableModelDefs = useCallback(
    (providerConfigId: string): { id: string; name: string }[] => {
      const config = (dbProviderConfigs || []).find(
        (p) => p.id === providerConfigId,
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
    [dbProviderConfigs],
  );

  const [isAdding, setIsAdding] = useState(false);

  const handleAddNew = () => {
    setIsAdding(true);
  };

  const handleCancelNew = useCallback(() => {
    setIsAdding(false);
  }, []);

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
      <div className="mt-auto pt-4 flex-shrink-0">
        {!isAdding ? (
          <Button onClick={handleAddNew} className="w-full">
            <PlusIcon className="h-4 w-4 mr-1" /> Add Provider
          </Button>
        ) : (
          <AddProviderForm
            apiKeys={apiKeys || []}
            onAddProvider={addDbProviderConfig} // Pass the store action
            onCancel={handleCancelNew}
          />
        )}
      </div>

      {/* Provider List */}
      <ScrollArea className="flex-grow pr-3 -mr-3">
        <div className="space-y-2">
          {(dbProviderConfigs || []).map((provider: DbProviderConfig) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              apiKeys={apiKeys || []} // Pass live data
              onUpdate={updateDbProviderConfig} // Pass store action
              onDelete={deleteDbProviderConfig} // Pass store action
              // Pass fetchModels action with current data from storage
              onFetchModels={() =>
                fetchModels(provider.id, dbProviderConfigs || [], apiKeys || [])
              }
              fetchStatus={providerFetchStatus[provider.id] || "idle"}
              getAllAvailableModelDefs={() =>
                getAllAvailableModelDefs(provider.id)
              } // Pass local getter
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export const SettingsProviders = React.memo(SettingsProvidersComponent);
