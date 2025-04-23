
import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DbProviderConfig, DbApiKey } from "@/lib/types";
import { toast } from "sonner";
import { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ProviderRowViewMode } from "./settings-provider-row-view";
import { ProviderRowEditMode } from "./settings-provider-row-edit";


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
  provider, // Use prop
  apiKeys, // Use prop
  onUpdate, // Use prop action
  onDelete, // Use prop action
  onFetchModels, // Use prop action
  fetchStatus, // Use prop
  getAllAvailableModelDefs, // Use prop function
}) => {
  // Local UI state remains
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editData, setEditData] = useState<Partial<DbProviderConfig>>({});
  const [allAvailableModels, setAllAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);

  // Memoized list derivation remains the same, uses local state/props
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
      .sort((a, b) => a.name.localeCompare(b.name));
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

  // Drag handler remains the same, uses local state
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        setEditData((prevEdit) => {
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

  // Effect to initialize edit state uses props
  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id); // Use prop function
      models.sort((a, b) => a.name.localeCompare(b.name));
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
    getAllAvailableModelDefs, // Depend on prop function
  ]);

  // Handlers use props/prop actions
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setIsSaving(false);
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const finalSortOrder = editData.modelSortOrder;
      const finalEditData = {
        ...editData,
        enabledModels:
          editData.enabledModels && editData.enabledModels.length > 0
            ? editData.enabledModels
            : null,
        modelSortOrder:
          finalSortOrder && finalSortOrder.length > 0 ? finalSortOrder : null,
      };
      await onUpdate(provider.id, finalEditData); // Use prop action
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
  }, [editData, onUpdate, provider.id, provider.name]); // Depend on local state and prop action

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
        const currentSortOrder = prev.modelSortOrder ?? [];
        const newSortOrder = checked
          ? currentSortOrder
          : currentSortOrder.filter((id) => id !== modelId);
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
    if (
      window.confirm(
        `Are you sure you want to delete the provider "${provider.name}"? This action cannot be undone.`,
      )
    ) {
      setIsDeleting(true);
      try {
        await onDelete(provider.id); // Use prop action
        // Success toast handled by parent/store action
      } catch (error) {
        // Error toast handled by parent/store action
        setIsDeleting(false);
      }
    }
  }, [onDelete, provider.id, provider.name]); // Depend on prop action

  const handleFetchModels = useCallback(async () => {
    await onFetchModels(provider.id); // Use prop action
  }, [onFetchModels, provider.id]); // Depend on prop action

  const getAvailableModelsForView = useCallback(() => {
    return getAllAvailableModelDefs(provider.id); // Use prop function
  }, [getAllAvailableModelDefs, provider.id]); // Depend on prop function

  return (
    <div className="border-b border-gray-700 p-4 space-y-3">
      {isEditing ? (
        // Pass props down
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
        // Pass props down
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
