// src/components/LiteChat/settings/SettingsProviderRow.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import { toast } from "sonner";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ProviderRowViewMode } from "./SettingsProviderRowView";
import { ProviderRowEditMode } from "./SettingsProviderRowEdit";

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
  // Store the raw models fetched for editing
  const [rawAvailableModels, setRawAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);

  // Memoize the sorted version for display/use in edit mode
  const allAvailableModels = useMemo(() => {
    // Create a copy and sort it
    return [...rawAvailableModels].sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id),
    );
  }, [rawAvailableModels]);

  const orderedEnabledModels = useMemo<{ id: string; name: string }[]>(() => {
    if (!isEditing) return [];
    const enabledIds = new Set(editData.enabledModels ?? []);
    if (enabledIds.size === 0) return [];

    // Filter from the already sorted 'allAvailableModels'
    const enabledModelDefs = allAvailableModels.filter((m) =>
      enabledIds.has(m.id),
    );

    const currentSortOrder = editData.modelSortOrder ?? [];
    const orderedList: { id: string; name: string }[] = [];
    const addedIds = new Set<string>();

    // Build the ordered list based on modelSortOrder
    for (const modelId of currentSortOrder) {
      if (enabledIds.has(modelId)) {
        const model = enabledModelDefs.find((m) => m.id === modelId);
        if (model && !addedIds.has(modelId)) {
          orderedList.push(model);
          addedIds.add(modelId);
        }
      }
    }

    // Find remaining enabled models (those not in sortOrder)
    // Filter from the already sorted 'enabledModelDefs'
    const remainingEnabled = enabledModelDefs.filter(
      (m) => !addedIds.has(m.id),
    );
    // No need to sort remainingEnabled again as they inherit order from allAvailableModels

    return [...orderedList, ...remainingEnabled];
  }, [
    isEditing,
    editData.enabledModels,
    editData.modelSortOrder,
    allAvailableModels, // Depend on the sorted version
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
          // Use the current ordered IDs directly from the memoized state
          const currentOrderedIds = orderedEnabledModels.map((m) => m.id);
          const oldIndex = currentOrderedIds.indexOf(active.id as string);
          const newIndex = currentOrderedIds.indexOf(over.id as string);
          if (oldIndex === -1 || newIndex === -1) {
            return prevEdit; // Should not happen if IDs are correct
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
    [orderedEnabledModels], // Depend on the memoized state
  );

  useEffect(() => {
    if (isEditing) {
      // Fetch raw models and store them
      const models = getAllAvailableModelDefs(provider.id);
      setRawAvailableModels(models); // Store raw, unsorted models

      // Initialize editData based on the provider prop
      setEditData({
        name: provider.name,
        type: provider.type,
        isEnabled: provider.isEnabled,
        apiKeyId: provider.apiKeyId,
        baseURL: provider.baseURL,
        enabledModels: provider.enabledModels ?? [], // Ensure it's always an array
        autoFetchModels: provider.autoFetchModels,
        modelSortOrder: provider.modelSortOrder ?? null,
      });
    } else {
      setRawAvailableModels([]); // Clear raw models when not editing
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
    setEditData({}); // Clear edit data
    setIsSaving(false);
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Ensure enabledModels and modelSortOrder are null if empty
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

      // Remove undefined keys before sending update (optional, belt-and-suspenders)
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
      // Toast handled by the store action
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

        // Update sort order based on the new enabled models
        const currentSortOrder = prev.modelSortOrder ?? [];
        let newSortOrder: string[];
        if (checked) {
          // Add to sort order only if not already present
          newSortOrder = currentSortOrder.includes(modelId)
            ? currentSortOrder
            : [...currentSortOrder, modelId];
        } else {
          // Remove from sort order
          newSortOrder = currentSortOrder.filter(
            (id: string) => id !== modelId,
          );
        }

        return {
          ...prev,
          enabledModels: newEnabledModels,
          // Ensure modelSortOrder is null if empty, otherwise use the new array
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
        // Success toast handled by parent/store action
      } catch (error) {
        // Error toast handled by parent/store action
        setIsDeleting(false); // Ensure state is reset on error
      }
      // No finally needed as state is reset on error if it throws
    }
  }, [onDelete, provider.id, provider.name]);

  const handleFetchModels = useCallback(async () => {
    await onFetchModels(provider.id);
    // Re-fetch available models for edit mode if it's open after fetch completes
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id);
      setRawAvailableModels(models); // Update raw models
    }
  }, [onFetchModels, provider.id, isEditing, getAllAvailableModelDefs]);

  // Memoize the function passed to ViewMode to avoid unnecessary re-renders
  const getAvailableModelsForView = useCallback(() => {
    return getAllAvailableModelDefs(provider.id);
  }, [getAllAvailableModelDefs, provider.id]);

  return (
    <div className="border-b border-border p-4 space-y-3">
      {isEditing ? (
        <ProviderRowEditMode
          providerId={provider.id}
          editData={editData}
          apiKeys={apiKeys}
          allAvailableModels={allAvailableModels} // Pass the sorted version
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
