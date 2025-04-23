
import React from "react";
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
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ApiKeySelector } from "@/components/lite-chat/api-key-selector";
import {
  requiresApiKey,
  requiresBaseURL,
  supportsModelFetching,
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableModelItem } from "@/components/lite-chat/sortable-model-item";


interface ProviderRowEditModeProps {
  providerId: string;
  editData: Partial<DbProviderConfig>; // Local edit state from ProviderRow
  apiKeys: DbApiKey[]; // Passed down
  allAvailableModels: { id: string; name: string }[]; // Passed down
  orderedEnabledModels: { id: string; name: string }[]; // Passed down
  orderedEnabledModelIds: string[]; // Passed down
  isSaving: boolean; // Passed down
  onCancel: () => void; // Passed down
  onSave: () => Promise<void>; // Passed down
  onChange: (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => void; // Passed down
  onEnabledModelChange: (modelId: string, checked: boolean) => void; // Passed down
  onDragEnd: (event: DragEndEvent) => void; // Passed down
}


const ProviderRowEditModeComponent: React.FC<ProviderRowEditModeProps> = ({
  providerId,
  editData, // Use prop
  apiKeys, // Use prop
  allAvailableModels, // Use prop
  orderedEnabledModels, // Use prop
  orderedEnabledModelIds, // Use prop
  isSaving, // Use prop
  onCancel, // Use prop action
  onSave, // Use prop action
  onChange, // Use prop action
  onEnabledModelChange, // Use prop action
  onDragEnd, // Use prop action
}) => {
  // Derivations use props
  const needsKey = requiresApiKey(editData.type ?? null);
  const needsURL = requiresBaseURL(editData.type ?? null);
  const canFetch = supportsModelFetching(editData.type ?? null);

  // DND setup remains the same
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <div className="space-y-4">
      {/* Basic Provider Settings Section - Use props */}
      <div className="space-y-3 border border-gray-600 rounded-md p-3 bg-gray-800/30">
        <h4 className="text-md font-semibold text-gray-200 mb-2">
          Basic Configuration
        </h4>
        <div className="flex items-center space-x-2">
          <Input
            value={editData.name || ""}
            onChange={(e) => onChange("name", e.target.value)} // Use prop action
            placeholder="Provider Name"
            className="flex-grow bg-gray-700 border-gray-600 text-white"
            disabled={isSaving} // Use prop
          />
          <Select
            value={editData.type}
            onValueChange={(value) => onChange("type", value as DbProviderType)} // Use prop action
            disabled={isSaving} // Use prop
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
              id={`edit-enabled-${providerId}`}
              checked={editData.isEnabled}
              onCheckedChange={(checked) => onChange("isEnabled", checked)} // Use prop action
              disabled={isSaving} // Use prop
            />
            <Label htmlFor={`edit-enabled-${providerId}`}>Enabled</Label>
          </div>
        </div>
        {(needsKey || needsURL) && (
          <div className="flex items-center space-x-2">
            {needsKey && (
              <ApiKeySelector
                label="API Key:"
                selectedKeyId={editData.apiKeyId ?? null}
                onKeySelected={(keyId) => onChange("apiKeyId", keyId)} // Use prop action
                apiKeys={apiKeys} // Use prop
                className="flex-grow"
                disabled={isSaving} // Use prop
              />
            )}
            {needsURL && (
              <Input
                value={editData.baseURL || ""}
                onChange={(e) => onChange("baseURL", e.target.value)} // Use prop action
                placeholder="Base URL (e.g., http://localhost:11434)"
                className="flex-grow bg-gray-700 border-gray-600 text-white"
                disabled={isSaving} // Use prop
              />
            )}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Switch
            id={`edit-autofetch-${providerId}`}
            checked={editData.autoFetchModels}
            onCheckedChange={(checked) => onChange("autoFetchModels", checked)} // Use prop action
            disabled={!canFetch || isSaving} // Use derived state and prop
          />
          <Label
            htmlFor={`edit-autofetch-${providerId}`}
            className={!canFetch ? "text-gray-500" : ""}
          >
            Auto-fetch models {canFetch ? "" : "(Not Supported)"}
          </Label>
        </div>
      </div>
      {/* End Basic Provider Settings */}

      <Separator className="my-4 bg-gray-600" />

      {/* Model Management Section - Use props */}
      <div className="space-y-3">
        <h4 className="text-md font-semibold text-gray-200">
          Model Management
        </h4>
        {/* Use allAvailableModels prop */}
        {allAvailableModels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Column 1: Checkbox list */}
            <div className="space-y-2 border border-gray-600 rounded-md p-3 bg-gray-800/30">
              <Label className="font-medium text-gray-300">
                Available Models
              </Label>
              <p className="text-xs text-gray-400">
                Check models to enable them for use.
              </p>
              <ScrollArea className="h-48 w-full rounded-md border border-gray-600 p-2 bg-gray-700">
                <div className="space-y-1">
                  {/* Use allAvailableModels prop */}
                  {allAvailableModels.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center space-x-2 p-1 rounded"
                    >
                      <Checkbox
                        id={`enable-model-${providerId}-${model.id}`}
                        checked={(editData.enabledModels ?? []).includes(
                          model.id,
                        )}
                        onCheckedChange={(checked) =>
                          onEnabledModelChange(model.id, !!checked)
                        } // Use prop action
                        className="border-gray-500 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
                        disabled={isSaving} // Use prop
                      />
                      <Label
                        htmlFor={`enable-model-${providerId}-${model.id}`}
                        className="text-sm font-normal text-white flex-grow"
                      >
                        {model.name || model.id}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Column 2: Reorderable list */}
            <div className="space-y-2 border border-gray-600 rounded-md p-3 bg-gray-800/30">
              <Label className="font-medium text-gray-300">
                Enabled & Ordered Models
              </Label>
              <p className="text-xs text-gray-400">
                Drag to set the display order in the chat dropdown.
              </p>
              <ScrollArea className="h-48 w-full rounded-md border border-gray-600 p-2 bg-gray-700">
                {/* Use orderedEnabledModels prop */}
                {orderedEnabledModels.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd} // Use prop action
                  >
                    <SortableContext
                      items={orderedEnabledModelIds} // Use prop
                      strategy={verticalListSortingStrategy}
                    >
                      {/* Use orderedEnabledModels prop */}
                      {orderedEnabledModels.map((model) => (
                        <SortableModelItem
                          key={model.id}
                          id={model.id}
                          name={model.name || model.id}
                          disabled={isSaving} // Use prop
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
      {/* End Model Management */}

      {/* Save/Cancel Buttons - Use props */}
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel} // Use prop action
          disabled={isSaving} // Use prop
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave} // Use prop action
          disabled={isSaving} // Use prop
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};


export const ProviderRowEditMode = React.memo(ProviderRowEditModeComponent);
