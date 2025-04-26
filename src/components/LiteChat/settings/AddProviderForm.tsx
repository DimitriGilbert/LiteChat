// src/components/LiteChat/settings/AddProviderForm.tsx
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
// Corrected import path
import { ApiKeySelector } from "@/components/LiteChat/settings/ApiKeySelector";
// Corrected import path for types
import type {
  DbProviderConfig,
  DbProviderType,
  DbApiKey,
} from "@/types/litechat/provider";
// Corrected import path for helpers
import {
  supportsModelFetching,
  requiresApiKey,
  requiresBaseURL,
  PROVIDER_TYPES,
} from "@/lib/litechat/provider-helpers"; // Adjusted path

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
    type: "openai", // Default to a common type
    isEnabled: true,
    apiKeyId: null,
    baseURL: null,
    enabledModels: null,
    autoFetchModels: true, // Default based on 'openai'
    fetchedModels: null,
    modelsLastFetchedAt: null,
    modelSortOrder: null,
  });

  const handleNewChange = useCallback(
    (
      field: keyof DbProviderConfig,
      value: string | boolean | string[] | null,
    ) => {
      // Add explicit type for prev
      setNewProviderData((prev: Partial<DbProviderConfig>) => {
        const updated = { ...prev, [field]: value };
        // Reset dependent fields when type changes
        if (field === "type") {
          const newType = value as DbProviderType;
          updated.apiKeyId = null; // Reset API key link
          updated.baseURL = null; // Reset Base URL
          updated.autoFetchModels = supportsModelFetching(newType); // Update auto-fetch based on new type
          updated.enabledModels = null; // Reset model selections
          updated.modelSortOrder = null;
        }
        return updated;
      });
    },
    [],
  );

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

      // Construct the final object to send, ensuring all required fields are present
      const configToAdd: Omit<
        DbProviderConfig,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: newProviderData.name,
        type: type,
        isEnabled: newProviderData.isEnabled ?? true,
        apiKeyId: newProviderData.apiKeyId ?? null,
        baseURL: newProviderData.baseURL ?? null,
        enabledModels: null, // Start with no models enabled
        autoFetchModels: autoFetch,
        fetchedModels: null, // Start with no fetched models
        modelsLastFetchedAt: null,
        modelSortOrder: null, // Start with no specific sort order
      };

      await onAddProvider(configToAdd);
      onCancel(); // Close form on success
    } catch (error) {
      // Error toast likely handled by the caller (store action)
      console.error("Failed to add provider (from form component):", error);
    } finally {
      setIsSavingNew(false);
    }
  }, [newProviderData, onAddProvider, onCancel]);

  // Determine requirements based on the currently selected type in the form
  const needsKey = requiresApiKey(newProviderData.type ?? null);
  const needsURL = requiresBaseURL(newProviderData.type ?? null);
  const canFetch = supportsModelFetching(newProviderData.type ?? null);

  return (
    <div className="border border-primary rounded-md p-4 space-y-3 bg-card shadow-lg flex-shrink-0">
      <h4 className="font-semibold text-card-foreground">Add New Provider</h4>
      {/* Name and Type */}
      <div className="flex items-center space-x-2">
        <Input
          value={newProviderData.name || ""}
          onChange={(e) => handleNewChange("name", e.target.value)}
          placeholder="Provider Name (e.g., My Ollama)"
          className="flex-grow"
          disabled={isSavingNew}
          aria-label="Provider Name"
        />
        <Select
          value={newProviderData.type}
          onValueChange={(value) =>
            handleNewChange("type", value as DbProviderType)
          }
          disabled={isSavingNew}
        >
          <SelectTrigger className="w-[200px]" aria-label="Provider Type">
            <SelectValue placeholder="Select Type" />
          </SelectTrigger>
          <SelectContent>
            {/* Add explicit type for pt */}
            {PROVIDER_TYPES.map(
              (pt: { value: DbProviderType; label: string }) => (
                <SelectItem key={pt.value} value={pt.value}>
                  {pt.label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Switch
            id="new-enabled"
            checked={newProviderData.isEnabled}
            onCheckedChange={(checked) => handleNewChange("isEnabled", checked)}
            disabled={isSavingNew}
            aria-labelledby="new-enabled-label"
          />
          <Label id="new-enabled-label" htmlFor="new-enabled">
            Enabled
          </Label>
        </div>
      </div>
      {/* API Key and Base URL (Conditional) */}
      {(needsKey || needsURL) && (
        <div className="flex items-center space-x-2">
          {needsKey && (
            <ApiKeySelector
              label="API Key:"
              selectedKeyId={newProviderData.apiKeyId ?? null}
              // Add explicit type for keyId
              onKeySelected={(keyId: string | null) =>
                handleNewChange("apiKeyId", keyId)
              }
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
              className="flex-grow"
              disabled={isSavingNew}
              aria-label="Base URL"
            />
          )}
        </div>
      )}
      {/* Auto-fetch Toggle */}
      <div className="flex items-center space-x-2">
        <Switch
          id="new-autofetch"
          checked={newProviderData.autoFetchModels}
          onCheckedChange={(checked) =>
            handleNewChange("autoFetchModels", checked)
          }
          disabled={!canFetch || isSavingNew}
          aria-labelledby="new-autofetch-label"
        />
        <Label
          id="new-autofetch-label"
          htmlFor="new-autofetch"
          className={!canFetch ? "text-muted-foreground" : ""}
        >
          Auto-fetch models {canFetch ? "" : "(Not Supported)"}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        You can select/order specific models after adding the provider and
        fetching its models (if supported).
      </p>
      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSavingNew}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSaveNew}
          disabled={
            isSavingNew || !newProviderData.name || !newProviderData.type
          }
          type="button"
        >
          {isSavingNew && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSavingNew ? "Adding..." : "Add Provider"}
        </Button>
      </div>
    </div>
  );
};
