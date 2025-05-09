// src/components/LiteChat/settings/SettingsProviderRow.tsx
// FULL FILE
import React, { useState, useEffect, useCallback, useMemo } from "react";
// Import OpenRouterModel for allAvailableModels state
import type {
  DbProviderConfig,
  DbApiKey,
  OpenRouterModel,
} from "@/types/litechat/provider";
import { toast } from "sonner";
import { ProviderRowViewMode } from "./SettingsProviderRowView";
import { ProviderRowEditMode } from "./SettingsProviderRowEdit";
import { useProviderStore } from "@/store/provider.store";

export type FetchStatus = "idle" | "fetching" | "error" | "success";
export interface ProviderRowProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onUpdate: (id: string, changes: Partial<DbProviderConfig>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onFetchModels: (id: string) => Promise<void>;
  fetchStatus: FetchStatus;
  onSelectModelForDetails: (combinedModelId: string | null) => void;
}

const ProviderRowComponent: React.FC<ProviderRowProps> = ({
  provider,
  apiKeys,
  onUpdate,
  onDelete,
  onFetchModels,
  fetchStatus,
  onSelectModelForDetails,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editData, setEditData] = useState<Partial<DbProviderConfig>>({});

  const getAllAvailableModelDefsForProvider = useProviderStore(
    (state) => state.getAllAvailableModelDefsForProvider,
  );

  // State to hold OpenRouterModel[] for the edit mode
  const [allAvailableModelsForEdit, setAllAvailableModelsForEdit] = useState<
    OpenRouterModel[]
  >([]);

  // Memoize the sorted list for view mode (still uses OpenRouterModel from store)
  const allAvailableModelsForView = useMemo(() => {
    const models = getAllAvailableModelDefsForProvider(provider.id);
    return [...models].sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id),
    );
  }, [provider.id, getAllAvailableModelDefsForProvider]);

  useEffect(() => {
    if (isEditing) {
      // Fetch and set OpenRouterModel[] when entering edit mode
      const models = getAllAvailableModelDefsForProvider(provider.id);
      setAllAvailableModelsForEdit(
        [...models].sort((a, b) =>
          (a.name || a.id).localeCompare(b.name || b.id),
        ),
      );
      setEditData({
        name: provider.name,
        type: provider.type,
        isEnabled: provider.isEnabled,
        apiKeyId: provider.apiKeyId,
        baseURL: provider.baseURL,
        enabledModels: provider.enabledModels ?? [],
        autoFetchModels: provider.autoFetchModels,
      });
    } else {
      setAllAvailableModelsForEdit([]); // Clear when not editing
    }
  }, [
    isEditing,
    provider.id,
    provider.name,
    provider.type,
    provider.isEnabled,
    provider.apiKeyId,
    provider.baseURL,
    provider.enabledModels,
    provider.autoFetchModels,
    getAllAvailableModelDefsForProvider,
  ]);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setIsSaving(false);
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const finalEnabledModels =
        editData.enabledModels && editData.enabledModels.length > 0
          ? editData.enabledModels
          : null;

      const finalChanges: Partial<DbProviderConfig> = {
        name: editData.name,
        type: editData.type,
        isEnabled: editData.isEnabled,
        apiKeyId: editData.apiKeyId,
        baseURL: editData.baseURL,
        autoFetchModels: editData.autoFetchModels,
        enabledModels: finalEnabledModels,
      };

      Object.keys(finalChanges).forEach((key) => {
        if (finalChanges[key as keyof typeof finalChanges] === undefined) {
          delete finalChanges[key as keyof typeof finalChanges];
        }
      });

      await onUpdate(provider.id, finalChanges);
      setIsEditing(false);
      setEditData({});
      toast.success(
        `Provider "${finalChanges.name || provider.name}" updated.`,
      );
    } catch (_error) {
      console.error("Failed to save provider update:", _error);
      toast.error("Failed to save provider configuration.");
    } finally {
      setIsSaving(false);
    }
  }, [editData, onUpdate, provider.id, provider.name]);

  const handleChange = useCallback(
    (
      field: keyof DbProviderConfig,
      value: string | boolean | string[] | null,
    ) => {
      setEditData((prev: Partial<DbProviderConfig>) => ({
        ...prev,
        [field]: value,
      }));
    },
    [],
  );

  const handleDelete = useCallback(async () => {
    if (window.confirm(`Delete provider "${provider.name}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete(provider.id);
      } catch (error) {
        console.error("Failed to delete provider:", error);
        setIsDeleting(false);
      }
    }
  }, [onDelete, provider.id, provider.name]);

  const handleFetchModels = useCallback(async () => {
    await onFetchModels(provider.id);
    if (isEditing) {
      // Re-fetch and update models for edit mode after fetching
      const models = getAllAvailableModelDefsForProvider(provider.id);
      setAllAvailableModelsForEdit(
        [...models].sort((a, b) =>
          (a.name || a.id).localeCompare(b.name || b.id),
        ),
      );
    }
  }, [
    onFetchModels,
    provider.id,
    isEditing,
    getAllAvailableModelDefsForProvider,
  ]);

  return (
    <div className="border border-border p-4 space-y-3 bg-card rounded-md shadow-sm">
      {isEditing ? (
        <ProviderRowEditMode
          providerId={provider.id}
          editData={editData}
          apiKeys={apiKeys}
          allAvailableModels={allAvailableModelsForEdit} // Pass OpenRouterModel[]
          isSaving={isSaving}
          onCancel={handleCancel}
          onSave={handleSave}
          onChange={handleChange}
        />
      ) : (
        <ProviderRowViewMode
          provider={provider}
          apiKeys={apiKeys}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onFetchModels={handleFetchModels}
          onUpdate={onUpdate} // Pass onUpdate for direct toggling in view mode
          fetchStatus={fetchStatus}
          isDeleting={isDeleting}
          onSelectModelForDetails={onSelectModelForDetails}
          // Pass the memoized list for view mode
          allAvailableModelsForView={allAvailableModelsForView}
        />
      )}
    </div>
  );
};

export const ProviderRow = React.memo(ProviderRowComponent);
