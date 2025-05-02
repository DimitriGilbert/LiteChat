// src/components/LiteChat/settings/SettingsProviders.tsx

import React, { useState, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import type { DbProviderConfig } from "@/types/litechat/provider";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { ProviderRow } from "./SettingsProviderRow";
import { AddProviderForm } from "./AddProviderForm";
import { Skeleton } from "@/components/ui/skeleton";
import { TabbedLayout, TabDefinition } from "../common/TabbedLayout"; // Import TabbedLayout
import { GlobalModelOrganizer } from "./GlobalModelOrganizer"; // Import Organizer
import { ModelDataDisplay } from "./ModelDataDisplay"; // Import new component

// This component now focuses solely on the list and adding providers
const ProviderConfigList: React.FC<{
  onSelectModelForDetails: (id: string | null) => void;
}> = ({ onSelectModelForDetails }) => {
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
    <div className="space-y-6 h-full flex flex-col">
      {/* Provider Configuration Section */}
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          Provider Configuration
        </h3>
        <p className="text-sm text-muted-foreground">
          Add, remove, or configure connections to AI providers. Enable models
          within each provider's edit section. Click a model name to view its
          details.
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

      {/* Provider List */}
      <div className="flex-grow border-t border-border pt-4 mt-4 overflow-y-auto">
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
                  // Pass the setter for model details view
                  onSelectModelForDetails={onSelectModelForDetails}
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

// Main component using TabbedLayout
const SettingsProvidersComponent: React.FC = () => {
  const { selectedModelForDetails, setSelectedModelForDetails } =
    useProviderStore(
      useShallow((state) => ({
        selectedModelForDetails: state._selectedModelForDetails,
        setSelectedModelForDetails: state.setSelectedModelForDetails,
      })),
    );

  // State to manage the active tab
  const [activeTab, setActiveTab] = useState("providers-config");

  // Callback to handle selecting a model and switching tabs
  const handleSelectModelAndSwitchTab = useCallback(
    (combinedId: string | null) => {
      setSelectedModelForDetails(combinedId);
      if (combinedId) {
        setActiveTab("providers-details"); // Switch to details tab
      }
    },
    [setSelectedModelForDetails],
  );

  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "providers-config",
        label: "Configuration",
        content: (
          <ProviderConfigList
            onSelectModelForDetails={handleSelectModelAndSwitchTab}
          />
        ),
      },
      {
        value: "providers-order",
        label: "Model Order",
        content: <GlobalModelOrganizer />,
      },
      {
        value: "providers-details",
        label: "Model Details",
        content: <ModelDataDisplay modelId={selectedModelForDetails} />,
      },
    ],
    [selectedModelForDetails, handleSelectModelAndSwitchTab],
  );

  return (
    <TabbedLayout
      tabs={tabs}
      initialValue={activeTab} // Use state for initial/current value
      onValueChange={setActiveTab} // Update state on change
      className="h-full"
      listClassName="bg-muted/50 rounded-md"
      contentContainerClassName="mt-4"
    />
  );
};

export const SettingsProviders = React.memo(SettingsProvidersComponent);
