// src/components/lite-chat/settings-provider-row.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DbProviderConfig, DbApiKey } from "@/lib/types";
import { toast } from "sonner";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ProviderRowViewMode } from "./settings-provider-row-view";
import { ProviderRowEditMode } from "./settings-provider-row-edit";

export interface ProviderRowProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onUpdate: (id: string, changes: Partial<DbProviderConfig>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onFetchModels: (id: string) => Promise<void>;
  fetchStatus: "idle" | "fetching" | "error" | "success";
  getAllAvailableModelDefs: (
    providerConfigId: string,
  ) => { id: string; name: string }[];
}

export const ProviderRow: React.FC<ProviderRowProps> = ({
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

  // Memoized list of currently *enabled* models, ordered for the reordering UI
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

    // Add models based on the current sort order
    for (const modelId of currentSortOrder) {
      if (enabledIds.has(modelId)) {
        const model = enabledModelDefs.find((m) => m.id === modelId);
        if (model && !addedIds.has(modelId)) {
          orderedList.push(model);
          addedIds.add(modelId);
        }
      }
    }

    // Add any remaining enabled models (not in sort order yet) alphabetically
    const remainingEnabled = enabledModelDefs
      .filter((m) => !addedIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [...orderedList, ...remainingEnabled];
  }, [
    isEditing,
    editData.enabledModels,
    editData.modelSortOrder,
    allAvailableModels,
  ]);

  // Get IDs for SortableContext items prop
  const orderedEnabledModelIds = useMemo(
    () => orderedEnabledModels.map((m) => m.id),
    [orderedEnabledModels],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        setEditData((prevEdit) => {
          // Use the derived orderedEnabledModels for accurate indices
          const currentOrderedIds = orderedEnabledModels.map((m) => m.id);
          const oldIndex = currentOrderedIds.indexOf(active.id as string);
          const newIndex = currentOrderedIds.indexOf(over.id as string);

          if (oldIndex === -1 || newIndex === -1) {
            console.warn("Could not find dragged item indices in derived list");
            return prevEdit; // Should not happen if logic is correct
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
    [orderedEnabledModels], // Depend on the derived ordered list for indices
  );

  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id);
      models.sort((a, b) => a.name.localeCompare(b.name));
      setAllAvailableModels(models);

      // Initialize editData with current provider values
      setEditData({
        name: provider.name,
        type: provider.type,
        isEnabled: provider.isEnabled,
        apiKeyId: provider.apiKeyId,
        baseURL: provider.baseURL,
        enabledModels: provider.enabledModels ?? [],
        autoFetchModels: provider.autoFetchModels,
        // Initialize sort order based on current provider data or derive if null/empty
        modelSortOrder: provider.modelSortOrder ?? null,
      });
    } else {
      setAllAvailableModels([]); // Clear when not editing
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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setIsSaving(false); // Reset saving state on cancel
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Final sort order comes directly from editData state updated by drag-n-drop
      const finalSortOrder = editData.modelSortOrder;
      const finalEditData = {
        ...editData,
        // Ensure empty arrays become null for DB consistency
        enabledModels:
          editData.enabledModels && editData.enabledModels.length > 0
            ? editData.enabledModels
            : null,
        modelSortOrder:
          finalSortOrder && finalSortOrder.length > 0 ? finalSortOrder : null,
      };
      await onUpdate(provider.id, finalEditData);
      setIsEditing(false);
      setEditData({});
      toast.success(
        `Provider "${finalEditData.name || provider.name}" updated.`,
      );
    } catch (error) {
      toast.error(
        `Failed to update provider: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = useCallback(
    (
      field: keyof DbProviderConfig,
      value: string | boolean | string[] | null,
    ) => {
      setEditData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleEnabledModelChange = useCallback(
    (modelId: string, checked: boolean) => {
      setEditData((prev) => {
        const currentEnabledSet = new Set(prev.enabledModels ?? []);
        if (checked) {
          currentEnabledSet.add(modelId);
        } else {
          currentEnabledSet.delete(modelId);
        }
        const newEnabledModels = Array.from(currentEnabledSet);

        // Update modelSortOrder: remove if unchecked, keep order otherwise
        // The actual visual order is handled by the `orderedEnabledModels` memo
        const currentSortOrder = prev.modelSortOrder ?? [];
        const newSortOrder = checked
          ? currentSortOrder // Keep existing order, new items handled by memo
          : currentSortOrder.filter((id) => id !== modelId); // Remove if unchecked

        return {
          ...prev,
          enabledModels: newEnabledModels,
          modelSortOrder: newSortOrder.length > 0 ? newSortOrder : null,
        };
      });
    },
    [],
  );

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete the provider "${provider.name}"? This action cannot be undone.`,
      )
    ) {
      setIsDeleting(true);
      try {
        await onDelete(provider.id);
        toast.success(`Provider "${provider.name}" deleted.`);
        // No need to setIsDeleting(false) as the component will unmount
      } catch (error) {
        toast.error(
          `Failed to delete provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        setIsDeleting(false); // Reset if deletion failed
      }
    }
  };

  const handleFetchModels = useCallback(async () => {
    await onFetchModels(provider.id);
  }, [onFetchModels, provider.id]);

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
