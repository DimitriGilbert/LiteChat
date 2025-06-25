import React, { useEffect, useMemo } from "react";
import { useForm } from "@tanstack/react-form";
import { useShallow } from "zustand/react/shallow";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSettingsStore } from "@/store/settings.store";
import { useProviderStore } from "@/store/provider.store";
import { emitter } from "@/lib/litechat/event-emitter";
import { settingsEvent } from "@/types/litechat/events/settings.events";
import { ModelSelector } from "@/controls/components/global-model-selector/ModelSelector";
import { Separator } from "@/components/ui/separator";

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

  const { availableModels } = useProviderStore(
    useShallow((state) => ({
      availableModels: state.getAvailableModelListItems(),
      defaultModelId: state.selectedModelId,
    }))
  );

  const form = useForm({
    defaultValues: {
      runnableBlocksSecurityCheckEnabled:
        settings.runnableBlocksSecurityCheckEnabled,
      runnableBlocksSecurityModelId: settings.runnableBlocksSecurityModelId,
      runnableBlocksSecurityPrompt: settings.runnableBlocksSecurityPrompt,
    },
    onSubmit: async ({ value }) => {
      emitter.emit(settingsEvent.setRunnableBlocksSecurityCheckEnabledRequest, {
        enabled: value.runnableBlocksSecurityCheckEnabled,
      });
      emitter.emit(settingsEvent.setRunnableBlocksSecurityModelIdRequest, {
        modelId: value.runnableBlocksSecurityModelId,
      });
      emitter.emit(settingsEvent.setRunnableBlocksSecurityPromptRequest, {
        prompt: value.runnableBlocksSecurityPrompt,
      });
    },
  });

  useEffect(() => {
    form.reset({
      runnableBlocksSecurityCheckEnabled:
        settings.runnableBlocksSecurityCheckEnabled,
      runnableBlocksSecurityModelId: settings.runnableBlocksSecurityModelId,
      runnableBlocksSecurityPrompt: settings.runnableBlocksSecurityPrompt,
    });
  }, [
    settings.runnableBlocksSecurityCheckEnabled,
    settings.runnableBlocksSecurityModelId,
    settings.runnableBlocksSecurityPrompt,
    form,
  ]);

  const handleJsToggle = (enabled: boolean) => {
    emitter.emit(settingsEvent.setControlRuleAlwaysOnRequest, {
      ruleId: "core-js-runnable-block-renderer-control-rule",
      alwaysOn: enabled,
    });
  };

  const handlePythonToggle = (enabled: boolean) => {
    emitter.emit(settingsEvent.setControlRuleAlwaysOnRequest, {
      ruleId: "core-python-runnable-block-renderer-control-rule",
      alwaysOn: enabled,
    });
  };

  const isJsEnabled = useMemo(
    () =>
      settings.controlRuleAlwaysOn[
        "core-js-runnable-block-renderer-control-rule"
      ] ?? false,
    [settings.controlRuleAlwaysOn]
  );

  const isPythonEnabled = useMemo(
    () =>
      settings.controlRuleAlwaysOn[
        "core-python-runnable-block-renderer-control-rule"
      ] ?? false,
    [settings.controlRuleAlwaysOn]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Runnable Code Blocks</CardTitle>
          <CardDescription>
            Enable or disable support for runnable code blocks and configure
            their security settings. This is an advanced feature and should be
            used with caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Activation</h3>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="js-enabled" className="text-base">
                  Runnable JavaScript
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow the AI to generate and execute JavaScript code blocks.
                </p>
              </div>
              <Switch
                id="js-enabled"
                checked={isJsEnabled}
                onCheckedChange={handleJsToggle}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="python-enabled" className="text-base">
                  Runnable Python
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow the AI to generate and execute Python code blocks via
                  Pyodide.
                </p>
              </div>
              <Switch
                id="python-enabled"
                checked={isPythonEnabled}
                onCheckedChange={handlePythonToggle}
              />
            </div>
          </div>
          <Separator />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <h3 className="text-lg font-medium">Security Validation</h3>
            <form.Field
              name="runnableBlocksSecurityCheckEnabled"
              children={(field) => (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="security-check-enabled" className="text-base">
                      Enable Security Check
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Use an AI model to analyze code for security risks before
                      execution.
                    </p>
                  </div>
                  <Switch
                    id="security-check-enabled"
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                </div>
              )}
            />

            <div className="space-y-2">
              <Label htmlFor="security-model">Security Validation Model</Label>
              <form.Field
                name="runnableBlocksSecurityModelId"
                children={(field) => (
                  <ModelSelector
                    models={availableModels}
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled={!settings.runnableBlocksSecurityCheckEnabled}
                  />
                )}
              />
              <p className="text-sm text-muted-foreground">
                Select the model used for security analysis. A fast, low-cost
                model is recommended.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="security-prompt">Security Validation Prompt</Label>
              <form.Field
                name="runnableBlocksSecurityPrompt"
                children={(field) => (
                  <Textarea
                    id="security-prompt"
                    value={field.state.value ?? ""}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    rows={10}
                    placeholder="Enter the security validation system prompt..."
                    disabled={!settings.runnableBlocksSecurityCheckEnabled}
                  />
                )}
              />
              <p className="text-sm text-muted-foreground">
                The system prompt used to instruct the AI during security
                validation. Must include {"{{code}}"} placeholder.
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!form.state.isDirty}>
                Save Security Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export const SettingsRunnableBlocks = SettingsRunnableBlocksComponent; 