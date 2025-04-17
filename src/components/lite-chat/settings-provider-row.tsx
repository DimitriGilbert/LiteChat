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
  // ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
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
  // editData holds the state being modified, including enabledModels and modelSortOrder
  const [editData, setEditData] = useState<Partial<DbProviderConfig>>({});
  // allAvailableModels holds the full list fetched/default for checkbox display
  const [allAvailableModels, setAllAvailableModels] = useState<
    { id: string; name: string }[]
  >([]);

  // Memoized list of currently *enabled* models, ordered for the reordering UI
  const orderedEnabledModels = useMemo<{ id: string; name: string }[]>(() => {
    if (!isEditing) return [];

    const enabledIds = new Set(editData.enabledModels ?? []);
    if (enabledIds.size === 0) return []; // No models enabled, nothing to order

    // Filter allAvailableModels to get only the enabled ones
    const enabledModelDefs = allAvailableModels.filter((m) =>
      enabledIds.has(m.id),
    );

    // Get the current sort order specific to enabled models
    const currentSortOrder = editData.modelSortOrder ?? [];
    const orderedList: { id: string; name: string }[] = [];
    const addedIds = new Set<string>();

    // Add models based on the sort order
    for (const modelId of currentSortOrder) {
      // Only add if it's actually enabled
      if (enabledIds.has(modelId)) {
        const model = enabledModelDefs.find((m) => m.id === modelId);
        if (model && !addedIds.has(modelId)) {
          orderedList.push(model);
          addedIds.add(modelId);
        }
      }
    }

    // Add any remaining *enabled* models that weren't in the sort order
    const remainingEnabled = enabledModelDefs
      .filter((m) => !addedIds.has(m.id))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort remaining alphabetically

    return [...orderedList, ...remainingEnabled];
  }, [
    isEditing,
    editData.enabledModels,
    editData.modelSortOrder,
    allAvailableModels,
  ]);

  useEffect(() => {
    if (isEditing) {
      const models = getAllAvailableModelDefs(provider.id);
      // Sort all available models alphabetically for the checkbox list display
      models.sort((a, b) => a.name.localeCompare(b.name));
      setAllAvailableModels(models);

      // Initialize editData with current provider values
      // modelSortOrder will be derived by the useMemo based on enabledModels initially
      setEditData({
        name: provider.name,
        type: provider.type,
        isEnabled: provider.isEnabled,
        apiKeyId: provider.apiKeyId,
        baseURL: provider.baseURL,
        // Use current enabled models or default to empty array
        enabledModels: provider.enabledModels ?? [],
        autoFetchModels: provider.autoFetchModels,
        // Use current sort order, default to null/undefined
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
    setIsEditing(true); // Initialization happens in useEffect
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    // No need to clear allAvailableModels here, useEffect handles it
  };

  const handleSave = async () => {
    try {
      // The final modelSortOrder should be based on the current orderedEnabledModels
      const finalSortOrder = orderedEnabledModels.map((m) => m.id);
      const finalEditData = {
        ...editData,
        // Ensure enabledModels is saved correctly based on checkboxes
        // Save as null if the array is empty
        enabledModels:
          editData.enabledModels && editData.enabledModels.length > 0
            ? editData.enabledModels
            : null,
        // Save the order derived from the UI
        // Save as null if the array is empty
        modelSortOrder: finalSortOrder.length > 0 ? finalSortOrder : null,
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
    }
  };

  const handleChange = (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  // Handles checkbox changes for enabling/disabling models
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

        // Also update modelSortOrder: remove if unchecked, keep order otherwise
        // Note: The useMemo for orderedEnabledModels will automatically reflect this change
        const currentSortOrder = prev.modelSortOrder ?? [];
        const newSortOrder = checked
          ? currentSortOrder.includes(modelId)
            ? currentSortOrder // Keep existing order if already there
            : [...currentSortOrder, modelId] // Add to end if newly enabled (useMemo will fix order later)
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

  // --- Model Reordering Logic (operates on orderedEnabledModels) ---
  const moveEnabledModel = useCallback(
    (index: number, direction: "up" | "down") => {
      const currentOrderedIds = orderedEnabledModels.map((m) => m.id);
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= currentOrderedIds.length ||
        index < 0 ||
        index >= currentOrderedIds.length
      ) {
        return; // Invalid move
      }

      // Create new sorted array
      const newOrderedIds = [...currentOrderedIds];
      [newOrderedIds[index], newOrderedIds[targetIndex]] = [
        newOrderedIds[targetIndex],
        newOrderedIds[index],
      ];

      // Update the modelSortOrder in editData immediately
      setEditData((prevEdit) => ({
        ...prevEdit,
        modelSortOrder: newOrderedIds, // Save the new order
      }));
      // The useMemo will update orderedEnabledModels based on this new sort order
    },
    [orderedEnabledModels], // Depend on the derived ordered list
  );
  // --- End Model Reordering Logic ---

  const handleDelete = async () => {
    if (
      window.confirm(
        `Are you sure you want to delete the provider "${provider.name}"?`,
      )
    ) {
      try {
        await onDelete(provider.id);
        toast.success(`Provider "${provider.name}" deleted.`);
      } catch (error) {
        toast.error(
          `Failed to delete provider: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  const currentProvider = isEditing ? { ...provider, ...editData } : provider;
  const needsKey = requiresApiKey(currentProvider.type);
  const needsURL = requiresBaseURL(currentProvider.type);
  const canFetch = supportsModelFetching(currentProvider.type);

  return (
    <div className="border-b border-gray-700 p-4 space-y-3">
      {isEditing ? (
        // --- Edit Mode ---
        <div className="space-y-3">
          {/* --- Basic Provider Settings (Name, Type, Enabled, API Key, URL, Auto-fetch) --- */}
          <div className="flex items-center space-x-2">
            <Input
              value={editData.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Provider Name"
              className="flex-grow bg-gray-700 border-gray-600 text-white"
            />
            <Select
              value={editData.type}
              onValueChange={(value) =>
                handleChange("type", value as DbProviderType)
              }
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
                />
              )}
              {needsURL && (
                <Input
                  value={editData.baseURL || ""}
                  onChange={(e) => handleChange("baseURL", e.target.value)}
                  placeholder="Base URL (e.g., http://localhost:11434)"
                  className="flex-grow bg-gray-700 border-gray-600 text-white"
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
              disabled={!canFetch}
            />
            <Label
              htmlFor={`edit-autofetch-${provider.id}`}
              className={!canFetch ? "text-gray-500" : ""}
            >
              Auto-fetch models {canFetch ? "" : "(Not Supported)"}
            </Label>
          </div>
          {/* --- End Basic Provider Settings --- */}

          {/* --- Model Selection & Ordering Section --- */}
          {allAvailableModels.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Column 1: Checkbox list of ALL available models */}
              <div className="space-y-2">
                <Label>Available Models (Check to Enable)</Label>
                <p className="text-xs text-gray-400">
                  Select models here to make them available for ordering and use
                  in the dropdown.
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
                          // Check state comes directly from editData.enabledModels
                          checked={(editData.enabledModels ?? []).includes(
                            model.id,
                          )}
                          onCheckedChange={(checked) =>
                            handleEnabledModelChange(model.id, !!checked)
                          }
                          className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
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
              <div className="space-y-2">
                <Label>Enabled Models (Drag/Use Arrows to Order)</Label>
                <p className="text-xs text-gray-400">
                  Set the display order for the selected models in the main chat
                  dropdown.
                </p>
                <ScrollArea className="h-48 w-full rounded-md border border-gray-600 p-2 bg-gray-700">
                  {orderedEnabledModels.length > 0 ? (
                    <div className="space-y-1">
                      {/* Iterate over the derived ordered list of *enabled* models */}
                      {orderedEnabledModels.map((model, index) => (
                        <div
                          key={model.id}
                          className="flex items-center space-x-2 p-1 rounded hover:bg-gray-600"
                        >
                          {/* Reorder Buttons */}
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0 text-gray-400 hover:text-white"
                              onClick={() => moveEnabledModel(index, "up")}
                              disabled={index === 0}
                              aria-label="Move model up"
                            >
                              <ArrowUpIcon className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0 text-gray-400 hover:text-white"
                              onClick={() => moveEnabledModel(index, "down")}
                              disabled={
                                index === orderedEnabledModels.length - 1
                              }
                              aria-label="Move model down"
                            >
                              <ArrowDownIcon className="h-3 w-3" />
                            </Button>
                          </div>
                          {/* Model Name */}
                          <Label className="text-sm font-normal text-white flex-grow">
                            {model.name || model.id}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-gray-500">
                      Enable models using the checkboxes on the left.
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
          {/* --- End Model Selection & Ordering --- */}

          {/* Save/Cancel Buttons */}
          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <XIcon className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSave}>
              <SaveIcon className="h-4 w-4 mr-1" /> Save
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
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" onClick={handleEdit}>
                <Edit2Icon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDelete}>
                <Trash2Icon className="h-4 w-4 text-red-500" />
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
                  disabled={fetchStatus === "fetching"}
                  className="text-xs"
                >
                  {fetchStatus === "fetching" && (
                    <RefreshCwIcon className="h-3 w-3 mr-1 animate-spin" />
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
