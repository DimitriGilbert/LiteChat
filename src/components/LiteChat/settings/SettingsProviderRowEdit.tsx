// src/components/LiteChat/settings/SettingsProviderRowEdit.tsx
// FULL FILE
import React, { useCallback, useMemo } from "react";
import type { DbProviderConfig, DbApiKey } from "@/types/litechat/provider";
import { Button } from "@/components/ui/button";
import { SaveIcon, XIcon, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ModelEnablementList } from "./ModelEnablementList";
import { ProviderConfigForm, ProviderFormData } from "./ProviderConfigForm"; // Import shared form

interface ProviderRowEditModeProps {
  providerId: string;
  // Use the shared form data type for editData
  editData: ProviderFormData & { enabledModels?: string[] | null };
  apiKeys: DbApiKey[];
  // Keep allAvailableModels for the ModelEnablementList
  allAvailableModels: { id: string; name: string }[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => Promise<void>;
  // Update onChange signature to match ProviderFormData
  onChange: (
    field: keyof ProviderFormData | "enabledModels", // Allow 'enabledModels'
    value: string | boolean | string[] | null,
  ) => void;
  // onUpdate removed as it's handled by onSave now
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
}) => {
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
      // Call onChange to update the parent's editData state for enabledModels
      onChange("enabledModels", newEnabledModels);
    },
    [editData.enabledModels, onChange],
  );

  // Callback specifically for the ProviderConfigForm
  const handleFormChange = useCallback(
    (
      field: keyof ProviderFormData,
      value: string | boolean | string[] | null,
    ) => {
      onChange(field, value);
    },
    [onChange],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Basic Configuration (using shared form) */}
        <div className="space-y-3">
          <h4 className="text-md font-semibold text-card-foreground mb-2">
            Basic Configuration
          </h4>
          <ProviderConfigForm
            formData={editData}
            onChange={handleFormChange}
            apiKeys={apiKeys}
            disabled={isSaving}
          />
        </div>

        {/* Column 2: Model Management (remains separate) */}
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
