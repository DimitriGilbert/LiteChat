// src/components/LiteChat/settings/SettingsProviderRowEdit.tsx
import React from "react";
import type {
  DbProviderConfig,
  DbApiKey,
  DbProviderType,
} from "@/types/litechat/provider";
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
import { ApiKeySelector } from "@/components/LiteChat/settings/ApiKeySelector";
import {
  requiresApiKey,
  requiresBaseURL,
  supportsModelFetching,
  PROVIDER_TYPES,
} from "@/lib/litechat/provider-helpers";
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
import { SortableModelItem } from "@/components/LiteChat/settings/SortableModelItem";

interface ProviderRowEditModeProps {
  providerId: string;
  editData: Partial<DbProviderConfig>;
  apiKeys: DbApiKey[];
  allAvailableModels: { id: string; name: string }[];
  orderedEnabledModels: { id: string; name: string }[];
  orderedEnabledModelIds: string[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => Promise<void>;
  onChange: (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => void;
  onEnabledModelChange: (modelId: string, checked: boolean) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

const ProviderRowEditModeComponent: React.FC<ProviderRowEditModeProps> = ({
  providerId,
  editData,
  apiKeys,
  allAvailableModels,
  orderedEnabledModels,
  orderedEnabledModelIds,
  isSaving,
  onCancel,
  onSave,
  onChange,
  onEnabledModelChange,
  onDragEnd,
}) => {
  const needsKey = requiresApiKey(editData.type ?? null);
  const needsURL = requiresBaseURL(editData.type ?? null);
  const canFetch = supportsModelFetching(editData.type ?? null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Ensure boolean fields have defaults for controlled components
  const isEnabled = editData.isEnabled ?? false;
  const autoFetchModels = editData.autoFetchModels ?? false;

  return (
    <div className="space-y-4">
      {/* Basic Settings */}
      <div className="space-y-3 border border-border rounded-md p-3 bg-card/80">
        <h4 className="text-md font-semibold text-card-foreground mb-2">
          Basic Configuration
        </h4>
        <div className="flex items-center space-x-2">
          <Input
            value={editData.name || ""}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Provider Name"
            className="flex-grow"
            disabled={isSaving}
            aria-label="Provider Name"
          />
          <Select
            // Ensure value is never undefined
            value={editData.type ?? ""}
            onValueChange={(value) => onChange("type", value as DbProviderType)}
            disabled={isSaving}
          >
            <SelectTrigger className="w-[200px]" aria-label="Provider Type">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_TYPES.map(
                (pt: { value: DbProviderType; label: string }) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {pt.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <Switch
              id={`edit-enabled-${providerId}`}
              // Ensure checked is always boolean
              checked={isEnabled}
              onCheckedChange={(checked) => onChange("isEnabled", checked)}
              disabled={isSaving}
              aria-labelledby={`edit-enabled-label-${providerId}`}
            />
            <Label
              id={`edit-enabled-label-${providerId}`}
              htmlFor={`edit-enabled-${providerId}`}
            >
              Enabled
            </Label>
          </div>
        </div>
        {(needsKey || needsURL) && (
          <div className="flex items-center space-x-2">
            {needsKey && (
              <ApiKeySelector
                label="API Key:"
                selectedKeyId={editData.apiKeyId ?? null}
                onKeySelected={(keyId: string | null) =>
                  onChange("apiKeyId", keyId)
                }
                apiKeys={apiKeys}
                className="flex-grow"
                disabled={isSaving}
              />
            )}
            {needsURL && (
              <Input
                value={editData.baseURL || ""}
                onChange={(e) => onChange("baseURL", e.target.value)}
                placeholder="Base URL (e.g., http://localhost:11434)"
                className="flex-grow"
                disabled={isSaving}
                aria-label="Base URL"
              />
            )}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <Switch
            id={`edit-autofetch-${providerId}`}
            // Ensure checked is always boolean
            checked={autoFetchModels}
            onCheckedChange={(checked) => onChange("autoFetchModels", checked)}
            disabled={!canFetch || isSaving}
            aria-labelledby={`edit-autofetch-label-${providerId}`}
          />
          <Label
            id={`edit-autofetch-label-${providerId}`}
            htmlFor={`edit-autofetch-${providerId}`}
            className={!canFetch ? "text-muted-foreground" : ""}
          >
            Auto-fetch models {canFetch ? "" : "(Not Supported)"}
          </Label>
        </div>
      </div>

      <Separator className="my-4 bg-border" />

      {/* Model Management */}
      <div className="space-y-3">
        <h4 className="text-md font-semibold text-card-foreground">
          Model Management
        </h4>
        {allAvailableModels.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Available Models Checkbox List */}
            <div className="space-y-2 border border-border rounded-md p-3 bg-card/80">
              <Label className="font-medium text-card-foreground">
                Available Models
              </Label>
              <p className="text-xs text-muted-foreground">
                Check models to enable them for use.
              </p>
              <ScrollArea className="h-48 w-full rounded-md border border-border p-2 bg-background/50">
                <div className="space-y-1">
                  {allAvailableModels.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center space-x-2 p-1 rounded"
                    >
                      <Checkbox
                        id={`enable-model-${providerId}-${model.id}`}
                        // Ensure checked is always boolean
                        checked={(editData.enabledModels ?? []).includes(
                          model.id,
                        )}
                        onCheckedChange={(checked) =>
                          onEnabledModelChange(model.id, !!checked)
                        }
                        className="border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        disabled={isSaving}
                        aria-labelledby={`enable-model-label-${providerId}-${model.id}`}
                      />
                      <Label
                        id={`enable-model-label-${providerId}-${model.id}`}
                        htmlFor={`enable-model-${providerId}-${model.id}`}
                        className="text-sm font-normal text-card-foreground flex-grow cursor-pointer"
                      >
                        {model.name || model.id}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Enabled & Ordered Models List */}
            <div className="space-y-2 border border-border rounded-md p-3 bg-card/80">
              <Label className="font-medium text-card-foreground">
                Enabled & Ordered Models
              </Label>
              <p className="text-xs text-muted-foreground">
                Drag to set the display order in the chat dropdown.
              </p>
              <ScrollArea className="h-48 w-full rounded-md border border-border p-2 bg-background/50">
                {orderedEnabledModels.length > 0 ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
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
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Enable models on the left to order them here.
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No models available. Fetch models or check provider settings.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          type="button"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export const ProviderRowEditMode = React.memo(ProviderRowEditModeComponent);
