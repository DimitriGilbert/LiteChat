// src/components/lite-chat/settings/add-provider-form.tsx
import React, { useState, useCallback } from "react";
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
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiKeySelector } from "@/components/lite-chat/api-key-selector";
import type { DbProviderConfig, DbProviderType, DbApiKey } from "@/lib/types";
import {
  supportsModelFetching,
  requiresApiKey,
  requiresBaseURL,
  PROVIDER_TYPES,
} from "@/lib/litechat";

interface AddProviderFormProps {
  apiKeys: DbApiKey[];
  onAddProvider: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  onCancel: () => void;
}

export const AddProviderForm: React.FC<AddProviderFormProps> = ({
  apiKeys,
  onAddProvider,
  onCancel,
}) => {
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

  const handleNewChange = (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => {
    setNewProviderData((prev) => {
      const updated = { ...prev, [field]: value };
      // Reset dependent fields when type changes
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
      await onAddProvider({
        name: newProviderData.name,
        type: type,
        isEnabled: newProviderData.isEnabled ?? true,
        apiKeyId: newProviderData.apiKeyId ?? null,
        baseURL: newProviderData.baseURL ?? null,
        enabledModels: null, // Start with no models enabled
        autoFetchModels: autoFetch,
        fetchedModels: null,
        modelsLastFetchedAt: null,
        modelSortOrder: null,
      });
      onCancel(); // Close form on success
    } catch (error) {
      // Error toast likely handled by the caller (store action)
      console.error("Failed to add provider (from form component):", error);
    } finally {
      setIsSavingNew(false);
    }
  }, [newProviderData, onAddProvider, onCancel]);

  const needsKey = requiresApiKey(newProviderData.type ?? null);
  const needsURL = requiresBaseURL(newProviderData.type ?? null);
  const canFetch = supportsModelFetching(newProviderData.type ?? null);

  return (
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
            onCheckedChange={(checked) => handleNewChange("isEnabled", checked)}
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
              apiKeys={apiKeys || []}
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
          onClick={onCancel}
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
  );
};
