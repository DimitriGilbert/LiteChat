// src/components/lite-chat/settings-providers.tsx
import React, { useState, useEffect } from "react";
import { useProviderManagementContext } from "@/context/provider-management-context";
import type { DbProviderConfig, DbApiKey, DbProviderType } from "@/lib/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Trash2Icon,
  PlusIcon,
  SaveIcon,
  Edit2Icon,
  XIcon,
  RefreshCwIcon,
  CheckIcon,
  AlertCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiKeySelector } from "./api-key-selector";

// ... (PROVIDER_TYPES, helper functions, ProviderRowProps remain the same) ...
const PROVIDER_TYPES: { value: DbProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "ollama", label: "Ollama" },
  { value: "openai-compatible", label: "OpenAI-Compatible (LMStudio, etc.)" },
];

const requiresApiKey = (type: DbProviderType | null): boolean => {
  return type === "openai" || type === "openrouter" || type === "google";
};

const requiresBaseURL = (type: DbProviderType | null): boolean => {
  return type === "ollama" || type === "openai-compatible";
};

const supportsModelFetching = (type: DbProviderType | null): boolean => {
  return (
    type === "openai" ||
    type === "openrouter" ||
    type === "ollama" ||
    type === "openai-compatible"
  );
};

interface ProviderRowProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onUpdate: (id: string, changes: Partial<DbProviderConfig>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onFetchModels: (id: string) => Promise<void>;
  fetchStatus: "idle" | "fetching" | "error" | "success";
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
}

