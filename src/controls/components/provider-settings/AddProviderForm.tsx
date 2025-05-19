// src/components/LiteChat/settings/AddProviderForm.tsx
// FULL FILE
import React, { useState, useCallback, useEffect } from "react";
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
    config: Omit<DbProviderConfig, "id" | "createdAt" | "updatedAt">
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
      autoFetchModels: false,
    }));
  }, [initialName, initialType, initialApiKeyId]);

  const handleNewChange = useCallback(
    (
      field: keyof ProviderFormData,
      value: string | boolean | string[] | null
    ) => {
      return new Promise<void>((resolve) => {
        setNewProviderData((prev) => {
          const updated = { ...prev, [field]: value };
          const currentName = prev.name || "";

          // Keep the logic for auto-filling name and resetting dependent fields
          if (field === "type") {
            const newType = value as DbProviderType | null;
            const oldProviderLabel = PROVIDER_TYPES.find(
              (p) => p.value === prev.type
            )?.label;

            updated.apiKeyId = null;
            updated.baseURL = null;
            updated.autoFetchModels = newType
              ? supportsModelFetching(newType)
              : false;

            const providerLabel = PROVIDER_TYPES.find(
              (p) => p.value === newType
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
                (k) => k.providerId === newType
              );
              if (relevantKeys.length > 0) {
                updated.apiKeyId = relevantKeys[0].id;
              }
            }
          }
          return updated;
        });
        resolve(void 0);
      });
    },
    [apiKeys]
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
        initialData={newProviderData}
        onSubmit={handleSaveNew}
        onCancel={onCancel}
        onChange={handleNewChange}
        apiKeys={apiKeys}
        disabled={isSavingNew}
      />
    </div>
  );
};
