// src/components/LiteChat/settings/SettingsProviderRowEdit.tsx
import React, { useCallback, useMemo } from "react"
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
import { Label } from "@/components/ui/label";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
// ScrollArea removed
import { ApiKeySelector } from "@/components/LiteChat/settings/ApiKeySelector";
import {
  requiresApiKey,
  requiresBaseURL,
  supportsModelFetching,
  PROVIDER_TYPES,
} from "@/lib/litechat/provider-helpers";
import { Separator } from "@/components/ui/separator";
// Toast removed
import { ModelEnablementList } from "./ModelEnablementList"

interface ProviderRowEditModeProps {
  providerId: string;
  editData: Partial<DbProviderConfig>;
  apiKeys: DbApiKey[];
  allAvailableModels: { id: string; name: string }[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => Promise<void>;
  onChange: (
    field: keyof DbProviderConfig,
    value: string | boolean | string[] | null,
  ) => void;
  onUpdate: (id: string, changes: Partial<DbProviderConfig>) => Promise<void>;
}

const ProviderRowEditModeComponent: React.FC<ProviderRowEditModeProps> = ({
  providerId,
  editData,
  apiKeys,
  allAvailableModels,
  isSaving,
  onCancel,
  onSave,
  onChange,
  // onUpdate is no longer needed directly here for toggles
}) => {
  const needsKey = requiresApiKey(editData.type ?? null);
  const needsURL = requiresBaseURL(editData.type ?? null);
  const canFetch = supportsModelFetching(editData.type ?? null);

  const isEnabled = editData.isEnabled ?? false;
  const autoFetchModels = editData.autoFetchModels ?? false;

  // Use useMemo for the enabled set based on editData
  const enabledModelsSet = useMemo(
    () => new Set(editData.enabledModels ?? []),
    [editData.enabledModels],
  );

  // Handler to update local editData state when toggling in Edit mode
  const handleModelToggle = useCallback(
    (modelId: string, checked: boolean) => {
      const currentEnabledSet = new Set(editData.enabledModels ?? []);
      if (checked) {
        currentEnabledSet.add(modelId);
      } else {
        currentEnabledSet.delete(modelId);
      }
      const newEnabledModels = Array.from(currentEnabledSet);
      // Call onChange to update the parent's editData state
      onChange("enabledModels", newEnabledModels);
    },
    [editData.enabledModels, onChange],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Basic Configuration */}
        <div className="space-y-3">
          <h4 className="text-md font-semibold text-card-foreground mb-2">
            Basic Configuration
          </h4>
          <div className="space-y-1">
            <Label htmlFor={`edit-name-${providerId}`}>Provider Name</Label>
            <Input
              id={`edit-name-${providerId}`}
              value={editData.name || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="Provider Name"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`edit-type-${providerId}`}>Provider Type</Label>
            <Select
              value={editData.type ?? ""}
              onValueChange={(value) =>
                onChange("type", value as DbProviderType)
              }
              disabled={isSaving}
            >
              <SelectTrigger id={`edit-type-${providerId}`}>
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
          </div>

          {needsKey && (
            <div className="space-y-1">
              <Label>API Key</Label>
              <ApiKeySelector
                selectedKeyId={editData.apiKeyId ?? null}
                onKeySelected={(keyId: string | null) =>
                  onChange("apiKeyId", keyId)
                }
                apiKeys={apiKeys}
                disabled={isSaving}
              />
            </div>
          )}
          {needsURL && (
            <div className="space-y-1">
              <Label htmlFor={`edit-baseurl-${providerId}`}>Base URL</Label>
              <Input
                id={`edit-baseurl-${providerId}`}
                value={editData.baseURL || ""}
                onChange={(e) => onChange("baseURL", e.target.value)}
                placeholder="e.g., http://localhost:11434"
                disabled={isSaving}
              />
            </div>
          )}
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id={`edit-enabled-${providerId}`}
              checked={isEnabled}
              onCheckedChange={(checked) => onChange("isEnabled", checked)}
              disabled={isSaving}
              aria-labelledby={`edit-enabled-label-${providerId}`}
            />
            <Label
              id={`edit-enabled-label-${providerId}`}
              htmlFor={`edit-enabled-${providerId}`}
            >
              Provider Enabled
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={`edit-autofetch-${providerId}`}
              checked={autoFetchModels}
              onCheckedChange={(checked) =>
                onChange("autoFetchModels", checked)
              }
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

        {/* Column 2: Model Management */}
        <div className="space-y-3">
          <h4 className="text-md font-semibold text-card-foreground">
            Model Enablement
          </h4>
          <p className="text-xs text-muted-foreground">
            Toggle models on/off for global use. Changes will be saved with the
            form.
          </p>
          <ModelEnablementList
            providerId={providerId}
            allAvailableModels={allAvailableModels}
            enabledModelIds={enabledModelsSet} // Use memoized set from editData
            onToggleModel={handleModelToggle} // Use local state update handler
            disabled={isSaving} // Disable switches while saving basic config
            listHeightClass="h-[calc(100%-8rem)]" // Adjust height
          />
        </div>
      </div>

      <Separator className="my-4" />

      {/* Action Buttons (Saves Basic Config AND Model Enablement) */}
      <div className="flex justify-end space-x-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          type="button"
        >
          <XIcon className="h-4 w-4 mr-1" /> Cancel Edit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave} // Saves all changes in editData
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