const ProviderRow: React.FC<ProviderRowProps> = ({
  provider,
  apiKeys,
  onUpdate,
  onDelete,
  onFetchModels,
  fetchStatus,
  getAllAvailableModelDefs,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<DbProviderConfig>>({});
  const [availableModels, setAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id);
      setAvailableModels(models);
      setEditData((prev) => ({
        ...prev,
        enabledModels: provider.enabledModels ?? [],
      }));
    } else {
      setAvailableModels([]);
    }
  }, [
    isEditing,
    provider.id,
    provider.enabledModels,
    getAllAvailableModelDefs,
  ]);

  const handleEdit = () => {
    setEditData({
      name: provider.name,
      type: provider.type,
      isEnabled: provider.isEnabled,
      apiKeyId: provider.apiKeyId,
      baseURL: provider.baseURL,
      enabledModels: provider.enabledModels ?? [],
      autoFetchModels: provider.autoFetchModels,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleSave = async () => {
    try {
      const changesToSave = {
        ...editData,
        enabledModels:
          editData.enabledModels && editData.enabledModels.length > 0
            ? editData.enabledModels
            : null,
      };
      await onUpdate(provider.id, changesToSave);
      setIsEditing(false);
      setEditData({});
      toast.success(`Provider "${editData.name || provider.name}" updated.`);
    } catch (error) {
      toast.error(
        `Failed to update provider: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleChange = (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEnabledModelChange = (modelId: string, checked: boolean) => {
    setEditData((prev) => {
      const currentEnabled = (prev.enabledModels as string[]) ?? [];
      let newEnabled: string[];
      if (checked) {
        newEnabled = [...currentEnabled, modelId];
      } else {
        newEnabled = currentEnabled.filter((id) => id !== modelId);
      }
      return { ...prev, enabledModels: [...new Set(newEnabled)] };
    });
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete the provider "${provider.name}"?`,
      )
    ) {
      try {
        await onDelete(provider.id);
        toast.success(`Provider "${provider.name}" deleted.`);
      } catch (error) {
        toast.error(
          `Failed to delete provider: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  const currentProvider = isEditing ? { ...provider, ...editData } : provider;
  const needsKey = requiresApiKey(currentProvider.type);
  const needsURL = requiresBaseURL(currentProvider.type);
  const canFetch = supportsModelFetching(currentProvider.type);

  return (
    <div className="border-b border-gray-700 p-4 space-y-3">
      {isEditing ? (
        // --- Edit Mode ---
        <div className="space-y-3">
          {/* Name, Type, Enabled Switch */}
          <div className="flex items-center space-x-2">
            <Input
              value={editData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Provider Name"
              className="flex-grow bg-gray-700 border-gray-600 text-white"
            />
            <Select
              value={editData.type}
              onValueChange={(value) =>
                handleChange("type", value as DbProviderType)
              }
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
                id={`edit-enabled-${provider.id}`}
                checked={editData.isEnabled}
                onCheckedChange={(checked) =>
                  handleChange("isEnabled", checked)
                }
              />
              <Label htmlFor={`edit-enabled-${provider.id}`}>Enabled</Label>
            </div>
          </div>
          {/* API Key / Base URL */}
          {(needsKey || needsURL) && (
            <div className="flex items-center space-x-2">
              {needsKey && (
                <ApiKeySelector
                  label="API Key:"
                  selectedKeyId={editData.apiKeyId ?? null}
                  onKeySelected={(keyId) => handleChange("apiKeyId", keyId)}
                  apiKeys={apiKeys}
                  className="flex-grow"
                />
              )}
              {needsURL && (
                <Input
                  value={editData.baseURL || ""}
                  onChange={(e) => handleChange("baseURL", e.target.value)}
                  placeholder="Base URL (e.g., http://localhost:11434)"
                  className="flex-grow bg-gray-700 border-gray-600 text-white"
                />
              )}
            </div>
          )}
          {/* Auto-fetch Switch */}
          <div className="flex items-center space-x-2">
            <Switch
              id={`edit-autofetch-${provider.id}`}
              checked={editData.autoFetchModels}
              onCheckedChange={(checked) =>
                handleChange("autoFetchModels", checked)
              }
              disabled={!canFetch}
            />
            <Label
              htmlFor={`edit-autofetch-${provider.id}`}
              className={!canFetch ? "text-gray-500" : ""}
            >
              Auto-fetch models {canFetch ? "" : "(Not Supported)"}
            </Label>
          </div>

          {/* Enabled Models Selection */}
          {availableModels.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label>Enabled Models (for default list)</Label>
              <p className="text-xs text-gray-400">
                Select models to show in the main dropdown. Search will always
                show all available models. If none selected, all are shown by
                default.
              </p>
              <ScrollArea className="h-40 w-full rounded-md border border-gray-600 p-2 bg-gray-700">
                <div className="space-y-2">
                  {availableModels.map((model) => (
                    <div key={model.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-model-${provider.id}-${model.id}`}
                        checked={(
                          (editData.enabledModels as string[]) ?? []
                        ).includes(model.id)}
                        onCheckedChange={(checked) =>
                          handleEnabledModelChange(model.id, !!checked)
                        }
                        className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                      />
                      <Label
                        htmlFor={`edit-model-${provider.id}-${model.id}`}
                        className="text-sm font-normal text-white"
                      >
                        {model.name || model.id}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Save/Cancel Buttons */}
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <XIcon className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave}>
              <SaveIcon className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>
      ) : (
        // --- View Mode ---
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span
                className={`h-2 w-2 rounded-full ${provider.isEnabled ? "bg-green-500" : "bg-gray-500"}`}
              ></span>
              <h3 className="font-semibold text-lg text-white">
                {provider.name}
              </h3>
              <span className="text-sm text-gray-400">({provider.type})</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" onClick={handleEdit}>
                <Edit2Icon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete}>
                <Trash2Icon className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
          <div className="text-sm text-gray-400 mt-1 space-y-1">
            {needsKey && (
              <div>
                API Key:{" "}
                {provider.apiKeyId ? (
                  <span className="text-green-400">
                    {apiKeys.find((k) => k.id === provider.apiKeyId)?.name ||
                      "Linked"}
                  </span>
                ) : (
                  <span className="text-amber-400">Not Linked</span>
                )}
              </div>
            )}
            {needsURL && <div>Base URL: {provider.baseURL || "Not Set"}</div>}
            <div>
              Auto-fetch Models:{" "}
              {provider.autoFetchModels ? (
                <span className="text-green-400">Enabled</span>
              ) : (
                <span className="text-gray-500">Disabled</span>
              )}
            </div>
            {/* Display Enabled Models List */}
            {provider.enabledModels && provider.enabledModels.length > 0 && (
              <div className="pt-1">
                <span className="font-medium text-gray-300">
                  Enabled Models ({provider.enabledModels.length}):
                </span>
                <ScrollArea className="h-16 mt-1 rounded-md border border-gray-600 p-2 bg-gray-900 text-xs">
                  {provider.enabledModels.map((modelId) => {
                    const model = provider.fetchedModels?.find(
                      (m) => m.id === modelId,
                    );
                    return <div key={modelId}>{model?.name || modelId}</div>;
                  })}
                </ScrollArea>
              </div>
            )}
            {/* Display Fetched Models List */}
            {provider.fetchedModels && provider.fetchedModels.length > 0 && (
              <div className="pt-1">
                <span className="font-medium text-gray-300">
                  All Available Models ({provider.fetchedModels.length}):
                </span>
                <ScrollArea className="h-20 mt-1 rounded-md border border-gray-600 p-2 bg-gray-900 text-xs">
                  {provider.fetchedModels.map((m) => (
                    <div key={m.id}>{m.name || m.id}</div>
                  ))}
                </ScrollArea>
                <span className="text-xs text-gray-500">
                  Last fetched:{" "}
                  {provider.modelsLastFetchedAt
                    ? provider.modelsLastFetchedAt.toLocaleString()
                    : "Never"}
                </span>
              </div>
            )}
            {/* Fetch Models Button */}
            {canFetch && (
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFetchModels(provider.id)}
                  disabled={fetchStatus === "fetching"}
                  className="text-xs"
                >
                  {fetchStatus === "fetching" && (
                    <RefreshCwIcon className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  {fetchStatus === "success" && (
                    <CheckIcon className="h-3 w-3 mr-1 text-green-500" />
                  )}
                  {fetchStatus === "error" && (
                    <AlertCircleIcon className="h-3 w-3 mr-1 text-red-500" />
                  )}
                  {fetchStatus === "idle" && (
                    <RefreshCwIcon className="h-3 w-3 mr-1" />
                  )}
                  {fetchStatus === "fetching"
                    ? "Fetching..."
                    : "Fetch Models Now"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsProviders: React.FC = () => {
  const {
    dbProviderConfigs,
    addDbProviderConfig,
    updateDbProviderConfig,
    deleteDbProviderConfig,
    apiKeys,
    fetchModels,
    providerFetchStatus,
    getAllAvailableModelDefs,
  } = useProviderManagementContext();
  const [isAdding, setIsAdding] = useState(false);
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
  });

  const handleAddNew = () => {
    setIsAdding(true);
  };

  const handleCancelNew = () => {
    setIsAdding(false);
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
    });
  };

  const handleSaveNew = async () => {
    if (!newProviderData.name || !newProviderData.type) {
      toast.error("Provider Name and Type are required.");
      return;
    }
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
      });
      toast.success(`Provider "${newProviderData.name}" added.`);
      handleCancelNew();
    } catch (error) {
      toast.error(
        `Failed to add provider: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

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
      }
      return updated;
    });
  };

  const needsKey = requiresApiKey(newProviderData.type ?? null);
  const needsURL = requiresBaseURL(newProviderData.type ?? null);
  const canFetch = supportsModelFetching(newProviderData.type ?? null);

  return (
    <div className="p-4 space-y-4 flex flex-col h-full">
      {" "}
      {/* Added flex flex-col h-full */}
      <div>
        {" "}
        {/* Encapsulate static header content */}
        <h3 className="text-lg font-bold text-white">AI Provider Settings</h3>
        <p className="text-sm text-gray-400">
          Configure connections to different AI model providers. API keys and
          settings are stored locally in your browser's IndexedDB.
        </p>
      </div>
      {/* Make ScrollArea flexible */}
      <ScrollArea className="flex-grow pr-3">
        {" "}
        {/* Changed height to flex-grow */}
        <div className="space-y-2">
          {dbProviderConfigs.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              apiKeys={apiKeys}
              onUpdate={updateDbProviderConfig}
              onDelete={deleteDbProviderConfig}
              onFetchModels={fetchModels}
              fetchStatus={providerFetchStatus[provider.id] || "idle"}
              getAllAvailableModelDefs={getAllAvailableModelDefs}
            />
          ))}
        </div>
      </ScrollArea>
      {/* Add/New Form Section (remains at the bottom) */}
      <div className="mt-auto pt-4">
        {" "}
        {/* Add padding top */}
        {isAdding && (
          <div className="border border-blue-500 rounded-md p-4 space-y-3 bg-gray-800 shadow-lg">
            <h4 className="font-semibold text-white">Add New Provider</h4>
            {/* Name, Type, Enabled Switch */}
            <div className="flex items-center space-x-2">
              <Input
                value={newProviderData.name || ""}
                onChange={(e) => handleNewChange("name", e.target.value)}
                placeholder="Provider Name (e.g., My Ollama)"
                className="flex-grow bg-gray-700 border-gray-600 text-white"
              />
              <Select
                value={newProviderData.type}
                onValueChange={(value) =>
                  handleNewChange("type", value as DbProviderType)
                }
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
                />
                <Label htmlFor="new-enabled">Enabled</Label>
              </div>
            </div>
            {/* API Key / Base URL */}
            {(needsKey || needsURL) && (
              <div className="flex items-center space-x-2">
                {needsKey && (
                  <ApiKeySelector
                    label="API Key:"
                    selectedKeyId={newProviderData.apiKeyId ?? null}
                    onKeySelected={(keyId) =>
                      handleNewChange("apiKeyId", keyId)
                    }
                    apiKeys={apiKeys}
                    className="flex-grow"
                  />
                )}
                {needsURL && (
                  <Input
                    value={newProviderData.baseURL || ""}
                    onChange={(e) => handleNewChange("baseURL", e.target.value)}
                    placeholder="Base URL (e.g., http://localhost:11434)"
                    className="flex-grow bg-gray-700 border-gray-600 text-white"
                  />
                )}
              </div>
            )}
            {/* Auto-fetch Switch */}
            <div className="flex items-center space-x-2">
              <Switch
                id="new-autofetch"
                checked={newProviderData.autoFetchModels}
                onCheckedChange={(checked) =>
                  handleNewChange("autoFetchModels", checked)
                }
                disabled={!canFetch}
              />
              <Label
                htmlFor="new-autofetch"
                className={!canFetch ? "text-gray-500" : ""}
              >
                Auto-fetch models {canFetch ? "" : "(Not Supported)"}
              </Label>
            </div>
            <p className="text-xs text-gray-400">
              You can select specific models to enable after adding the provider
              and fetching its models.
            </p>
            {/* Add/Cancel Buttons */}
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" size="sm" onClick={handleCancelNew}>
                <XIcon className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button variant="secondary" size="sm" onClick={handleSaveNew}>
                <SaveIcon className="h-4 w-4 mr-1" /> Add Provider
              </Button>
            </div>
          </div>
        )}
        {!isAdding && (
          <Button onClick={handleAddNew} className="w-full">
            {" "}
            {/* Make button full width */}
            <PlusIcon className="h-4 w-4 mr-1" /> Add Provider
          </Button>
        )}
      </div>
    </div>
  );
};
