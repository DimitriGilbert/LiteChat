// src/components/LiteChat/settings/AddProviderForm.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
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
import { ApiKeySelector } from "@/components/LiteChat/settings/ApiKeySelector";
import type {
  DbProviderConfig,
  DbProviderType,
  DbApiKey,
} from "@/types/litechat/provider";
import {
  supportsModelFetching,
  requiresApiKey,
  requiresBaseURL,
  PROVIDER_TYPES,
} from "@/lib/litechat/provider-helpers";
import { cn } from "@/lib/utils";

interface AddProviderFormProps {
  apiKeys: DbApiKey[];
  onAddProvider: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  onCancel: () => void;
  // Add optional initial props
  initialType?: DbProviderType;
  initialName?: string;
  initialApiKeyId?: string | null;
}

export const AddProviderForm: React.FC<AddProviderFormProps> = ({
  apiKeys,
  onAddProvider,
  onCancel,
  initialType = "openai",
  initialName = "",
  initialApiKeyId = null,
}) => {
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [newProviderData, setNewProviderData] = useState<
    Partial<DbProviderConfig> & {
      type: DbProviderType | null; // Allow null initially
      isEnabled: boolean;
      autoFetchModels: boolean;
    }
  >({
    name: initialName,
    type: initialType,
    isEnabled: true,
    apiKeyId: initialApiKeyId,
    baseURL: null,
    enabledModels: null,
    autoFetchModels: false,
    fetchedModels: null,
    modelsLastFetchedAt: null,
  });

  // Effect to sync with initial props if they change (e.g., in EmptyStateSetup)
  useEffect(() => {
    setNewProviderData((prev) => ({
      ...prev,
      name: initialName || prev.name || "", // Prioritize prop, then existing, then empty
      type: initialType || prev.type || null,
      apiKeyId: initialApiKeyId || prev.apiKeyId || null,
      autoFetchModels: initialType
        ? supportsModelFetching(initialType)
        : prev.autoFetchModels,
    }));
  }, [initialName, initialType, initialApiKeyId]);

  const handleNewChange = useCallback(
    (
      field: keyof DbProviderConfig,
      value: string | boolean | string[] | null,
    ) => {
      setNewProviderData((prev) => {
        const updated = { ...prev, [field]: value };
        const currentName = prev.name || "";

        // Prefill logic when type changes
        if (field === "type") {
          const newType = value as DbProviderType | null;
          const oldProviderLabel = PROVIDER_TYPES.find(
            (p) => p.value === prev.type,
          )?.label;

          updated.apiKeyId = null; // Reset API key on type change
          updated.baseURL = null; // Reset Base URL
          updated.autoFetchModels = newType
            ? supportsModelFetching(newType)
            : false;
          updated.enabledModels = null;

          // Prefill name if empty or matches old provider label
          const providerLabel = PROVIDER_TYPES.find(
            (p) => p.value === newType,
          )?.label;
          if (
            providerLabel &&
            (!currentName.trim() || currentName === oldProviderLabel)
          ) {
            updated.name = providerLabel;
          }

          // Auto-select first relevant API key if available
          if (newType && requiresApiKey(newType)) {
            const relevantKeys = (apiKeys || []).filter(
              (k) => k.providerId === newType,
            );
            if (relevantKeys.length > 0) {
              updated.apiKeyId = relevantKeys[0].id;
            }
          }
        }

        if (field === "isEnabled" || field === "autoFetchModels") {
          updated[field] = !!value;
        }
        return updated;
      });
    },
    [apiKeys], // Add apiKeys dependency for auto-selection logic
  );

  const handleSaveNew = useCallback(async () => {
    if (!newProviderData.name?.trim() || !newProviderData.type) {
      toast.error("Provider Name and Type are required.");
      return;
    }
    setIsSavingNew(true);
    try {
      const type = newProviderData.type!;
      const autoFetch =
        newProviderData.autoFetchModels ?? supportsModelFetching(type);

      const configToAdd: Omit<
        DbProviderConfig,
        "id" | "createdAt" | "updatedAt"
      > = {
        name: newProviderData.name.trim(),
        type: type,
        isEnabled: newProviderData.isEnabled ?? true,
        apiKeyId: newProviderData.apiKeyId ?? null,
        baseURL: newProviderData.baseURL?.trim() || null,
        enabledModels: null, // Start with no models enabled
        autoFetchModels: autoFetch,
        fetchedModels: null,
        modelsLastFetchedAt: null,
      };

      await onAddProvider(configToAdd);
      onCancel(); // Close form on success
    } catch (error) {
      console.error("Failed to add provider (from form component):", error);
      // Toast handled by store action or caller
    } finally {
      setIsSavingNew(false);
    }
  }, [newProviderData, onAddProvider, onCancel]);

  const needsKey = requiresApiKey(newProviderData.type ?? null);
  const needsURL = requiresBaseURL(newProviderData.type ?? null);
  const canFetch = supportsModelFetching(newProviderData.type ?? null);

  // Filter API keys based on the selected provider type
  const relevantApiKeys = (apiKeys || []).filter(
    (key) => !newProviderData.type || key.providerId === newProviderData.type,
  );

  return (
    <div className="border border-primary rounded-md p-4 space-y-3 bg-card shadow-lg flex-shrink-0">
      <h4 className="font-semibold text-card-foreground">Add New Provider</h4>

      {/* Grid layout for better responsiveness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Provider Type (Moved First) */}
        <div className="space-y-1.5">
          <Label htmlFor="new-provider-type">Provider Type</Label>
          <Select
            value={newProviderData.type ?? ""} // Handle null type
            onValueChange={(value) =>
              handleNewChange("type", value as DbProviderType)
            }
            disabled={isSavingNew}
          >
            <SelectTrigger id="new-provider-type">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPES.map((pt) => (
                <SelectItem key={pt.value} value={pt.value}>
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Provider Name */}
        <div className="space-y-1.5">
          <Label htmlFor="new-provider-name">Provider Name</Label>
          <Input
            id="new-provider-name"
            value={newProviderData.name || ""}
            onChange={(e) => handleNewChange("name", e.target.value)}
            placeholder="e.g., My Ollama"
            disabled={isSavingNew}
            aria-label="Provider Name"
          />
        </div>

        {/* API Key (Conditional) */}
        {needsKey && (
          <div className="space-y-1.5 md:col-span-2">
            <Label>API Key</Label>
            <ApiKeySelector
              label="API Key" // Simplified label
              selectedKeyId={newProviderData.apiKeyId ?? null}
              onKeySelected={(keyId: string | null) =>
                handleNewChange("apiKeyId", keyId)
              }
              // Pass filtered keys
              apiKeys={relevantApiKeys}
              disabled={isSavingNew || !newProviderData.type} // Disable if type not selected
            />
          </div>
        )}

        {/* Base URL (Conditional) */}
        {needsURL && (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="new-provider-baseurl">Base URL</Label>
            <Input
              id="new-provider-baseurl"
              value={newProviderData.baseURL || ""}
              onChange={(e) => handleNewChange("baseURL", e.target.value)}
              placeholder="Base URL (e.g., http://localhost:11434)"
              disabled={isSavingNew}
              aria-label="Base URL"
            />
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="new-enabled"
            checked={newProviderData.isEnabled ?? true}
            onCheckedChange={(checked) => handleNewChange("isEnabled", checked)}
            disabled={isSavingNew}
            aria-labelledby="new-enabled-label"
          />
          <Label id="new-enabled-label" htmlFor="new-enabled">
            Enabled
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="new-autofetch"
            checked={newProviderData.autoFetchModels ?? false}
            onCheckedChange={(checked) =>
              handleNewChange("autoFetchModels", checked)
            }
            disabled={!canFetch || isSavingNew}
            aria-labelledby="new-autofetch-label"
          />
          <Label
            id="new-autofetch-label"
            htmlFor="new-autofetch"
            className={cn("text-sm", !canFetch ? "text-muted-foreground" : "")}
          >
            Auto-fetch models {canFetch ? "" : "(Not Supported)"}
          </Label>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Models fetched will appear in the global organizer above after fetching.
      </p>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-2">
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
            isSavingNew ||
            !newProviderData.name?.trim() ||
            !newProviderData.type
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
