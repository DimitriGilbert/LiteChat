// src/components/LiteChat/settings/AddProviderForm.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type {
  DbProviderConfig,
  DbProviderType,
  DbApiKey,
} from "@/types/litechat/provider";
import {
  supportsModelFetching,
  PROVIDER_TYPES,
  requiresApiKey,
} from "@/lib/litechat/provider-helpers";
import { ProviderConfigForm, ProviderFormData } from "./ProviderConfigForm"; // Import the shared form

interface AddProviderFormProps {
  apiKeys: DbApiKey[];
  onAddProvider: (
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  onCancel: () => void;
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
  // Use the shared form data type
  const [newProviderData, setNewProviderData] = useState<ProviderFormData>({
    name: initialName,
    type: initialType,
    isEnabled: true,
    apiKeyId: initialApiKeyId,
    baseURL: null,
    autoFetchModels: supportsModelFetching(initialType),
  });

  // Effect to sync with initial props if they change
  useEffect(() => {
    setNewProviderData((prev) => ({
      ...prev,
      name: initialName || prev.name || "",
      type: initialType || prev.type || null,
      apiKeyId: initialApiKeyId || prev.apiKeyId || null,
      autoFetchModels: initialType
        ? supportsModelFetching(initialType)
        : prev.autoFetchModels,
    }));
  }, [initialName, initialType, initialApiKeyId]);

  const handleNewChange = useCallback(
    (
      field: keyof ProviderFormData,
      value: string | boolean | string[] | null,
    ) => {
      setNewProviderData((prev) => {
        const updated = { ...prev, [field]: value };
        const currentName = prev.name || "";

        // Keep the logic for auto-filling name and resetting dependent fields
        if (field === "type") {
          const newType = value as DbProviderType | null;
          const oldProviderLabel = PROVIDER_TYPES.find(
            (p) => p.value === prev.type,
          )?.label;

          updated.apiKeyId = null;
          updated.baseURL = null;
          updated.autoFetchModels = newType
            ? supportsModelFetching(newType)
            : false;

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
        return updated;
      });
    },
    [apiKeys],
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
        enabledModels: null, // Add form doesn't handle model enablement
        autoFetchModels: autoFetch,
        fetchedModels: null,
        modelsLastFetchedAt: null,
      };

      await onAddProvider(configToAdd);
      onCancel(); // Close the form on success
    } catch (error) {
      console.error("Failed to add provider (from form component):", error);
      // Error toast handled by the store action usually
    } finally {
      setIsSavingNew(false);
    }
  }, [newProviderData, onAddProvider, onCancel]);

  return (
    <div className="border border-primary rounded-md p-4 space-y-3 bg-card shadow-lg flex-shrink-0">
      <h4 className="font-semibold text-card-foreground">Add New Provider</h4>

      {/* Use the shared form component */}
      <ProviderConfigForm
        formData={newProviderData}
        onChange={handleNewChange}
        apiKeys={apiKeys}
        disabled={isSavingNew}
      />

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
