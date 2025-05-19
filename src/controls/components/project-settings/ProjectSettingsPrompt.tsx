// src/controls/components/project-settings/ProjectSettingsPrompt.tsx
// FULL FILE
import React, { useEffect } from "react";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";
import { useProviderStore } from "@/store/provider.store";
import { useShallow } from "zustand/react/shallow";
import { FieldMetaMessages } from "@/components/LiteChat/common/form-fields/FieldMetaMessages";
import { Loader2, SaveIcon } from "lucide-react";

interface ProjectSettingsPromptProps {
  initialSystemPrompt: string | null;
  initialModelId: string | null;
  onSave: (data: {
    systemPrompt: string | null;
    modelId: string | null;
  }) => Promise<void> | void;
  effectiveSystemPrompt: string | null;
  effectiveModelId: string | null;
  isParentSaving?: boolean;
}

const projectSettingsPromptSchema = z.object({
  systemPrompt: z.string().nullable(),
  modelId: z.string().nullable(),
});

export const ProjectSettingsPrompt: React.FC<ProjectSettingsPromptProps> = ({
  initialSystemPrompt,
  initialModelId,
  onSave,
  effectiveSystemPrompt,
  effectiveModelId,
  isParentSaving = false,
}) => {
  const { getAvailableModelListItems } = useProviderStore(
    useShallow((state) => ({
      getAvailableModelListItems: state.getAvailableModelListItems,
    })),
  );
  const availableModels = getAvailableModelListItems();
  const effectiveModelName =
    availableModels.find((m) => m.id === effectiveModelId)?.name ||
    effectiveModelId;

  const form = useForm({
    defaultValues: {
      systemPrompt: initialSystemPrompt ?? null,
      modelId: initialModelId ?? null,
    },
    validators: {
      onChangeAsync: projectSettingsPromptSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      await onSave({
        systemPrompt: value.systemPrompt,
        modelId: value.modelId,
      });
    },
  });

  useEffect(() => {
    form.reset({
      systemPrompt: initialSystemPrompt ?? null,
      modelId: initialModelId ?? null,
    });
  }, [initialSystemPrompt, initialModelId, form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-6"
    >
      <form.Field
        name="systemPrompt"
        validators={{
          onChange: projectSettingsPromptSchema.shape.systemPrompt,
        }}
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label htmlFor={`${field.name}-textarea`}>
              System Prompt (Overrides Parent/Global)
            </Label>
            <Textarea
              id={`${field.name}-textarea`}
              placeholder={`Inherited: ${
                effectiveSystemPrompt?.substring(0, 100) || "Default"
              }${
                effectiveSystemPrompt && effectiveSystemPrompt.length > 100
                  ? "..."
                  : ""
              }`}
              value={field.state.value ?? ""}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              rows={6}
              disabled={form.state.isSubmitting || isParentSaving}
              className="mt-1"
            />
            <FieldMetaMessages field={field} />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => form.setFieldValue("systemPrompt", null)}
              disabled={
                form.state.isSubmitting ||
                isParentSaving ||
                field.state.value === null
              }
              type="button"
            >
              Use Inherited/Default
            </Button>
          </div>
        )}
      />
      <form.Field
        name="modelId"
        validators={{
          onChange: projectSettingsPromptSchema.shape.modelId,
        }}
        children={(field: AnyFieldApi) => (
          <div className="space-y-1.5">
            <Label>
              Default Model (Overrides Parent/Global)
            </Label>
            <ModelSelector
              models={availableModels}
              value={field.state.value}
              onChange={(val) => {
                field.handleChange(val);
                field.handleBlur();
              }}
              disabled={form.state.isSubmitting || isParentSaving}
              className="w-full mt-1"
            />
            <FieldMetaMessages field={field} />
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0 text-muted-foreground"
              onClick={() => form.setFieldValue("modelId", null)}
              disabled={
                form.state.isSubmitting ||
                isParentSaving ||
                field.state.value === null
              }
              type="button"
            >
              Use Inherited/Default ({effectiveModelName || "Global Default"})
            </Button>
          </div>
        )}
      />
      <div className="flex justify-end pt-2">
        <form.Subscribe
          selector={(state) =>
            [
              state.canSubmit,
              state.isSubmitting,
              state.isValidating,
              state.isValid,
            ] as const
          }
          children={([canSubmit, isSubmitting, isValidating, isValid]) => (
            <Button
              type="submit"
              size="sm"
              disabled={
                isParentSaving ||
                !canSubmit ||
                isSubmitting ||
                isValidating ||
                !isValid
              }
            >
              {(isSubmitting || isValidating) && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              <SaveIcon className="h-4 w-4 mr-1" />
              {isSubmitting || isValidating
                ? "Saving..."
                : "Save Prompt Settings"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
