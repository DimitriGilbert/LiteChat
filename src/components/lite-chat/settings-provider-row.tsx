import React, { useState, useEffect, useCallback, useMemo } from "react";
import type { DbProviderConfig, DbApiKey, DbProviderType } from "@/lib/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Trash2Icon,
  SaveIcon,
  Edit2Icon,
  XIcon,
  RefreshCwIcon,
  CheckIcon,
  AlertCircleIcon,
  Loader2,
  GripVerticalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiKeySelector } from "./api-key-selector";
import {
  supportsModelFetching,
  requiresApiKey,
  requiresBaseURL,
  PROVIDER_TYPES,
} from "@/lib/litechat";
import { Separator } from "@/components/ui/separator";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Sortable Item Component ---
interface SortableModelItemProps {
  id: string;
  name: string;
  disabled?: boolean;
}

const SortableModelItem: React.FC<SortableModelItemProps> = ({
  id,
  name,
  disabled,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id, disabled: disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined, // Ensure dragging item is on top
    cursor: disabled ? "not-allowed" : "grab",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-2 p-1 rounded bg-gray-700 hover:bg-gray-600 mb-1"
    >
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        className={`p-1 text-gray-400 ${!disabled ? "hover:text-white cursor-grab active:cursor-grabbing" : "cursor-not-allowed"}`}
        aria-label="Drag to reorder model"
      >
        <GripVerticalIcon className="h-4 w-4" />
      </button>
      <Label className="text-sm font-normal text-white flex-grow truncate">
        {name || id}
      </Label>
    </div>
  );
};
// --- End Sortable Item Component ---

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

  // --- Dnd-Kit Setup ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        setEditData((prevEdit) => {
          const oldOrder = prevEdit.modelSortOrder ?? [];
          const oldIndex = oldOrder.indexOf(active.id as string);
          const newIndex = oldOrder.indexOf(over.id as string);

          // If items aren't found in sortOrder (e.g., newly added), use orderedEnabledModels
          const currentOrderedIds = orderedEnabledModels.map((m) => m.id);
          const activeIndexFallback = currentOrderedIds.indexOf(
            active.id as string,
          );
          const overIndexFallback = currentOrderedIds.indexOf(
            over.id as string,
          );

          const sourceIndex = oldIndex !== -1 ? oldIndex : activeIndexFallback;
          const destinationIndex =
            newIndex !== -1 ? newIndex : overIndexFallback;

          if (sourceIndex === -1 || destinationIndex === -1) {
            console.warn("Could not find dragged item indices");
            return prevEdit; // Should not happen if logic is correct
          }

          const newOrderedIds = arrayMove(
            currentOrderedIds,
            sourceIndex,
            destinationIndex,
          );

          return {
            ...prevEdit,
            modelSortOrder: newOrderedIds,
          };
        });
      }
    },
    [orderedEnabledModels],
  ); // Depend on the derived ordered list for indices

  // --- End Dnd-Kit Setup ---

  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id);
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
        // Initialize sort order based on current provider data or derive if null
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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setIsSaving(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Final sort order comes directly from editData state updated by drag-n-drop
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

  const handleChange = (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

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

        // Update modelSortOrder: remove if unchecked, add if newly checked (order handled by useMemo)
        const currentSortOrder = prev.modelSortOrder ?? [];
        const newSortOrder = checked
          ? currentSortOrder.includes(modelId)
            ? currentSortOrder
            : [...currentSortOrder, modelId] // Add to end initially
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
      } catch (error) {
        toast.error(
          `Failed to delete provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        setIsDeleting(false);
      }
    }
  };

  const currentProvider = isEditing ? { ...provider, ...editData } : provider;
  const needsKey = requiresApiKey(currentProvider.type);
  const needsURL = requiresBaseURL(currentProvider.type);
  const canFetch = supportsModelFetching(currentProvider.type);
  const isFetchButtonDisabled = fetchStatus === "fetching" || isDeleting;
  const isEditButtonDisabled = isDeleting;
  const isDeleteButtonDisabled = isDeleting || fetchStatus === "fetching";

  // Get IDs for SortableContext items prop
  const orderedEnabledModelIds = useMemo(
    () => orderedEnabledModels.map((m) => m.id),
    [orderedEnabledModels],
  );

  return (
    <div className="border-b border-gray-700 p-4 space-y-3">
      {isEditing ? (
        // --- Edit Mode ---
        <div className="space-y-4">
          {/* --- Basic Provider Settings Section --- */}
          <div className="space-y-3 border border-gray-600 rounded-md p-3 bg-gray-800/30">
            <h4 className="text-md font-semibold text-gray-200 mb-2">
              Basic Configuration
            </h4>
            <div className="flex items-center space-x-2">
              <Input
                value={editData.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Provider Name"
                className="flex-grow bg-gray-700 border-gray-600 text-white"
                disabled={isSaving}
              />
              <Select
                value={editData.type}
                onValueChange={(value) =>
                  handleChange("type", value as DbProviderType)
                }
                disabled={isSaving}
              >
                <SelectTrigger className="w-[180px] bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-600">
                  {PROVIDER_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2">
                <Switch
                  id={`edit-enabled-${provider.id}`}
                  checked={editData.isEnabled}
                  onCheckedChange={(checked) =>
                    handleChange("isEnabled", checked)
                  }
                  disabled={isSaving}
                />
                <Label htmlFor={`edit-enabled-${provider.id}`}>Enabled</Label>
              </div>
            </div>
            {(needsKey || needsURL) && (
              <div className="flex items-center space-x-2">
                {needsKey && (
                  <ApiKeySelector
                    label="API Key:"
                    selectedKeyId={editData.apiKeyId ?? null}
                    onKeySelected={(keyId) => handleChange("apiKeyId", keyId)}
                    apiKeys={apiKeys}
                    className="flex-grow"
                    disabled={isSaving}
                  />
                )}
                {needsURL && (
                  <Input
                    value={editData.baseURL || ""}
                    onChange={(e) => handleChange("baseURL", e.target.value)}
                    placeholder="Base URL (e.g., http://localhost:11434)"
                    className="flex-grow bg-gray-700 border-gray-600 text-white"
                    disabled={isSaving}
                  />
                )}
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Switch
                id={`edit-autofetch-${provider.id}`}
                checked={editData.autoFetchModels}
                onCheckedChange={(checked) =>
                  handleChange("autoFetchModels", checked)
                }
                disabled={!canFetch || isSaving}
              />
              <Label
                htmlFor={`edit-autofetch-${provider.id}`}
                className={!canFetch ? "text-gray-500" : ""}
              >
                Auto-fetch models {canFetch ? "" : "(Not Supported)"}
              </Label>
            </div>
          </div>
          {/* --- End Basic Provider Settings --- */}

          <Separator className="my-4 bg-gray-600" />

          {/* --- Model Management Section --- */}
          <div className="space-y-3">
            <h4 className="text-md font-semibold text-gray-200">
              Model Management
            </h4>
            {allAvailableModels.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Column 1: Checkbox list of ALL available models */}
                <div className="space-y-2 border border-gray-600 rounded-md p-3 bg-gray-800/30">
                  <Label className="font-medium text-gray-300">
                    Available Models
                  </Label>
                  <p className="text-xs text-gray-400">
                    Check models to enable them for use.
                  </p>
                  <ScrollArea className="h-48 w-full rounded-md border border-gray-600 p-2 bg-gray-700">
                    <div className="space-y-1">
                      {allAvailableModels.map((model) => (
                        <div
                          key={model.id}
                          className="flex items-center space-x-2 p-1 rounded"
                        >
                          <Checkbox
                            id={`enable-model-${provider.id}-${model.id}`}
                            checked={(editData.enabledModels ?? []).includes(
                              model.id,
                            )}
                            onCheckedChange={(checked) =>
                              handleEnabledModelChange(model.id, !!checked)
                            }
                            className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                            disabled={isSaving}
                          />
                          <Label
                            htmlFor={`enable-model-${provider.id}-${model.id}`}
                            className="text-sm font-normal text-white flex-grow"
                          >
                            {model.name || model.id}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Column 2: Reorderable list of ENABLED models */}
                <div className="space-y-2 border border-gray-600 rounded-md p-3 bg-gray-800/30">
                  <Label className="font-medium text-gray-300">
                    Enabled & Ordered Models
                  </Label>
                  <p className="text-xs text-gray-400">
                    Drag to set the display order in the chat dropdown.
                  </p>
                  <ScrollArea className="h-48 w-full rounded-md border border-gray-600 p-2 bg-gray-700">
                    {orderedEnabledModels.length > 0 ? (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={orderedEnabledModelIds}
                          strategy={verticalListSortingStrategy}
                        >
                          {orderedEnabledModels.map((model) => (
                            <SortableModelItem
                              key={model.id}
                              id={model.id}
                              name={model.name || model.id}
                              disabled={isSaving}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    ) : (
                      <div className="flex items-center justify-center h-full text-sm text-gray-500">
                        Enable models on the left to order them here.
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No models available. Fetch models or check provider settings.
              </p>
            )}
          </div>
          {/* --- End Model Management --- */}

          {/* Save/Cancel Buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <XIcon className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <SaveIcon className="h-4 w-4 mr-1" />{" "}
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        // --- View Mode ---
        <div>
          {/* (Provider Header: Name, Type, Status, Edit/Delete Buttons) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span
                className={`h-2 w-2 rounded-full ${provider.isEnabled ? "bg-green-500" : "bg-gray-500"}`}
              ></span>
              <h3 className="font-semibold text-lg text-white">
                {provider.name}
              </h3>
              <span className="text-sm text-gray-400">({provider.type})</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEdit}
                disabled={isEditButtonDisabled}
                aria-label="Edit provider"
              >
                <Edit2Icon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={isDeleteButtonDisabled}
                className="text-red-500 hover:text-red-400"
                aria-label="Delete provider"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2Icon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {/* (Provider Details: API Key, URL, Auto-fetch) */}
          <div className="text-sm text-gray-400 mt-1 space-y-1">
            {needsKey && (
              <div>
                API Key:{" "}
                {provider.apiKeyId ? (
                  <span className="text-green-400">
                    {apiKeys.find((k) => k.id === provider.apiKeyId)?.name ||
                      "Linked"}
                  </span>
                ) : (
                  <span className="text-amber-400">Not Linked</span>
                )}
              </div>
            )}
            {needsURL && <div>Base URL: {provider.baseURL || "Not Set"}</div>}
            <div>
              Auto-fetch Models:{" "}
              {provider.autoFetchModels ? (
                <span className="text-green-400">Enabled</span>
              ) : (
                <span className="text-gray-500">Disabled</span>
              )}
            </div>
            {/* Display Ordered & Enabled Models List */}
            {provider.enabledModels && provider.enabledModels.length > 0 && (
              <div className="pt-1">
                <span className="font-medium text-gray-300">
                  Enabled & Ordered Models ({provider.enabledModels.length}):
                </span>
                <ScrollArea className="h-16 mt-1 rounded-md border border-gray-600 p-2 bg-gray-900 text-xs">
                  {/* Display based on modelSortOrder if available, otherwise just enabledModels */}
                  {(provider.modelSortOrder ?? provider.enabledModels).map(
                    (modelId) => {
                      // Ensure we only display models that are actually enabled
                      if (!provider.enabledModels?.includes(modelId))
                        return null;
                      const modelDef = getAllAvailableModelDefs(
                        provider.id,
                      ).find((m) => m.id === modelId);
                      const modelName = modelDef?.name || modelId;
                      return <div key={modelId}>{modelName}</div>;
                    },
                  )}
                </ScrollArea>
              </div>
            )}
            {/* Display All Available Models List (if fetched or default) */}
            {getAllAvailableModelDefs(provider.id).length > 0 && (
              <div className="pt-1">
                <span className="font-medium text-gray-300">
                  All Available Models (
                  {getAllAvailableModelDefs(provider.id).length}):
                </span>
                <ScrollArea className="h-20 mt-1 rounded-md border border-gray-600 p-2 bg-gray-900 text-xs">
                  {getAllAvailableModelDefs(provider.id)
                    .slice() // Create a copy before sorting
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((m) => (
                      <div key={m.id}>{m.name || m.id}</div>
                    ))}
                </ScrollArea>
                {provider.fetchedModels && (
                  <span className="text-xs text-gray-500">
                    Last fetched:{" "}
                    {provider.modelsLastFetchedAt
                      ? provider.modelsLastFetchedAt.toLocaleString()
                      : "Never"}
                  </span>
                )}
              </div>
            )}
            {/* Fetch Models Button */}
            {canFetch && (
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFetchModels(provider.id)}
                  disabled={isFetchButtonDisabled}
                  className="text-xs"
                >
                  {fetchStatus === "fetching" && (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  )}
                  {fetchStatus === "success" && (
                    <CheckIcon className="h-3 w-3 mr-1 text-green-500" />
                  )}
                  {fetchStatus === "error" && (
                    <AlertCircleIcon className="h-3 w-3 mr-1 text-red-500" />
                  )}
                  {fetchStatus === "idle" && (
                    <RefreshCwIcon className="h-3 w-3 mr-1" />
                  )}
                  {fetchStatus === "fetching"
                    ? "Fetching..."
                    : "Fetch Models Now"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
