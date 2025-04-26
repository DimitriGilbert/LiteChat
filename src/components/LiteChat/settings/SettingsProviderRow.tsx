// src/components/LiteChat/settings/SettingsProviderRow.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import { toast } from "sonner";
// Removed Dnd/Sortable imports
import { ProviderRowViewMode } from "./SettingsProviderRowView";
import { ProviderRowEditMode } from "./SettingsProviderRowEdit";
import { useProviderStore } from "@/store/provider.store";

type FetchStatus = "idle" | "fetching" | "error" | "success";
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

  // Removed orderedEnabledModels and orderedEnabledModelIds memos
  // Removed handleDragEnd callback

  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefsForProvider(provider.id);
      setRawAvailableModels(models);

      // Initialize editData without modelSortOrder
      setEditData({
        name: provider.name,
        type: provider.type,
        isEnabled: provider.isEnabled,
        apiKeyId: provider.apiKeyId,
        baseURL: provider.baseURL,
        enabledModels: provider.enabledModels ?? [],
        autoFetchModels: provider.autoFetchModels,
        // modelSortOrder removed
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
    // provider.modelSortOrder removed
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
      // Ensure enabledModels is null if empty
      const finalEnabledModels =
        editData.enabledModels && editData.enabledModels.length > 0
          ? editData.enabledModels
          : null;
      // finalSortOrder removed

      // Include model lists in the final data
      const finalEditData: Partial<DbProviderConfig> = {
        name: editData.name,
        type: editData.type,
        isEnabled: editData.isEnabled,
        apiKeyId: editData.apiKeyId,
        baseURL: editData.baseURL,
        autoFetchModels: editData.autoFetchModels,
        enabledModels: finalEnabledModels,
        // modelSortOrder removed
      };

      Object.keys(finalEditData).forEach((key) => {
        if (finalEditData[key as keyof typeof finalEditData] === undefined) {
          delete finalEditData[key as keyof typeof finalEditData];
        }
      });

      await onUpdate(provider.id, finalEditData);
      setIsEditing(false);
      setEditData({});
      toast.success(
        `Provider "${finalEditData.name || provider.name}" updated.`,
      );
    } catch (error) {
      console.error("Failed to save provider update:", error);
      // Toast handled by store action or caller
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

  const handleEnabledModelChange = useCallback(
    (modelId: string, checked: boolean) => {
      setEditData((prev: Partial<DbProviderConfig>) => {
        const currentEnabledSet = new Set(prev.enabledModels ?? []);
        if (checked) {
          currentEnabledSet.add(modelId);
        } else {
          currentEnabledSet.delete(modelId);
        }
        const newEnabledModels = Array.from(currentEnabledSet);

        // No need to update sort order here anymore
        return {
          ...prev,
          enabledModels: newEnabledModels,
        };
      });
    },
    [],
  );

  const handleDelete = useCallback(async () => {
    if (window.confirm(`Delete provider "${provider.name}"?`)) {
      setIsDeleting(true);
      try {
        await onDelete(provider.id);
        // Toast handled by store action or caller
      } catch (error) {
        // Error handled by store action or caller
        setIsDeleting(false); // Ensure state resets on error
      }
      // No finally needed if success leads to unmount
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
    <div className="border-b border-border p-4 space-y-3">
      {isEditing ? (
        <ProviderRowEditMode
          providerId={provider.id}
          editData={editData}
          apiKeys={apiKeys}
          allAvailableModels={allAvailableModels}
          isSaving={isSaving}
          onCancel={handleCancel}
          onSave={handleSave}
          onChange={handleChange}
          onEnabledModelChange={handleEnabledModelChange}
          // onDragEnd removed
        />
      ) : (
        <ProviderRowViewMode
          provider={provider}
          apiKeys={apiKeys}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onFetchModels={handleFetchModels}
          fetchStatus={fetchStatus}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export const ProviderRow = React.memo(ProviderRowComponent);
