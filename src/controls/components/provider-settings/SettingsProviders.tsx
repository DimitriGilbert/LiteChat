// src/controls/components/provider-settings/SettingsProviders.tsx
// FULL FILE
import React, { useState, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import type { DbProviderConfig } from "@/types/litechat/provider";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import { ProviderRow } from "./SettingsProviderRow";
import { AddProviderForm } from "./AddProviderForm";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TabbedLayout,
  TabDefinition,
} from "@/components/LiteChat/common/TabbedLayout";
import { GlobalModelOrganizer } from "./GlobalModelOrganizer";
import { ModelDataDisplay } from "./ModelDataDisplay";
import { SettingsApiKeys } from "./ApiKeys";
import { ModelBrowserList } from "./ModelBrowserList";
import { useTranslation } from "react-i18next";
// Removed ProviderSettingsModule import as it's not directly used for data here

// ProviderConfigList remains largely the same, fetching its own data from the store
const ProviderConfigList: React.FC<{
  onSelectModelForDetails: (id: string | null) => void;
}> = ({ onSelectModelForDetails }) => {
  const { t } = useTranslation('settings');
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
    }))
  );

  const [isAdding, setIsAdding] = useState(false);

  const handleAddNew = () => setIsAdding(true);
  const handleCancelNew = useCallback(() => setIsAdding(false), []);

  const handleFetchModels = useCallback(
    async (providerId: string): Promise<void> => {
      await fetchModels(providerId);
    },
    [fetchModels]
  );

  const providersToDisplay = useMemo(
    () => dbProviderConfigs || [],
    [dbProviderConfigs]
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h3 className="text-lg font-semibold text-card-foreground">
          {t('providerSettings.title', 'Provider Configuration')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('providerSettings.description', 'Add, remove, or configure connections to AI providers. Enable models within each provider\'s edit section. Click a model name to view its details.')}
        </p>
      </div>
      <div className="flex-shrink-0">
        {!isAdding ? (
          <Button
            onClick={handleAddNew}
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            <PlusIcon className="h-4 w-4 mr-1" /> {t('providerSettings.addProvider', 'Add Provider Configuration')}
          </Button>
        ) : (
          <AddProviderForm
            apiKeys={apiKeys || []}
            onAddProvider={addDbProviderConfig}
            onCancel={handleCancelNew}
          />
        )}
      </div>
      <div className="flex-grow border-t border-border pt-4 mt-4 overflow-y-auto">
        <div className="space-y-2">
          {isLoading && !isAdding ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
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
                  onSelectModelForDetails={onSelectModelForDetails}
                />
              ))}
            </div>
          )}
          {!isLoading && providersToDisplay.length === 0 && !isAdding && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('providerSettings.noProviders', 'No providers configured yet. Click "Add Provider Configuration" above.')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface SettingsProvidersProps {
  // Only the action from the module is needed for GlobalModelOrganizer
  setGlobalModelSortOrderFromModule: (ids: string[]) => void;
}

const SettingsProvidersComponent: React.FC<SettingsProvidersProps> = ({
  setGlobalModelSortOrderFromModule,
}) => {
  const { t } = useTranslation('settings');
  const { selectedModelForDetails, setSelectedModelForDetails } =
    useProviderStore(
      useShallow((state) => ({
        selectedModelForDetails: state._selectedModelForDetails,
        setSelectedModelForDetails: state.setSelectedModelForDetails,
      }))
    );

  const [activeTab, setActiveTab] = useState("providers-config");

  const handleSelectModelAndSwitchTab = useCallback(
    (combinedId: string | null) => {
      setSelectedModelForDetails(combinedId);
      if (combinedId) {
        setActiveTab("providers-details-current");
      }
    },
    [setSelectedModelForDetails, setActiveTab]
  );

  const tabs: TabDefinition[] = useMemo(
    () => [
      {
        value: "providers-config",
        label: t('providerSettings.tabs.config', 'Configuration'),
        content: (
          <ProviderConfigList
            onSelectModelForDetails={handleSelectModelAndSwitchTab}
          />
        ),
      },
      {
        value: "providers-order",
        label: t('providerSettings.tabs.order', 'Model Order'),
        content: (
          // GlobalModelOrganizer now fetches its own data from the store,
          // but receives the sort order update function from the module.
          <GlobalModelOrganizer
            setGlobalModelSortOrderFromModule={
              setGlobalModelSortOrderFromModule
            }
          />
        ),
      },
      {
        value: "api-keys",
        label: t('providerSettings.tabs.apiKeys', 'API Keys'),
        content: <SettingsApiKeys />,
      },
      {
        value: "providers-details-current",
        label: t('providerSettings.tabs.selectedModel', 'Selected Model'),
        content: <ModelDataDisplay modelId={selectedModelForDetails} />,
      },
      {
        value: "providers-browse-all",
        label: t('providerSettings.tabs.browse', 'Browse Models'),
        content: (
          <ModelBrowserList
            onSelectModelForDetails={handleSelectModelAndSwitchTab}
          />
        ),
        scrollable: false,
      },
    ],
    [
      selectedModelForDetails,
      handleSelectModelAndSwitchTab,
      setGlobalModelSortOrderFromModule,
      t,
    ]
  );

  return (
    <TabbedLayout
      tabs={tabs}
      initialValue={activeTab}
      onValueChange={setActiveTab}
      className="h-full"
      listClassName="bg-muted/50 rounded-md"
      contentContainerClassName="mt-4"
    />
  );
};

export const SettingsProviders = React.memo(SettingsProvidersComponent);
