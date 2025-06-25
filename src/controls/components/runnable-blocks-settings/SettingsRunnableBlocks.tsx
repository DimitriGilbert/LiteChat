import React, { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { useShallow } from "zustand/react/shallow";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsStore } from "@/store/settings.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { Separator } from "@/components/ui/separator";
import { SwitchField } from "@/components/LiteChat/common/form-fields/SwitchField";
import { GlobalModelSelector } from "@/controls/components/global-model-selector/GlobalModelSelector";
import { toast } from "sonner";

const runnableBlocksSchema = z.object({
  jsEnabled: z.boolean(),
  pythonEnabled: z.boolean(),
  runnableBlocksSecurityCheckEnabled: z.boolean(),
  runnableBlocksSecurityModelId: z.string().nullable(),
  runnableBlocksSecurityPrompt: z.string(),
});

const SettingsRunnableBlocksComponent: React.FC = () => {
  const settings = useSettingsStore(
    useShallow((state) => ({
      controlRuleAlwaysOn: state.controlRuleAlwaysOn,
      runnableBlocksSecurityCheckEnabled:
        state.runnableBlocksSecurityCheckEnabled,
      runnableBlocksSecurityModelId: state.runnableBlocksSecurityModelId,
      runnableBlocksSecurityPrompt: state.runnableBlocksSecurityPrompt,
    }))
  );

  const getSetting = (ruleId: string, defaultValue: boolean): boolean => {
    const value = settings.controlRuleAlwaysOn?.[ruleId];
    return typeof value === 'boolean' ? value : defaultValue;
  }

  const form = useForm({
    defaultValues: {
      jsEnabled: getSetting("core-js-runnable-block-renderer-control-rule", false),
      pythonEnabled: getSetting("core-python-runnable-block-renderer-control-rule", false),
      runnableBlocksSecurityCheckEnabled:
        settings.runnableBlocksSecurityCheckEnabled ?? true,
      runnableBlocksSecurityModelId:
        settings.runnableBlocksSecurityModelId ?? null,
      runnableBlocksSecurityPrompt:
        settings.runnableBlocksSecurityPrompt ?? "",
    },
    validators: {
      onChange: runnableBlocksSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        emitter.emit(settingsEvent.setControlRuleAlwaysOnRequest, {
          ruleId: "core-js-runnable-block-renderer-control-rule",
          alwaysOn: value.jsEnabled,
        });
        emitter.emit(settingsEvent.setControlRuleAlwaysOnRequest, {
          ruleId: "core-python-runnable-block-renderer-control-rule",
          alwaysOn: value.pythonEnabled,
        });

        emitter.emit(
          settingsEvent.setRunnableBlocksSecurityCheckEnabledRequest,
          {
            enabled: value.runnableBlocksSecurityCheckEnabled,
          }
        );
        emitter.emit(settingsEvent.setRunnableBlocksSecurityModelIdRequest, {
          modelId: value.runnableBlocksSecurityModelId,
        });
        emitter.emit(settingsEvent.setRunnableBlocksSecurityPromptRequest, {
          prompt: value.runnableBlocksSecurityPrompt,
        });
        toast.success("Runnable block settings saved!");
      } catch (error) {
        toast.error("Failed to save runnable block settings.");
        console.error("Error saving runnable block settings:", error);
      }
    },
  });

  useEffect(() => {
    form.reset({
      jsEnabled: getSetting("core-js-runnable-block-renderer-control-rule", false),
      pythonEnabled: getSetting("core-python-runnable-block-renderer-control-rule", false),
      runnableBlocksSecurityCheckEnabled:
        settings.runnableBlocksSecurityCheckEnabled ?? true,
      runnableBlocksSecurityModelId:
        settings.runnableBlocksSecurityModelId ?? null,
      runnableBlocksSecurityPrompt:
        settings.runnableBlocksSecurityPrompt ?? "",
    });
  }, [
    settings.controlRuleAlwaysOn,
    settings.runnableBlocksSecurityCheckEnabled,
    settings.runnableBlocksSecurityModelId,
    settings.runnableBlocksSecurityPrompt,
    form,
  ]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="p-1 space-y-4"
    >
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Runnable Code Activation</h3>
        <p className="text-sm text-muted-foreground">
          Enable or disable support for runnable code blocks. This is an
          advanced feature and should be used with caution.
        </p>

        <SwitchField
          form={form}
          name="jsEnabled"
          label="Runnable JavaScript"
          description="Allow the AI to generate and execute JavaScript code blocks."
        />

        <SwitchField
          form={form}
          name="pythonEnabled"
          label="Runnable Python"
          description="Allow the AI to generate and execute Python code blocks via Pyodide."
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Security Validation</h3>
        <p className="text-sm text-muted-foreground">
          Use an AI model to analyze code for security risks before execution.
        </p>

        <SwitchField
          form={form}
          name="runnableBlocksSecurityCheckEnabled"
          label="Enable Security Check"
          description="Requires an AI call to validate code safety before running."
        />

        <form.Field
          name="runnableBlocksSecurityModelId"
          children={(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Security Validation Model</Label>
              <p className="text-xs text-muted-foreground">
                Select the model used for security analysis. A fast, low-cost
                model is recommended.
              </p>
              <GlobalModelSelector
                value={field.state.value}
                onChange={(modelId: string | null) =>
                  field.handleChange(modelId)
                }
                className="w-full"
                disabled={
                  !form.state.values.runnableBlocksSecurityCheckEnabled
                }
              />
            </div>
          )}
        />

        <form.Field
          name="runnableBlocksSecurityPrompt"
          children={(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>Security Validation Prompt</Label>
              <p className="text-xs text-muted-foreground">
                System prompt for the security check. Must include the{" "}
                <code>{`{{code}}`}</code> placeholder.
              </p>
              <Textarea
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                rows={8}
                placeholder="Enter the security validation system prompt..."
                className="font-mono"
                disabled={
                  !form.state.values.runnableBlocksSecurityCheckEnabled
                }
              />
            </div>
          )}
        />
      </div>
      <Separator />
      <div className="flex items-center justify-end pt-3">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Settings"}
            </Button>
          )}
        />
      </div>
    </form>
  );
};

export const SettingsRunnableBlocks = SettingsRunnableBlocksComponent; 