// src/controls/components/assistant-settings/SettingsAssistantTitles.tsx
// FULL FILE
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";
import { useProviderStore } from "@/store/provider.store";

const assistantTitlesSchema = z.object({
  autoTitleEnabled: z.boolean(),
  autoTitleAlwaysOn: z.boolean(),
  autoTitleModelId: z.string().nullable(), // Changed from .optional()
  autoTitlePromptMaxLength: z.number().min(100).max(4000),
  autoTitleIncludeFiles: z.boolean(),
  autoTitleIncludeRules: z.boolean(),
});

// Utility component for field meta messages
function FieldMetaMessages({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
        <em className="text-xs text-destructive mt-1 block">
          {field.state.meta.errors.join(", ")}
        </em>
      ) : null}
    </>
  );
}

export const SettingsAssistantTitles: React.FC = () => {
  const { t } = useTranslation('assistantSettings');
  const storeAccess = useSettingsStore(
    useShallow((state) => ({
      autoTitleEnabled: state.autoTitleEnabled,
      setAutoTitleEnabled: state.setAutoTitleEnabled,
      autoTitleAlwaysOn: state.autoTitleAlwaysOn,
      setAutoTitleAlwaysOn: state.setAutoTitleAlwaysOn,
      autoTitleModelId: state.autoTitleModelId,
      setAutoTitleModelId: state.setAutoTitleModelId,
      autoTitlePromptMaxLength: state.autoTitlePromptMaxLength,
      setAutoTitlePromptMaxLength: state.setAutoTitlePromptMaxLength,
      autoTitleIncludeFiles: state.autoTitleIncludeFiles,
      setAutoTitleIncludeFiles: state.setAutoTitleIncludeFiles,
      autoTitleIncludeRules: state.autoTitleIncludeRules,
      setAutoTitleIncludeRules: state.setAutoTitleIncludeRules,
    }))
  );

  const { globallyEnabledModels } = useProviderStore(
    useShallow((state) => ({
      globallyEnabledModels: state.getGloballyEnabledModelDefinitions(),
    }))
  );

  const form = useForm({
    defaultValues: {
      autoTitleEnabled: storeAccess.autoTitleEnabled ?? false,
      autoTitleAlwaysOn: storeAccess.autoTitleAlwaysOn ?? false,
      autoTitleModelId: storeAccess.autoTitleModelId ?? null, // Ensures it's string or null
      autoTitlePromptMaxLength: storeAccess.autoTitlePromptMaxLength ?? 768,
      autoTitleIncludeFiles: storeAccess.autoTitleIncludeFiles ?? false,
      autoTitleIncludeRules: storeAccess.autoTitleIncludeRules ?? false,
    },
    validators: {
      onChangeAsync: assistantTitlesSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      try {
        storeAccess.setAutoTitleEnabled(value.autoTitleEnabled);
        storeAccess.setAutoTitleAlwaysOn(value.autoTitleAlwaysOn);
        // Ensure null is passed if value.autoTitleModelId is null/undefined
        storeAccess.setAutoTitleModelId(value.autoTitleModelId ?? null);
        storeAccess.setAutoTitlePromptMaxLength(value.autoTitlePromptMaxLength);
        storeAccess.setAutoTitleIncludeFiles(value.autoTitleIncludeFiles);
        storeAccess.setAutoTitleIncludeRules(value.autoTitleIncludeRules);
        toast.success(t('titles.updateSuccess'));
      } catch (error) {
        toast.error(t('titles.updateError'));
        console.error("Error submitting auto-title settings form:", error);
      }
    },
  });

  useEffect(() => {
    form.reset({
      autoTitleEnabled: storeAccess.autoTitleEnabled ?? false,
      autoTitleAlwaysOn: storeAccess.autoTitleAlwaysOn ?? false,
      autoTitleModelId: storeAccess.autoTitleModelId ?? null,
      autoTitlePromptMaxLength: storeAccess.autoTitlePromptMaxLength ?? 768,
      autoTitleIncludeFiles: storeAccess.autoTitleIncludeFiles ?? false,
      autoTitleIncludeRules: storeAccess.autoTitleIncludeRules ?? false,
    });
  }, [
    storeAccess.autoTitleEnabled,
    storeAccess.autoTitleAlwaysOn,
    storeAccess.autoTitleModelId,
    storeAccess.autoTitlePromptMaxLength,
    storeAccess.autoTitleIncludeFiles,
    storeAccess.autoTitleIncludeRules,
    form,
  ]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-3"
    >
      <form.Field
        name="autoTitleEnabled"
        children={(field) => (
          <div className="flex items-center space-x-2">
            <Switch
              id={field.name}
              checked={field.state.value}
              onCheckedChange={field.handleChange}
              onBlur={field.handleBlur}
              aria-labelledby={`${field.name}-label`}
            />
            <Label id={`${field.name}-label`} htmlFor={field.name}>
              {t('titles.enableAutoTitle')}
            </Label>
            <FieldMetaMessages field={field} />
          </div>
        )}
      />
      {form.state.values.autoTitleEnabled && (
        <div className="space-y-3 pl-6 border-l-2 border-muted">
          <form.Field
            name="autoTitleAlwaysOn"
            children={(field) => (
              <div className="flex items-center space-x-2">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                  aria-labelledby={`${field.name}-label`}
                />
                <Label id={`${field.name}-label`} htmlFor={field.name}>
                  {t('titles.alwaysOn')}
                </Label>
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
          <form.Field
            name="autoTitleModelId"
            children={(field) => (
              <div className="space-y-1.5 overflow-visible">
                <Label htmlFor={field.name}>{t('titles.modelForGeneration')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('titles.modelDescription')}
                </p>
                <ModelSelector
                  value={field.state.value}
                  onChange={(modelId: string | null) => field.handleChange(modelId)}
                  className="w-full z-500"
                  models={globallyEnabledModels}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
          <form.Field
            name="autoTitlePromptMaxLength"
            children={(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>
                  {t('titles.contentLengthLimit')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('titles.contentLengthDescription')}
                </p>
                <Input
                  id={field.name}
                  type="number"
                  min={100}
                  max={4000}
                  step={1}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    const numValue = e.target.valueAsNumber;
                    if (!isNaN(numValue)) {
                      field.handleChange(numValue);
                    }
                  }}
                  className={`w-32 ${field.state.meta.errors.length ? "border-destructive" : ""}`}
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
          <form.Field
            name="autoTitleIncludeFiles"
            children={(field) => (
              <div className="flex items-center space-x-2">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                  aria-labelledby={`${field.name}-label`}
                />
                <Label id={`${field.name}-label`} htmlFor={field.name}>
                  {t('titles.includeFiles')}
                </Label>
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
          <form.Field
            name="autoTitleIncludeRules"
            children={(field) => (
              <div className="flex items-center space-x-2">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                  onBlur={field.handleBlur}
                  aria-labelledby={`${field.name}-label`}
                />
                <Label id={`${field.name}-label`} htmlFor={field.name}>
                  {t('titles.includeRules')}
                </Label>
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
        </div>
      )}
      <div className="flex justify-end pt-2">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isValidating, state.isValid] as const}
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || isSubmitting || isValidating || !isValid}
            >
              {isSubmitting ? t('common.saving') : isValidating ? t('common.validating') : t('titles.saveButton')}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
