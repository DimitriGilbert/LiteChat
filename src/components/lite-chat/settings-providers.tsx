// src/components/lite-chat/settings-providers.tsx
import React, { useState } from "react";
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
// Removed Checkbox import as it wasn't used
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
}

const ProviderRow: React.FC<ProviderRowProps> = ({
  provider,
  apiKeys,
  onUpdate,
  onDelete,
  onFetchModels,
  fetchStatus,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<DbProviderConfig>>({});

  const handleEdit = () => {
    setEditData({
      name: provider.name,
      type: provider.type,
      isEnabled: provider.isEnabled,
      apiKeyId: provider.apiKeyId,
      baseURL: provider.baseURL,
      enabledModels: provider.enabledModels,
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
      await onUpdate(provider.id, editData);
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
          {(needsKey || needsURL) && (
            <div className="flex items-center space-x-2">
              {needsKey && (
                <ApiKeySelector
                  label="API Key:"
                  selectedKeyId={editData.apiKeyId ?? null}
                  onKeySelected={(keyId) => handleChange("apiKeyId", keyId)} // Pass correct callback
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
            {provider.fetchedModels && provider.fetchedModels.length > 0 && (
              <div className="pt-1">
                <span className="font-medium text-gray-300">
                  Available Models ({provider.fetchedModels.length}):
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
        enabledModels: newProviderData.enabledModels ?? null,
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
      }
      return updated;
    });
  };

  const needsKey = requiresApiKey(newProviderData.type ?? null);
  const needsURL = requiresBaseURL(newProviderData.type ?? null);
  const canFetch = supportsModelFetching(newProviderData.type ?? null);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-bold text-white">AI Provider Settings</h3>
      <p className="text-sm text-gray-400">
        Configure connections to different AI model providers. API keys are
        stored locally in your browser's IndexedDB.
      </p>

      <ScrollArea className="h-[calc(100vh-300px)] pr-3">
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
            />
          ))}
        </div>
      </ScrollArea>

      {isAdding && (
        <div className="border border-blue-500 rounded-md p-4 space-y-3 bg-gray-800 shadow-lg">
          <h4 className="font-semibold text-white">Add New Provider</h4>
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
          {(needsKey || needsURL) && (
            <div className="flex items-center space-x-2">
              {needsKey && (
                <ApiKeySelector
                  label="API Key:"
                  selectedKeyId={newProviderData.apiKeyId ?? null}
                  onKeySelected={(keyId) => handleNewChange("apiKeyId", keyId)} // Pass correct callback
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
        <Button onClick={handleAddNew} className="mt-4">
          <PlusIcon className="h-4 w-4 mr-1" /> Add Provider
        </Button>
      )}
    </div>
  );
};
