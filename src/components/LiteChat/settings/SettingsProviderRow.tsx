// src/components/LiteChat/settings/SettingsProviderRow.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
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
}

const ProviderRowComponent: React.FC<ProviderRowProps> = ({
  provider,
  apiKeys,
  onUpdate,
  onDelete,
  onFetchModels,
  fetchStatus,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editData, setEditData] = useState<Partial<DbProviderConfig>>({});

  const getAllAvailableModelDefsForProvider = useProviderStore(
    (state) => state.getAllAvailableModelDefsForProvider,
  );

  const [rawAvailableModels, setRawAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);

  const allAvailableModels = useMemo(() => {
    return [...rawAvailableModels].sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id),
    );
  }, [rawAvailableModels]);

  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefsForProvider(provider.id);
      setRawAvailableModels(models);
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
      setRawAvailableModels([]);
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
    provider.fetchedModels,
    getAllAvailableModelDefsForProvider,
  ]);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setIsSaving(false);
  };

  // Saves ALL changes from the edit form, including enabledModels
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Ensure enabledModels is null if empty before saving
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
        enabledModels: finalEnabledModels, // Include enabledModels in save
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

  // Handles changes to the editData state
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
      // No finally needed, state is reset on success or error catch
    }
  }, [onDelete, provider.id, provider.name]);

  const handleFetchModels = useCallback(async () => {
    await onFetchModels(provider.id);
    if (isEditing) {
      const models = getAllAvailableModelDefsForProvider(provider.id);
      setRawAvailableModels(models);
    }
  }, [
    onFetchModels,
    provider.id,
    isEditing,
    getAllAvailableModelDefsForProvider,
  ]);

  return (
    <div className="border-b border-border p-4 space-y-3 bg-card rounded-md shadow-sm">
      {isEditing ? (
        <ProviderRowEditMode
          providerId={provider.id}
          editData={editData}
          apiKeys={apiKeys}
          allAvailableModels={allAvailableModels}
          isSaving={isSaving}
          onCancel={handleCancel}
          onSave={handleSave} // Saves all changes
          onChange={handleChange} // Updates local editData
          onUpdate={onUpdate} // Still needed for potential future direct updates
        />
      ) : (
        <ProviderRowViewMode
          provider={provider}
          apiKeys={apiKeys}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onFetchModels={handleFetchModels}
          onUpdate={onUpdate} // Pass onUpdate for immediate toggle save
          fetchStatus={fetchStatus}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export const ProviderRow = React.memo(ProviderRowComponent);
