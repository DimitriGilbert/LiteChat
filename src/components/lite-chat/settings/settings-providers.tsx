
import React, { useState, useCallback } from "react";

import { useShallow } from "zustand/react/shallow";
import { useProviderStore } from "@/store/provider.store";
import type { DbProviderConfig, DbProviderType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PlusIcon, SaveIcon, XIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiKeySelector } from "@/components/lite-chat/api-key-selector";
import { ProviderRow } from "./settings-provider-row";
import {
  supportsModelFetching,
  requiresApiKey,
  requiresBaseURL,
  PROVIDER_TYPES,
} from "@/lib/litechat";

import { useChatStorage } from "@/hooks/use-chat-storage";


const SettingsProvidersComponent: React.FC = () => {
  // --- Fetch state/actions from store ---
  const {
    // dbProviderConfigs, // Fetched below
    // apiKeys, // Fetched below
    addDbProviderConfig,
    updateDbProviderConfig,
    deleteDbProviderConfig,
    fetchModels,
    providerFetchStatus,
    // getAllAvailableModelDefs, // Defined locally below
  } = useProviderStore(
    useShallow((state) => ({
      // dbProviderConfigs: state.dbProviderConfigs,
      // apiKeys: state.apiKeys,
      addDbProviderConfig: state.addDbProviderConfig,
      updateDbProviderConfig: state.updateDbProviderConfig,
      deleteDbProviderConfig: state.deleteDbProviderConfig,
      fetchModels: state.fetchModels,
      providerFetchStatus: state.providerFetchStatus,
      // getAllAvailableModelDefs: state.getAllAvailableModelDefs,
    })),
  );

  // Fetch from storage
  const { providerConfigs: dbProviderConfigs, apiKeys } = useChatStorage();

  // Define getAllAvailableModelDefs locally
  const getAllAvailableModelDefs = useCallback(
    (providerConfigId: string): { id: string; name: string }[] => {
      const config = (dbProviderConfigs || []).find(
        (p) => p.id === providerConfigId,
      );
      // Add default models logic if needed, similar to provider.store.ts
      return config?.fetchedModels || [];
    },
    [dbProviderConfigs],
  );

  // Local UI state remains
  const [isAdding, setIsAdding] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [newProviderData, setNewProviderData] = useState<
    Partial<DbProviderConfig>
  >({
    name: "",
    type: "openai",
    isEnabled: true,
    apiKeyId: null,
    baseURL: null,
    enabledModels: null,
    autoFetchModels: true,
    fetchedModels: null,
    modelsLastFetchedAt: null,
    modelSortOrder: null,
  });

  // Handlers use store actions
  const handleAddNew = () => {
    setIsAdding(true);
  };
  const handleCancelNew = () => {
    setIsAdding(false);
    setIsSavingNew(false);
    setNewProviderData({
      name: "",
      type: "openai",
      isEnabled: true,
      apiKeyId: null,
      baseURL: null,
      enabledModels: null,
      autoFetchModels: true,
      fetchedModels: null,
      modelsLastFetchedAt: null,
      modelSortOrder: null,
    });
  };
  const handleSaveNew = useCallback(async () => {
    if (!newProviderData.name || !newProviderData.type) {
      toast.error("Provider Name and Type are required.");
      return;
    }
    setIsSavingNew(true);
    try {
      const type = newProviderData.type!;
      const autoFetch =
        newProviderData.autoFetchModels ?? supportsModelFetching(type);
      await addDbProviderConfig({
        name: newProviderData.name,
        type: type,
        isEnabled: newProviderData.isEnabled ?? true,
        apiKeyId: newProviderData.apiKeyId ?? null,
        baseURL: newProviderData.baseURL ?? null,
        enabledModels: null,
        autoFetchModels: autoFetch,
        fetchedModels: null,
        modelsLastFetchedAt: null,
        modelSortOrder: null,
      });
      handleCancelNew();
    } catch (error) {
      console.error("Failed to add provider (from component):", error);
      setIsSavingNew(false);
    }
  }, [addDbProviderConfig, newProviderData, handleCancelNew]);

  const handleNewChange = (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => {
    setNewProviderData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "type") {
        const newType = value as DbProviderType;
        updated.apiKeyId = null;
        updated.baseURL = null;
        updated.autoFetchModels = supportsModelFetching(newType);
        updated.enabledModels = null;
        updated.modelSortOrder = null;
      }
      return updated;
    });
  };

  // Local derived state remains
  const needsKey = requiresApiKey(newProviderData.type ?? null);
  const needsURL = requiresBaseURL(newProviderData.type ?? null);
  const canFetch = supportsModelFetching(newProviderData.type ?? null);

  return (
    <div className="p-4 space-y-4 flex flex-col h-full">
      <div>
        <h3 className="text-lg font-bold text-white">AI Provider Settings</h3>
        <p className="text-sm text-gray-400">
          Configure connections to AI providers. Select models to enable and
          define their display order for the chat dropdown.
        </p>
      </div>

      <div className="mt-auto pt-4 flex-shrink-0">
        {!isAdding && (
          <Button onClick={handleAddNew} className="w-full">
            <PlusIcon className="h-4 w-4 mr-1" /> Add Provider
          </Button>
        )}
      </div>
      {isAdding && (
        <div className="border border-blue-500 rounded-md p-4 space-y-3 bg-gray-800 shadow-lg flex-shrink-0">
          <h4 className="font-semibold text-white">Add New Provider</h4>
          <div className="flex items-center space-x-2">
            <Input
              value={newProviderData.name || ""}
              onChange={(e) => handleNewChange("name", e.target.value)}
              placeholder="Provider Name (e.g., My Ollama)"
              className="flex-grow bg-gray-700 border-gray-600 text-white"
              disabled={isSavingNew}
            />
            <Select
              value={newProviderData.type}
              onValueChange={(value) =>
                handleNewChange("type", value as DbProviderType)
              }
              disabled={isSavingNew}
            >
              <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-600">
                {PROVIDER_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {pt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Switch
                id="new-enabled"
                checked={newProviderData.isEnabled}
                onCheckedChange={(checked) =>
                  handleNewChange("isEnabled", checked)
                }
                disabled={isSavingNew}
              />
              <Label htmlFor="new-enabled">Enabled</Label>
            </div>
          </div>
          {(needsKey || needsURL) && (
            <div className="flex items-center space-x-2">
              {needsKey && (
                <ApiKeySelector
                  label="API Key:"
                  selectedKeyId={newProviderData.apiKeyId ?? null}
                  onKeySelected={(keyId) => handleNewChange("apiKeyId", keyId)}
                  apiKeys={apiKeys || []} // Use fetched data
                  className="flex-grow"
                  disabled={isSavingNew}
                />
              )}
              {needsURL && (
                <Input
                  value={newProviderData.baseURL || ""}
                  onChange={(e) => handleNewChange("baseURL", e.target.value)}
                  placeholder="Base URL (e.g., http://localhost:11434)"
                  className="flex-grow bg-gray-700 border-gray-600 text-white"
                  disabled={isSavingNew}
                />
              )}
            </div>
          )}
          <div className="flex items-center space-x-2">
            <Switch
              id="new-autofetch"
              checked={newProviderData.autoFetchModels}
              onCheckedChange={(checked) =>
                handleNewChange("autoFetchModels", checked)
              }
              disabled={!canFetch || isSavingNew}
            />
            <Label
              htmlFor="new-autofetch"
              className={!canFetch ? "text-gray-500" : ""}
            >
              Auto-fetch models {canFetch ? "" : "(Not Supported)"}
            </Label>
          </div>
          <p className="text-xs text-gray-400">
            You can select/order specific models after adding the provider and
            fetching its models.
          </p>
          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelNew}
              disabled={isSavingNew}
            >
              <XIcon className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveNew}
              disabled={isSavingNew}
            >
              {isSavingNew && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <SaveIcon className="h-4 w-4 mr-1" />{" "}
              {isSavingNew ? "Adding..." : "Add Provider"}
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-grow pr-3 -mr-3">
        <div className="space-y-2">
          {(dbProviderConfigs || []).map(
            (
              provider: DbProviderConfig, // Add null check
            ) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                apiKeys={apiKeys || []} // Use fetched data
                onUpdate={updateDbProviderConfig}
                onDelete={deleteDbProviderConfig}
                // Pass dbProviderConfigs and apiKeys to fetchModels call
                onFetchModels={() =>
                  fetchModels(
                    provider.id,
                    dbProviderConfigs || [],
                    apiKeys || [],
                  )
                }
                fetchStatus={providerFetchStatus[provider.id] || "idle"}
                getAllAvailableModelDefs={() =>
                  getAllAvailableModelDefs(provider.id)
                }
              />
            ),
          )}
        </div>
      </ScrollArea>
    </div>
  );
};


export const SettingsProviders = React.memo(SettingsProvidersComponent);
