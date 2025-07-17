// src/components/LiteChat/settings/assistant/SettingsAssistantTools.tsx
// FULL FILE
import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { SwitchField } from "@/components/LiteChat/common/form-fields/SwitchField";
import { Separator } from "@/components/ui/separator";

const assistantToolsSchema = z.object({
  toolMaxSteps: z
    .number({
      required_error: "Max steps is required",
      invalid_type_error: "Max steps must be a number",
    })
    .min(1, "Must be at least 1")
    .max(20, "Cannot exceed 20"),
  autoToolSelectionEnabled: z.boolean(),
});

// Utility component for field meta messages (can be shared)
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

export const SettingsAssistantTools: React.FC = () => {
  const { t } = useTranslation('assistantSettings');
  const { toolMaxSteps, setToolMaxSteps, autoToolSelectionEnabled, setAutoToolSelectionEnabled } = useSettingsStore(
    useShallow((state) => ({
      toolMaxSteps: state.toolMaxSteps,
      setToolMaxSteps: state.setToolMaxSteps,
      autoToolSelectionEnabled: state.autoToolSelectionEnabled,
      setAutoToolSelectionEnabled: state.setAutoToolSelectionEnabled,
    })),
  );

  const form = useForm({
    defaultValues: {
      toolMaxSteps: toolMaxSteps ?? 5,
      autoToolSelectionEnabled: autoToolSelectionEnabled ?? false,
    },
    validators: {
      onChangeAsync: assistantToolsSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      try {
        setToolMaxSteps(value.toolMaxSteps);
        setAutoToolSelectionEnabled(value.autoToolSelectionEnabled);
        toast.success(t('tools.updateSuccess'));
      } catch (error) {
        toast.error(t('tools.updateError'));
        console.error("Error submitting tool settings form:", error);
      }
    },
  });

  useEffect(() => {
    if (form.state.values.toolMaxSteps !== (toolMaxSteps ?? 5) || 
        form.state.values.autoToolSelectionEnabled !== (autoToolSelectionEnabled ?? false)) {
      form.reset({ 
        toolMaxSteps: toolMaxSteps ?? 5,
        autoToolSelectionEnabled: autoToolSelectionEnabled ?? false 
      });
    }
  }, [toolMaxSteps, autoToolSelectionEnabled, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-3"
    >
      <SwitchField
        form={form}
        name="autoToolSelectionEnabled"
        label="Enable Automatic Tool Selection"
        description="Allow AI to automatically select relevant tools based on your prompt content."
      />
      
      <Separator />
      
      <form.Field
        name="toolMaxSteps"
        children={(field) => (
          <div>
            <Label htmlFor={field.name} className="text-sm mb-1 block">
              {t('tools.maxStepsLabel')}
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t('tools.maxStepsDescription')}
            </p>
            <Input
              id={field.name}
              type="number"
              min={1}
              max={20}
              step={1}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                const numValue = e.target.valueAsNumber;
                if (!isNaN(numValue)) {
                  field.handleChange(numValue);
                } else if (e.target.value === "") {
                   // Allow clearing, Zod schema will catch if it's required
                  field.handleChange(undefined as any); // Or a specific default like null/0 if appropriate for schema
                }
              }}
              className={`w-24 ${field.state.meta.errors.length ? "border-destructive" : ""}`}
            />
            <FieldMetaMessages field={field} />
          </div>
        )}
      />
      <div className="flex justify-end pt-2">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isValidating, state.isValid] as const}
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit || isSubmitting || isValidating || !isValid}
            >
              {isSubmitting ? t('common.saving') : isValidating ? t('common.validating') : t('tools.saveButton')}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
