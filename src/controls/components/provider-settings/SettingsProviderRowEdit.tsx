// src/components/LiteChat/settings/SettingsProviderRowEdit.tsx
// FULL FILE
import React, { useCallback, useMemo } from "react";
// Import OpenRouterModel for the allAvailableModels prop
import type { DbApiKey, OpenRouterModel } from "@/types/litechat/provider";
// import { Button } from "@/components/ui/button";
// import { SaveIcon, XIcon, Loader2 } from "lucide-react";
// import { Separator } from "@/components/ui/separator";
import { ModelEnablementList } from "./ModelEnablementList";
import { ProviderConfigForm, ProviderFormData } from "./ProviderConfigForm";

interface ProviderRowEditModeProps {
  providerId: string;
  editData: ProviderFormData & { enabledModels?: string[] | null };
  apiKeys: DbApiKey[];
  // This prop now expects OpenRouterModel[]
  allAvailableModels: OpenRouterModel[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => Promise<void>;
  onChange: (
    field: keyof ProviderFormData | "enabledModels",
    value: string | boolean | string[] | null
  ) => void;
}

const ProviderRowEditModeComponent: React.FC<ProviderRowEditModeProps> = ({
  providerId,
  editData,
  apiKeys,
  allAvailableModels, // Now OpenRouterModel[]
  isSaving,
  onCancel,
  onSave,
  onChange,
}) => {
  const enabledModelsSet = useMemo(
    () => new Set(editData.enabledModels ?? []),
    [editData.enabledModels]
  );

  const handleModelToggle = useCallback(
    (modelId: string, checked: boolean) => {
      // modelId here is the simple ID from OpenRouterModel
      const currentEnabledSet = new Set(editData.enabledModels ?? []);
      if (checked) {
        currentEnabledSet.add(modelId);
      } else {
        currentEnabledSet.delete(modelId);
      }
      const newEnabledModels = Array.from(currentEnabledSet);
      onChange("enabledModels", newEnabledModels);
    },
    [editData.enabledModels, onChange]
  );

  const handleFormChange = useCallback(
    (
      field: keyof ProviderFormData,
      value: string | boolean | string[] | null
    ) => {
      return new Promise<void>((resolve) => {
        onChange(field, value);
        resolve(void 0);
      });
    },
    [onChange]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h4 className="text-md font-semibold text-card-foreground mb-2">
            Basic Configuration
          </h4>
          <ProviderConfigForm
            initialData={editData}
            onChange={handleFormChange}
            onSubmit={onSave}
            onCancel={onCancel}
            apiKeys={apiKeys}
            disabled={isSaving}
          />
        </div>

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
            allAvailableModels={allAvailableModels} // Pass OpenRouterModel[]
            enabledModelIds={enabledModelsSet}
            onToggleModel={handleModelToggle}
            disabled={isSaving}
            listHeightClass="h-[calc(100%-8rem)]"
            // onModelClick is handled by ProviderRowViewMode, not needed here directly
          />
        </div>
      </div>
      {/* 
      <Separator className="my-4" />

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
          onClick={onSave}
          disabled={isSaving}
          type="button"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <SaveIcon className="h-4 w-4 mr-1" />{" "}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div> */}
    </div>
  );
};

export const ProviderRowEditMode = React.memo(ProviderRowEditModeComponent);
