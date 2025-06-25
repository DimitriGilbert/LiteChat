import React, { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { GlobalModelSelector } from "@/controls/components/global-model-selector/GlobalModelSelector";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";

const autoRulesSchema = z.object({
  autoRuleSelectionEnabled: z.boolean(),
  autoRuleSelectionModelId: z.string().nullable(),
  autoRuleSelectionPrompt: z.string().min(10).max(2000),
});

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

export const SettingsAutoRules: React.FC = () => {
  const storeAccess = useSettingsStore(
    useShallow((state) => ({
      autoRuleSelectionEnabled: state.autoRuleSelectionEnabled,
      setAutoRuleSelectionEnabled: state.setAutoRuleSelectionEnabled,
      autoRuleSelectionModelId: state.autoRuleSelectionModelId,
      setAutoRuleSelectionModelId: state.setAutoRuleSelectionModelId,
      autoRuleSelectionPrompt: state.autoRuleSelectionPrompt,
      setAutoRuleSelectionPrompt: state.setAutoRuleSelectionPrompt,
    }))
  );

  const form = useForm({
    defaultValues: {
      autoRuleSelectionEnabled: storeAccess.autoRuleSelectionEnabled ?? false,
      autoRuleSelectionModelId: storeAccess.autoRuleSelectionModelId ?? null,
      autoRuleSelectionPrompt: storeAccess.autoRuleSelectionPrompt ?? "",
    },
    validators: {
      onChangeAsync: autoRulesSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      try {
        storeAccess.setAutoRuleSelectionEnabled(value.autoRuleSelectionEnabled);
        storeAccess.setAutoRuleSelectionModelId(value.autoRuleSelectionModelId ?? null);
        storeAccess.setAutoRuleSelectionPrompt(value.autoRuleSelectionPrompt);
        toast.success("Auto-rule selection settings updated!");
      } catch (error) {
        toast.error("Failed to update auto-rule selection settings.");
        console.error("Error submitting auto-rule selection settings form:", error);
      }
    },
  });

  useEffect(() => {
    form.reset({
      autoRuleSelectionEnabled: storeAccess.autoRuleSelectionEnabled ?? false,
      autoRuleSelectionModelId: storeAccess.autoRuleSelectionModelId ?? null,
      autoRuleSelectionPrompt: storeAccess.autoRuleSelectionPrompt ?? "",
    });
  }, [
    storeAccess.autoRuleSelectionEnabled,
    storeAccess.autoRuleSelectionModelId,
    storeAccess.autoRuleSelectionPrompt,
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
        name="autoRuleSelectionEnabled"
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
              Enable Auto-Rule Selection
            </Label>
            <FieldMetaMessages field={field} />
          </div>
        )}
      />
      {form.state.values.autoRuleSelectionEnabled && (
        <div className="space-y-3 pl-6 border-l-2 border-muted">
          <form.Field
            name="autoRuleSelectionModelId"
            children={(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Model for Rule Selection</Label>
                <p className="text-xs text-muted-foreground">
                  Choose which model to use for auto-selecting rules. Uses global default model if not specified.
                </p>
                <GlobalModelSelector
                  value={field.state.value}
                  onChange={(modelId: string | null) => field.handleChange(modelId)}
                  className="w-full"
                />
                <FieldMetaMessages field={field} />
              </div>
            )}
          />
          <form.Field
            name="autoRuleSelectionPrompt"
            children={(field) => (
              <div className="space-y-1.5">
                <Label htmlFor={field.name}>Prompt Template for Rule Selection</Label>
                <p className="text-xs text-muted-foreground">
                  The prompt template used to instruct the AI to select rules. Use <code>{`{{prompt}}`}</code> for the user prompt and <code>{`{{rules}}`}</code> for the rules list.
                </p>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={`w-full min-h-[100px] font-mono ${field.state.meta.errors.length ? "border-destructive" : ""}`}
                />
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
              {isSubmitting ? "Saving..." : isValidating ? "Validating..." : "Save Rule Settings"}
            </Button>
          )}
        />
      </div>
    </form>
  );
} 