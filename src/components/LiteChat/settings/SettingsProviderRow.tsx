// src/components/LiteChat/settings/SettingsProviderRow.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
// Corrected import path for types
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider"; // Correct path
import { toast } from "sonner";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
// Corrected import paths for sub-components
import { ProviderRowViewMode } from "./SettingsProviderRowView"; // Correct path
import { ProviderRowEditMode } from "./SettingsProviderRowEdit"; // Correct path

type FetchStatus = "idle" | "fetching" | "error" | "success";
export interface ProviderRowProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onUpdate: (id: string, changes: Partial<DbProviderConfig>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onFetchModels: (id: string) => Promise<void>;
  fetchStatus: FetchStatus;
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
}

const ProviderRowComponent: React.FC<ProviderRowProps> = ({
  provider,
  apiKeys,
  onUpdate,
  onDelete,
  onFetchModels,
  fetchStatus,
  getAllAvailableModelDefs,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editData, setEditData] = useState<Partial<DbProviderConfig>>({});
  const [allAvailableModels, setAllAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);

  const orderedEnabledModels = useMemo<{ id: string; name: string }[]>(() => {
    if (!isEditing) return [];
    const enabledIds = new Set(editData.enabledModels ?? []);
    if (enabledIds.size === 0) return [];
    const enabledModelDefs = allAvailableModels.filter((m) =>
      enabledIds.has(m.id),
    );
    const currentSortOrder = editData.modelSortOrder ?? [];
    const orderedList: { id: string; name: string }[] = [];
    const addedIds = new Set<string>();
    for (const modelId of currentSortOrder) {
      if (enabledIds.has(modelId)) {
        const model = enabledModelDefs.find((m) => m.id === modelId);
        if (model && !addedIds.has(modelId)) {
          orderedList.push(model);
          addedIds.add(modelId);
        }
      }
    }
    const remainingEnabled = enabledModelDefs
      .filter((m) => !addedIds.has(m.id))
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    return [...orderedList, ...remainingEnabled];
  }, [
    isEditing,
    editData.enabledModels,
    editData.modelSortOrder,
    allAvailableModels,
  ]);

  const orderedEnabledModelIds = useMemo(
    () => orderedEnabledModels.map((m) => m.id),
    [orderedEnabledModels],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setEditData((prevEdit: Partial<DbProviderConfig>) => {
          const currentOrderedIds = orderedEnabledModels.map((m) => m.id);
          const oldIndex = currentOrderedIds.indexOf(active.id as string);
          const newIndex = currentOrderedIds.indexOf(over.id as string);
          if (oldIndex === -1 || newIndex === -1) {
            return prevEdit;
          }
          const newOrderedIds = arrayMove(
            currentOrderedIds,
            oldIndex,
            newIndex,
          );
          return {
            ...prevEdit,
            modelSortOrder: newOrderedIds,
          };
        });
      }
    },
    [orderedEnabledModels],
  );

  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id);
      models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      setAllAvailableModels(models);
      setEditData({
        name: provider.name,
        type: provider.type,
        isEnabled: provider.isEnabled,
        apiKeyId: provider.apiKeyId,
        baseURL: provider.baseURL,
        enabledModels: provider.enabledModels ?? [],
        autoFetchModels: provider.autoFetchModels,
        modelSortOrder: provider.modelSortOrder ?? null,
      });
    } else {
      setAllAvailableModels([]);
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
    provider.modelSortOrder,
    getAllAvailableModelDefs,
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
      const finalSortOrder =
        editData.modelSortOrder && editData.modelSortOrder.length > 0
          ? editData.modelSortOrder
          : null;
      const finalEditData: Partial<DbProviderConfig> = {
        ...editData,
        enabledModels: finalEnabledModels,
        modelSortOrder: finalSortOrder,
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
        const currentSortOrder = prev.modelSortOrder ?? [];
        let newSortOrder: string[];
        if (checked) {
          newSortOrder = currentSortOrder.includes(modelId)
            ? currentSortOrder
            : [...currentSortOrder, modelId];
        } else {
          newSortOrder = currentSortOrder.filter(
            (id: string) => id !== modelId,
          );
        }
        return {
          ...prev,
          enabledModels: newEnabledModels,
          modelSortOrder: newSortOrder.length > 0 ? newSortOrder : null,
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
      } catch (error) {
        setIsDeleting(false);
      }
    }
  }, [onDelete, provider.id, provider.name]);

  const handleFetchModels = useCallback(async () => {
    await onFetchModels(provider.id);
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id);
      models.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      setAllAvailableModels(models);
    }
  }, [onFetchModels, provider.id, isEditing, getAllAvailableModelDefs]);

  const getAvailableModelsForView = useCallback(() => {
    return getAllAvailableModelDefs(provider.id);
  }, [getAllAvailableModelDefs, provider.id]);

  return (
    <div className="border-b border-gray-700 p-4 space-y-3">
      {isEditing ? (
        <ProviderRowEditMode
          providerId={provider.id}
          editData={editData}
          apiKeys={apiKeys}
          allAvailableModels={allAvailableModels}
          orderedEnabledModels={orderedEnabledModels}
          orderedEnabledModelIds={orderedEnabledModelIds}
          isSaving={isSaving}
          onCancel={handleCancel}
          onSave={handleSave}
          onChange={handleChange}
          onEnabledModelChange={handleEnabledModelChange}
          onDragEnd={handleDragEnd}
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
          getAllAvailableModelDefs={getAvailableModelsForView}
        />
      )}
    </div>
  );
};

export const ProviderRow = React.memo(ProviderRowComponent);
